package com.opesware.opesfuel;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Authoritative P0 Release Checklist Verification Suite (OPES_FUEL_AUDIT_CHECKLIST.json).
 * Each test verifies a specific numbered release invariant (T003, T004, T005, T006, T008, T009, T011, T013, T016, T017, T018, T020).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ReleaseChecklistTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void seedReleaseTestFixtures() throws Exception {
        jdbcTemplate.execute("ALTER TABLE event_publication ALTER COLUMN serialized_event CLOB");
        for (String migration : List.of(
            "db/migration/V7__prelaunch_modules_hr_audit_safe_calibration.sql",
            "db/migration/V8__enterprise_modules_schema.sql"
        )) {
            var stream = getClass().getClassLoader().getResourceAsStream(migration);
            if (stream != null) {
                String sql = new String(stream.readAllBytes()).replaceAll("(?m)^--.*$", "");
                for (String stmt : sql.split(";")) {
                    String t = stmt.trim();
                    if (!t.isEmpty()) {
                        jdbcTemplate.execute(t);
                    }
                }
            }
        }

        jdbcTemplate.update("""
            MERGE INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at)
            KEY(id) VALUES ('ten_opes_cm', 'Tenant Alpha CM', 'owner@alpha.cm', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)
            """);
        jdbcTemplate.update("""
            MERGE INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at)
            KEY(id) VALUES ('ten_other_ne', 'Tenant Beta NE', 'owner@beta.ne', 'XOF', 'NE', 'Africa/Niamey', 'ACTIVE', CURRENT_TIMESTAMP)
            """);
        jdbcTemplate.update("""
            MERGE INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            KEY(id) VALUES ('st_rel_a', 'ten_opes_cm', 'OPF-REL-A', 'Release Station A', 'Douala', 'FCFA', 'Multi-Pump Pro', 55000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """);
        jdbcTemplate.update("""
            MERGE INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            KEY(id) VALUES ('st_rel_b', 'ten_opes_cm', 'OPF-REL-B', 'Release Station B', 'Yaounde', 'FCFA', 'Multi-Pump Pro', 55000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """);
        jdbcTemplate.update("""
            MERGE INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            KEY(id) VALUES ('st_tenant_b', 'ten_other_ne', 'OPF-NE-01', 'Niamey Foreign Station', 'Niamey', 'XOF', 'Starter Station', 25000, 0.1900, 'Africa/Niamey', CURRENT_TIMESTAMP)
            """);
        jdbcTemplate.update("""
            MERGE INTO fuel_tanks (id, station_id, name, grade, capacity_litres, book_volume_litres, last_dip_litres, unit_cost_fcfa, version)
            KEY(id) VALUES ('tk_rel_super', 'st_rel_a', 'Tank Super A', 'SUPER', 30000.00, 25000.00, 25000.00, 745, 0)
            """);
        jdbcTemplate.update("""
            MERGE INTO fuel_tanks (id, station_id, name, grade, capacity_litres, book_volume_litres, last_dip_litres, unit_cost_fcfa, version)
            KEY(id) VALUES ('tk_rel_b_super', 'st_rel_b', 'Tank Super B', 'SUPER', 30000.00, 15000.00, 15000.00, 745, 0)
            """);
        jdbcTemplate.update("""
            MERGE INTO employees (id, station_id, full_name, role, phone, shift_window, clocked_in, base_salary_fcfa, cumulative_variance_fcfa, version)
            KEY(id) VALUES ('emp_rel_att', 'st_rel_a', 'Release Attendant', 'ATTENDANT', '+237677000111', '06:00 - 14:00', TRUE, 145000, 0, 0)
            """);
    }

    @Test
    void T003_crossTenantIdorAttackBlocked() throws Exception {
        // Tenant A JWT attempts to mutate/read Tenant B station (st_tenant_b)
        mockMvc.perform(post("/api/v1/inventory/tanks")
                .with(jwt().jwt(j -> j
                    .subject("auth0|tenant-a-owner")
                    .claim("https://opesfuel.com/tenant_id", "ten_opes_cm")
                    .claim("https://opesfuel.com/roles", List.of("OWNER"))
                ))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_tenant_b","name":"IDOR Tank","grade":"SUPER","capacityLitres":20000,"bookVolumeLitres":5000,"unitCostFcfa":745}
                    """))
            .andExpect(status().isForbidden());
    }

    @Test
    void T004_attendantBlockedFromEmployeePayrollAndPayslips() throws Exception {
        mockMvc.perform(get("/api/v1/workforce/payroll")
                .with(user("att_01").roles("ATTENDANT")))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/workforce/payroll/payslips/emp_rel_att")
                .with(user("att_01").roles("ATTENDANT")))
            .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/workforce/employees")
                .with(user("att_01").roles("ATTENDANT")))
            .andExpect(status().isForbidden());
    }

    @Test
    void T005_makerCheckerSelfApprovalRejected() throws Exception {
        MvcResult createRes = mockMvc.perform(post("/api/v1/enterprise/approvals")
                .with(user("owner_maker").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_rel_a\",\"requestType\":\"PRICE_CHANGE\",\"title\":\"Adjust Super +15 FCFA\",\"amountFcfa\":15}"))
            .andExpect(status().isOk())
            .andReturn();
        String approvalId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asText();

        // Same principal trying to approve own request MUST be rejected (409 Conflict)
        mockMvc.perform(patch("/api/v1/enterprise/approvals/" + approvalId)
                .with(user("owner_maker").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"APPROVED\"}"))
            .andExpect(status().isConflict());

        // Independent second checker CAN approve
        mockMvc.perform(patch("/api/v1/enterprise/approvals/" + approvalId)
                .with(user("acct_checker").roles("ACCOUNTANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"APPROVED\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("APPROVED"));
    }

    @Test
    void T006_countrySwitchCameroonVsNigerSeparateTaxAndCurrencyPacks() throws Exception {
        mockMvc.perform(get("/api/v1/enterprise/country-packs/CM")
                .with(user("owner_01").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.currency").value("XAF"))
            .andExpect(jsonPath("$.vatRatePct").value(19.25))
            .andExpect(jsonPath("$.socialAuthority").value("CNPS"));

        mockMvc.perform(get("/api/v1/enterprise/country-packs/NE")
                .with(user("owner_01").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.currency").value("XOF"))
            .andExpect(jsonPath("$.vatRatePct").value(19.0))
            .andExpect(jsonPath("$.socialAuthority").value("CNSS-NE"));
    }

    @Test
    void T008_and_T009_wrongGradeAndUnsafeUllageDeliveryBlocked() throws Exception {
        // Create GASOIL PO then attempt to deliver it into SUPER tank (T008)
        MvcResult poRes = mockMvc.perform(post("/api/v1/inventory/purchase-orders")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_rel_a\",\"supplierName\":\"SCDP\",\"grade\":\"GASOIL\",\"orderedLitres\":2000,\"unitCostFcfa\":720}"))
            .andExpect(status().isCreated())
            .andReturn();
        String gasoilPoId = objectMapper.readTree(poRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/inventory/deliveries")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"tankId":"tk_rel_super","purchaseOrderId":"%s","supplierName":"SCDP","bolLitres":2000,"actualReceivedLitres":2000,"unitCostFcfa":720}
                    """.formatted(gasoilPoId)))
            .andExpect(status().isBadRequest());

        // Attempt to offload 9,000 L into tank with only 5,000 L remaining ullage (T009 -> 409 Conflict Domain Invariant Violation)
        mockMvc.perform(post("/api/v1/inventory/deliveries")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"tankId":"tk_rel_super","supplierName":"SCDP","bolLitres":9000,"actualReceivedLitres":9000,"unitCostFcfa":745}
                    """))
            .andExpect(status().isConflict());
    }

    @Test
    void T011_nozzleAndTankCrossStationMismatchBlocked() throws Exception {
        // Attempt to create a pump on st_rel_a linked to a tank belonging to st_rel_b
        mockMvc.perform(post("/api/v1/forecourt/pumps")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_rel_a","tankId":"tk_rel_b_super","code":"P-XST","grade":"SUPER","totalizerLitres":0,"unitPriceFcfa":840}
                    """))
            .andExpect(status().isBadRequest());
    }

    @Test
    void T013_T018_and_T020_rolloverCashThresholdAndOpenShiftBlockingPeriodClose() throws Exception {
        String code = "P-R" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        MvcResult pumpRes = mockMvc.perform(post("/api/v1/forecourt/pumps")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_rel_a","tankId":"tk_rel_super","code":"%s","grade":"SUPER","totalizerLitres":999500,"unitPriceFcfa":840}
                    """.formatted(code)))
            .andExpect(status().isCreated())
            .andReturn();
        String pumpId = objectMapper.readTree(pumpRes.getResponse().getContentAsString()).get("id").asText();

        // T013: Approved meter rollover while pump is IDLE succeeds without phantom sales
        mockMvc.perform(post("/api/v1/forecourt/pumps/" + pumpId + "/meter-rollover")
                .with(user("manager_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"newTotalizerLitres\":0,\"rolloverMaxLitres\":999999,\"approvalRef\":\"APR-ROLL-01\",\"reason\":\"6-digit mechanical counter rollover\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ROLLOVER_APPLIED"))
            .andExpect(jsonPath("$.newTotalizerLitres").value(0));

        // Open shift on pump
        MvcResult shiftRes = mockMvc.perform(post("/api/v1/forecourt/shifts/open")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_rel_a","pumpId":"%s","attendantId":"emp_rel_att"}
                    """.formatted(pumpId)))
            .andExpect(status().isCreated())
            .andReturn();
        String shiftId = objectMapper.readTree(shiftRes.getResponse().getContentAsString()).get("id").asText();

        // T013: Meter rollover blocked while shift is OPEN
        mockMvc.perform(post("/api/v1/forecourt/pumps/" + pumpId + "/meter-rollover")
                .with(user("manager_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"newTotalizerLitres\":0,\"rolloverMaxLitres\":999999,\"approvalRef\":\"APR-ROLL-02\",\"reason\":\"Attempt during open shift\"}"))
            .andExpect(status().isConflict());

        // T020: Closing fiscal period while shift is OPEN MUST fail (409 Conflict)
        mockMvc.perform(post("/api/v1/accounting/periods/close")
                .with(user("acct_01").roles("ACCOUNTANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_rel_a\",\"periodKey\":\"2026-10\"}"))
            .andExpect(status().isConflict());

        // T018: Closing shift with 84,000 FCFA shortage WITHOUT varianceReason MUST fail (400)
        mockMvc.perform(post("/api/v1/forecourt/shifts/" + shiftId + "/close")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"closingMeterLitres\":100,\"cashFcfa\":0,\"mobileMoneyFcfa\":0,\"cardFcfa\":0,\"fleetCreditFcfa\":0}"))
            .andExpect(status().isBadRequest());

        // T018: Providing explicit varianceReason allows controlled close & supervisor audit
        mockMvc.perform(post("/api/v1/forecourt/shifts/" + shiftId + "/close")
                .with(user("manager_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"closingMeterLitres\":100,\"cashFcfa\":0,\"mobileMoneyFcfa\":0,\"cardFcfa\":0,\"fleetCreditFcfa\":0,\"varianceReason\":\"Verified MoMo terminal outage; ticket #402 logged\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CLOSED"));
    }

    @Test
    void T016_and_T017_pendingWebhookAndDuplicateOutOfOrderIdempotency() throws Exception {
        MvcResult invRes = mockMvc.perform(post("/api/v1/billing/invoices/generate")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"billingPeriod\":\"2027-01\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        String invoiceId = objectMapper.readTree(invRes.getResponse().getContentAsString()).get("id").asText();

        MvcResult chkRes = mockMvc.perform(post("/api/v1/billing/invoices/" + invoiceId + "/checkout")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"provider\":\"MTN_MOMO\",\"phoneNumber\":\"+237677112233\"}"))
            .andExpect(status().isOk())
            .andReturn();
        String extRef = objectMapper.readTree(chkRes.getResponse().getContentAsString()).get("externalRef").asText();

        // T016: PENDING webhook must NOT mark invoice PAID
        mockMvc.perform(post("/api/v1/public/webhooks/payments/mtn_momo")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"externalRef\":\"" + extRef + "\",\"status\":\"PENDING\",\"transactionId\":\"MTN-001\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING"));

        String statusAfterPending = jdbcTemplate.queryForObject(
            "SELECT status FROM billing_invoices WHERE id = ?", String.class, invoiceId
        );
        assertNotEquals("PAID", statusAfterPending);

        // First PAID webhook settles invoice once
        mockMvc.perform(post("/api/v1/public/webhooks/payments/mtn_momo")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"externalRef\":\"" + extRef + "\",\"status\":\"PAID\",\"transactionId\":\"MTN-001\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PAID"))
            .andExpect(jsonPath("$.idempotentReplay").value(false));

        // T017: Duplicate PAID or late out-of-order FAILED replay must remain PAID and idempotent
        mockMvc.perform(post("/api/v1/public/webhooks/payments/mtn_momo")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"externalRef\":\"" + extRef + "\",\"status\":\"FAILED\",\"transactionId\":\"MTN-001\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PAID"))
            .andExpect(jsonPath("$.idempotentReplay").value(true));
    }
}
