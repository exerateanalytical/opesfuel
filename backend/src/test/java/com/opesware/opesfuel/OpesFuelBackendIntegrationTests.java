package com.opesware.opesfuel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.test.context.support.WithMockUser;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OpesFuelBackendIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void seedBaseSchemaAndFixtures() {
        // Match Flyway V4 PostgreSQL TEXT column for event_publication.serialized_event in H2 ddl-auto test mode
        jdbcTemplate.execute("ALTER TABLE event_publication ALTER COLUMN serialized_event CLOB");
        jdbcTemplate.execute("""
            CREATE TABLE IF NOT EXISTS idempotency_records (
                idempotency_key VARCHAR(64) NOT NULL,
                principal_id VARCHAR(160) NOT NULL,
                endpoint VARCHAR(160) NOT NULL,
                request_hash VARCHAR(64) NOT NULL,
                response_code INT NOT NULL,
                response_body CLOB NOT NULL,
                status VARCHAR(16) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                PRIMARY KEY (principal_id, idempotency_key)
            )
            """);

        jdbcTemplate.update("""
            MERGE INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at)
            KEY(id) VALUES ('ten_opes_cm', 'OpesFuel Test Tenant', 'owner@opesfuel.com', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)
            """);

        String[][] accounts = {
            {"1010", "Cash on Hand & Safe", "ASSET"},
            {"1020", "Mobile Money Clearing (OM/MoMo)", "ASSET"},
            {"1030", "Bank Operating Account", "ASSET"},
            {"1100", "Fleet Accounts Receivable", "ASSET"},
            {"1200", "Fuel & Lubricant Inventory", "ASSET"},
            {"2010", "Supplier Accounts Payable", "LIABILITY"},
            {"2200", "Fuel VAT & Excise Payable", "LIABILITY"},
            {"3010", "Owner Paid-In Capital", "EQUITY"},
            {"4010", "Forecourt Fuel Sales Revenue", "REVENUE"},
            {"4020", "Lubricants & Shop Revenue", "REVENUE"},
            {"5010", "Cost of Fuel Sold (COGS)", "EXPENSE"},
            {"6010", "Station Operating Expenses", "EXPENSE"},
            {"6100", "Shift Cash Over / Short Variance", "EXPENSE"}
        };
        for (String[] a : accounts) {
            jdbcTemplate.update("MERGE INTO accounts (code, name, account_type) KEY(code) VALUES (?, ?, ?)", a[0], a[1], a[2]);
        }

        jdbcTemplate.update("""
            MERGE INTO institutional_fuel_catalog
            (grade, label, category, unit_label, default_capacity_litres, default_opening_litres, default_unit_cost_fcfa, default_selling_price_fcfa)
            KEY(grade) VALUES ('SUPER', 'Super Petrol (SP95)', 'LIQUID_FUEL', 'Litres', 40000, 24500, 745, 840)
            """);
        jdbcTemplate.update("""
            MERGE INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            KEY(id) VALUES ('st_test_1', 'ten_opes_cm', 'OPF-TST-01', 'Test Station Alpha', 'Douala', 'FCFA', 'Starter Station', 25000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """);
    }

    @Test
    void actuatorHealthAndPublicCatalogWorkWithoutAuth() throws Exception {
        mockMvc.perform(get("/actuator/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/api/v1/catalog/institutional-fuels"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].code").value("SUPER"))
            .andExpect(jsonPath("$[0].defaultUnitCostFcfa").value(745));

        // Private endpoint rejects unauthenticated callers
        mockMvc.perform(get("/api/v1/stations"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void publicLeadPersistsAndValidatesPumpCount() throws Exception {
        mockMvc.perform(post("/api/v1/public/leads")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"fullName":"Paul Biya","stationName":"Test","email":"paul@example.com","phone":"+237600000000","pumpCount":0}
                    """))
            .andExpect(status().isUnprocessableEntity())
            .andExpect(jsonPath("$.errors.pumpCount").exists());

        MvcResult res = mockMvc.perform(post("/api/v1/public/leads")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"fullName":"Amina Diallo","stationName":"Bonanjo Hub","email":"amina@example.com","phone":"+237655810932","pumpCount":8,"selectedPlan":"Multi-Pump Pro"}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.referenceId", startsWith("LEAD-")))
            .andReturn();

        String refId = objectMapper.readTree(res.getResponse().getContentAsString()).get("referenceId").asText();
        Integer count = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM demo_leads WHERE reference_id = ?", Integer.class, refId);
        assertEquals(1, count);
    }

    @Test
    void apiKeyEnforcesLeastPrivilegeScopesAndCannotEscalateToOwner() throws Exception {
        MvcResult issued = mockMvc.perform(post("/api/v1/platform/api-keys")
                .with(user("owner_1").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"label":"Read-Only ERP Sync","scopes":["accounting:read"]}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.rawKey", startsWith("opf_live_")))
            .andReturn();

        String rawKey = objectMapper.readTree(issued.getResponse().getContentAsString()).get("rawKey").asText();

        // Read-only accounting key CAN read reports (authenticating strictly via X-API-Key!)
        mockMvc.perform(get("/api/v1/accounting/reports?stationId=st_test_1")
                .header("X-API-Key", rawKey))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.trialBalanceBalanced").value(true));

        // Read-only accounting key CANNOT create API keys or post expenses (no ROLE_OWNER escalation!)
        mockMvc.perform(post("/api/v1/platform/api-keys")
                .header("X-API-Key", rawKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"label":"Escalated","scopes":["platform:admin"]}
                    """))
            .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/accounting/expenses")
                .header("X-API-Key", rawKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_test_1","category":"UTILITIES","description":"Power","amountFcfa":50000,"paymentSource":"BANK"}
                    """))
            .andExpect(status().isForbidden());
    }

    @Test
    void attendantCannotQueryAllStationsOrClockOutAnotherEmployee() throws Exception {
        String empId = "emp_mgr_" + UUID.randomUUID().toString().substring(0, 6);
        jdbcTemplate.update("""
            INSERT INTO employees (id, station_id, auth0_sub, full_name, role, phone, shift_window, clocked_in, base_salary_fcfa, cumulative_variance_fcfa, version)
            VALUES (?, 'st_test_1', 'auth0|manager_1', 'Amina Manager', 'MANAGER', '+237655000000', '08:00 - 17:00', FALSE, 300000, 0, 0)
            """, empId);

        mockMvc.perform(get("/api/v1/forecourt/pumps?stationId=ALL")
                .with(jwt().jwt(j -> j
                    .subject("auth0|attendant_1")
                    .claim("https://opesfuel.com/roles", List.of("ATTENDANT"))
                    .claim("https://opesfuel.com/tenant_id", "ten_opes_cm"))
                    .authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ATTENDANT"))))
            .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/workforce/employees/" + empId + "/attendance")
                .with(jwt().jwt(j -> j
                    .subject("auth0|attendant_1")
                    .claim("https://opesfuel.com/roles", List.of("ATTENDANT"))
                    .claim("https://opesfuel.com/tenant_id", "ten_opes_cm"))
                    .authorities(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ATTENDANT"))))
            .andExpect(status().isForbidden());
    }

    @Test
    @WithMockUser(username = "owner_ai", roles = {"OWNER"})
    void aiPaywallPreventsFreeEnterpriseBypassAndReturns402WhenUnsubscribed() throws Exception {
        // Starter Station cannot claim INCLUDED_ENTERPRISE for 0 FCFA
        mockMvc.perform(post("/api/v1/ai/subscription/activate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_test_1","active":true,"planCode":"INCLUDED_ENTERPRISE"}
                    """))
            .andExpect(status().isConflict());

        // Unsubscribed AI analyze returns 402 Payment Required
        mockMvc.perform(post("/api/v1/ai/analyze")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_test_1","metricsSnapshot":{"revenue":100000}}
                    """))
            .andExpect(status().isPaymentRequired());
    }

    @Test
    @WithMockUser(username = "owner_wh", roles = {"OWNER"})
    void webhookBlocksSsrfTargetsAndReturnsOneTimeSecret() throws Exception {
        mockMvc.perform(post("/api/v1/platform/webhooks")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"targetUrl":"http://169.254.169.254/latest/meta-data/","subscribedEvents":["ShiftClosedEvent"]}
                    """))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/platform/webhooks")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"targetUrl":"https://localhost:8080/internal","subscribedEvents":["ShiftClosedEvent"]}
                    """))
            .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/platform/webhooks")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"targetUrl":"https://hooks.example.com/opesfuel","subscribedEvents":["ShiftClosedEvent"]}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.signingSecret", startsWith("whsec_")));
    }

    @Test
    @WithMockUser(username = "owner_idem", roles = {"OWNER"})
    void idempotencyReplaysMatchingPayloadAndRejectsReuseConflict() throws Exception {
        String key = "idem-" + UUID.randomUUID();
        String payload1 = """
            {"stationId":"st_test_1","category":"UTILITIES","description":"ENEO Bill","amountFcfa":75000,"paymentSource":"BANK"}
            """;
        String payload2 = """
            {"stationId":"st_test_1","category":"UTILITIES","description":"Different Bill","amountFcfa":99000,"paymentSource":"BANK"}
            """;

        MvcResult first = mockMvc.perform(post("/api/v1/accounting/expenses")
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload1))
            .andExpect(status().isCreated())
            .andReturn();
        String firstId = objectMapper.readTree(first.getResponse().getContentAsString()).get("id").asText();

        // Exact replay returns identical body & Idempotency-Replayed header
        mockMvc.perform(post("/api/v1/accounting/expenses")
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload1))
            .andExpect(status().isCreated())
            .andExpect(header().string("Idempotency-Replayed", "true"))
            .andExpect(jsonPath("$.id").value(firstId));

        // Same key with different payload -> 409 Conflict
        mockMvc.perform(post("/api/v1/accounting/expenses")
                .header("Idempotency-Key", key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload2))
            .andExpect(status().isConflict());

        // Overlong key (>64 chars) -> 400 Bad Request
        mockMvc.perform(post("/api/v1/accounting/expenses")
                .header("Idempotency-Key", "k".repeat(70))
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload1))
            .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "owner_ops", roles = {"OWNER"})
    void endToEndTankUllageShiftWacCogsZeroLitreAndExpenseVoiding() throws Exception {
        // 1. Create Tank (capacity 20,000 L, opening 15,000 L, WAC 700 FCFA)
        MvcResult tankRes = mockMvc.perform(post("/api/v1/inventory/tanks")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_test_1","name":"Test Super Tank","grade":"SUPER","capacityLitres":20000,"bookVolumeLitres":15000,"unitCostFcfa":700}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("NOMINAL"))
            .andExpect(jsonPath("$.varianceLitres").value(0))
            .andReturn();
        String tankId = objectMapper.readTree(tankRes.getResponse().getContentAsString()).get("id").asText();

        // 2. Tank delivery exceeding ullage (6,000 L > 5,000 L available) must be REJECTED (409)
        mockMvc.perform(post("/api/v1/inventory/deliveries")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"tankId":"%s","supplierName":"SCDP","bolLitres":6000,"actualReceivedLitres":6000,"unitCostFcfa":720}
                    """.formatted(tankId)))
            .andExpect(status().isConflict());

        // 3. Zero-litre dipstick reading (0 L) is allowed
        mockMvc.perform(post("/api/v1/inventory/dipsticks")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"tankId":"%s","measuredLitres":14950}
                    """.formatted(tankId)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.varianceLitres").value(-50.00));

        // 4. Create Pump + Attendant, open shift, close with 0 L (must not fail!), then open & close with 100 L
        MvcResult pumpRes = mockMvc.perform(post("/api/v1/forecourt/pumps")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_test_1","tankId":"%s","code":"PT-%s","grade":"SUPER","totalizerLitres":1000,"unitPriceFcfa":840}
                    """.formatted(tankId, UUID.randomUUID().toString().substring(0, 4))))
            .andExpect(status().isCreated())
            .andReturn();
        String pumpId = objectMapper.readTree(pumpRes.getResponse().getContentAsString()).get("id").asText();

        MvcResult empRes = mockMvc.perform(post("/api/v1/workforce/employees")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_test_1","fullName":"Koffi Attendant","role":"ATTENDANT","phone":"+237677112233","baseSalaryFcfa":150000}
                    """))
            .andExpect(status().isCreated())
            .andReturn();
        String empId = objectMapper.readTree(empRes.getResponse().getContentAsString()).get("id").asText();

        MvcResult zeroShiftRes = mockMvc.perform(post("/api/v1/forecourt/shifts/open")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_test_1","pumpId":"%s","attendantId":"%s"}
                    """.formatted(pumpId, empId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.attendantName").value("Koffi Attendant"))
            .andReturn();
        String zeroShiftId = objectMapper.readTree(zeroShiftRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/forecourt/shifts/" + zeroShiftId + "/close")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"closingMeterLitres":1000,"cashFcfa":0,"mobileMoneyFcfa":0,"cardFcfa":0,"fleetCreditFcfa":0}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.litresSold").value(0));

        // 5. Partial station PATCH works with just city
        mockMvc.perform(patch("/api/v1/stations/st_test_1")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"city":"Kribi"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.city").value("Kribi"));

        // 6. Fleet account HOLD check
        MvcResult fleetRes = mockMvc.perform(post("/api/v1/fleet/accounts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"companyName":"Hold Logistics","taxId":"TAX-%s","creditLimitFcfa":1000000}
                    """.formatted(UUID.randomUUID().toString().substring(0, 6))))
            .andExpect(status().isCreated())
            .andReturn();
        String fleetId = objectMapper.readTree(fleetRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(patch("/api/v1/fleet/accounts/" + fleetId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"HOLD"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("HOLD"));

        mockMvc.perform(post("/api/v1/fleet/vouchers")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"accountId":"%s","stationId":"st_test_1","vehiclePlate":"LT-123-AA","driverName":"Jean","grade":"SUPER","litres":50}
                    """.formatted(fleetId)))
            .andExpect(status().isConflict());

        // 7. Re-running institutional onboarding setup twice is idempotent
        String setupBody = """
            {"items":[{"grade":"SUPER","tankName":"Onboarding Super","capacityLitres":30000,"openingLitres":10000,"unitCostFcfa":745,"sellingPriceFcfa":840,"nozzleCount":1}]}
            """;
        mockMvc.perform(post("/api/v1/stations/st_test_1/onboarding-setup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(setupBody))
            .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/stations/st_test_1/onboarding-setup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(setupBody))
            .andExpect(status().isCreated());

        // 8. Financial report SQL aggregation returns balanced Trial Balance
        MvcResult reportRes = mockMvc.perform(get("/api/v1/accounting/reports?stationId=st_test_1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.trialBalanceBalanced").value(true))
            .andReturn();
        JsonNode report = objectMapper.readTree(reportRes.getResponse().getContentAsString());
        assertEquals("FCFA", report.get("currency").asText());
    }

    @Test
    @WithMockUser(username = "owner_acct", roles = {"OWNER"})
    void payrollNeverPaysCashOveragesAsBonusAndPayrollRunResetsShortages() throws Exception {
        String stId = "st_pay_" + UUID.randomUUID().toString().substring(0, 6);
        jdbcTemplate.update("""
            INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            VALUES (?, 'ten_opes_cm', ?, 'Payroll Station', 'Douala', 'FCFA', 'Starter Station', 25000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """, stId, "PAY-" + UUID.randomUUID().toString().substring(0, 5).toUpperCase());

        String empOver = "emp_over_" + UUID.randomUUID().toString().substring(0, 6);
        String empShort = "emp_short_" + UUID.randomUUID().toString().substring(0, 6);
        jdbcTemplate.update("""
            INSERT INTO employees (id, station_id, full_name, role, phone, shift_window, clocked_in, base_salary_fcfa, cumulative_variance_fcfa, version)
            VALUES (?, ?, 'Alice Overage', 'ATTENDANT', '+237600111111', '06:00 - 14:00', FALSE, 150000, 12000, 0),
                   (?, ?, 'Bob Shortage', 'ATTENDANT', '+237600222222', '06:00 - 14:00', FALSE, 150000, -5000, 0)
            """, empOver, stId, empShort, stId);

        // Clock Bob in and out to verify attendance_logs audit trail
        mockMvc.perform(post("/api/v1/workforce/employees/" + empShort + "/attendance"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.clockedIn").value(true));
        mockMvc.perform(post("/api/v1/workforce/employees/" + empShort + "/attendance"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.clockedIn").value(false));
        mockMvc.perform(get("/api/v1/workforce/employees/" + empShort + "/attendance-logs"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].clockOutAt").isNotEmpty());

        // Payslip includes CNPS estimate and shortage deduction
        mockMvc.perform(get("/api/v1/workforce/payroll/payslips/" + empShort))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.shortageDeductionFcfa").value(-5000))
            .andExpect(jsonPath("$.cnpsEmployeeFcfa").value(6300));

        mockMvc.perform(get("/api/v1/workforce/payroll?stationId=" + stId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].fullName").value("Alice Overage"))
            .andExpect(jsonPath("$[0].varianceAdjustmentFcfa").value(0))
            .andExpect(jsonPath("$[0].netPayableFcfa").value(150000))
            .andExpect(jsonPath("$[1].fullName").value("Bob Shortage"))
            .andExpect(jsonPath("$[1].varianceAdjustmentFcfa").value(-5000))
            .andExpect(jsonPath("$[1].netPayableFcfa").value(145000));

        mockMvc.perform(post("/api/v1/workforce/payroll/run")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"%s","periodLabel":"2026-11","paymentSource":"BANK"}
                    """.formatted(stId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.totalNetPaidFcfa").value(295000))
            .andExpect(jsonPath("$.totalDeductionsFcfa").value(5000));

        Long bobVar = jdbcTemplate.queryForObject("SELECT cumulative_variance_fcfa FROM employees WHERE id = ?", Long.class, empShort);
        assertEquals(0L, bobVar);
    }

    @Test
    @WithMockUser(username = "owner_ledger", roles = {"OWNER"})
    void expenseVoidingAndShopRealCogsMaintainBalancedTrialBalance() throws Exception {
        String stId = "st_fin_" + UUID.randomUUID().toString().substring(0, 6);
        jdbcTemplate.update("""
            INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            VALUES (?, 'ten_opes_cm', ?, 'Ledger Station', 'Yaounde', 'FCFA', 'Multi-Pump Pro', 55000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """, stId, "FIN-" + UUID.randomUUID().toString().substring(0, 5).toUpperCase());

        MvcResult expRes = mockMvc.perform(post("/api/v1/accounting/expenses")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"%s","category":"MAINTENANCE","description":"Nozzle seal","amountFcfa":40000,"paymentSource":"CASH_SAFE"}
                    """.formatted(stId)))
            .andExpect(status().isCreated())
            .andReturn();
        String expId = objectMapper.readTree(expRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(delete("/api/v1/accounting/expenses/" + expId))
            .andExpect(status().isNoContent());

        MvcResult itemRes = mockMvc.perform(post("/api/v1/shop/items")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"%s","sku":"OIL-TEST-1","name":"Motor Oil 5L","category":"LUBRICANT","stockQty":10,"reorderLevel":3,"unitPriceFcfa":15000,"unitCostFcfa":10000}
                    """.formatted(stId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.unitCostFcfa").value(10000))
            .andReturn();
        String itemId = objectMapper.readTree(itemRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/shop/sales")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"itemId":"%s","quantity":2,"paymentMethod":"CASH"}
                    """.formatted(itemId)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.stockQty").value(8));

        mockMvc.perform(get("/api/v1/shop/sales?stationId=" + stId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].cogsFcfa").value(20000))
            .andExpect(jsonPath("$[0].grossFcfa").value(30000));

        mockMvc.perform(post("/api/v1/shop/items/" + itemId + "/restock")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"quantity":5,"unitCostFcfa":11000}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stockQty").value(13));

        Thread.sleep(600);

        mockMvc.perform(get("/api/v1/accounting/reports?stationId=" + stId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.trialBalanceBalanced").value(true))
            .andExpect(jsonPath("$.operatingExpensesFcfa").value(0))
            .andExpect(jsonPath("$.cogsFcfa").value(20000))
            .andExpect(jsonPath("$.accountsPayableFcfa").value(55000));
    }

    @Test
    @WithMockUser(username = "owner_prod", roles = {"OWNER"})
    void allNewProductionModulesWorkEndToEnd() throws Exception {
        // 1. Tenant module
        mockMvc.perform(get("/api/v1/tenants/current"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value("ten_opes_cm"))
            .andExpect(jsonPath("$.defaultCurrency").value("FCFA"));

        // 2. Identity module (/me & staff invites)
        mockMvc.perform(get("/api/v1/identity/me"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tenantId").value("ten_opes_cm"));

        MvcResult invRes = mockMvc.perform(post("/api/v1/identity/invites")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"st_test_1","email":"newmgr@opesfuel.com","role":"MANAGER"}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.inviteToken", startsWith("opfinv_")))
            .andReturn();
        String token = objectMapper.readTree(invRes.getResponse().getContentAsString()).get("inviteToken").asText();

        mockMvc.perform(post("/api/v1/identity/invites/" + token + "/accept"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACCEPTED"));

        // 3. Billing module (plans, summary, invoice generation, Mobile Money settlement)
        mockMvc.perform(get("/api/v1/billing/summary"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.currency").value("FCFA"));

        MvcResult billInv = mockMvc.perform(post("/api/v1/billing/invoices/generate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"periodLabel":"2026-11"}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("ISSUED"))
            .andReturn();
        JsonNode billNode = objectMapper.readTree(billInv.getResponse().getContentAsString());
        String invoiceId = billNode.get("id").asText();
        long totalFcfa = billNode.get("totalFcfa").asLong();

        mockMvc.perform(post("/api/v1/billing/invoices/" + invoiceId + "/pay")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"amountFcfa":%d,"paymentChannel":"ORANGE_MONEY","providerReference":"OM-TX-994411"}
                    """.formatted(totalFcfa)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.paymentChannel").value("ORANGE_MONEY"));

        // 4. Reporting module (overview KPIs, Z-report, CSV exports)
        mockMvc.perform(get("/api/v1/reporting/overview?stationId=st_test_1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.trialBalanceBalanced").value(true));

        mockMvc.perform(get("/api/v1/reporting/z-report?stationId=st_test_1"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.currency").value("FCFA"));

        mockMvc.perform(get("/api/v1/reporting/export/trial-balance.csv?stationId=st_test_1"))
            .andExpect(status().isOk())
            .andExpect(content().string(containsString("account_code,account_name,account_type")));

        // 5. Fleet vehicles & statement + Inventory suppliers & ATG 15°C telemetry
        MvcResult fleetRes = mockMvc.perform(post("/api/v1/fleet/accounts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"companyName":"Express Fleet SA","taxId":"EXP-%s","creditLimitFcfa":2000000}
                    """.formatted(UUID.randomUUID().toString().substring(0, 6))))
            .andExpect(status().isCreated())
            .andReturn();
        String fleetId = objectMapper.readTree(fleetRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/fleet/accounts/" + fleetId + "/vehicles")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"plateNumber":"LT-900-CM","driverName":"Moussa","allowedGrade":"GASOIL","monthlyLitreCap":5000}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.plateNumber").value("LT-900-CM"));

        mockMvc.perform(get("/api/v1/fleet/accounts/" + fleetId + "/statement"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.availableCreditFcfa").value(2000000));

        mockMvc.perform(post("/api/v1/inventory/suppliers")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"name":"Tradex Depot","taxId":"M02991122","contactPhone":"+237699000000","paymentTermsDays":30}
                    """))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Tradex Depot"));

        // 6. Notifications module (async StaffInvitedEvent generated an alert!)
        Thread.sleep(400);
        mockMvc.perform(get("/api/v1/notifications?unreadOnly=true"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", not(empty())));

        // 7. Fiscal period close & lock
        String currentPeriod = java.time.YearMonth.now(java.time.ZoneOffset.UTC).toString();
        String lockStation = "st_lock_" + UUID.randomUUID().toString().substring(0, 6);
        jdbcTemplate.update("""
            INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            VALUES (?, 'ten_opes_cm', ?, 'Locked Station', 'Douala', 'FCFA', 'Starter Station', 25000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """, lockStation, "LCK-" + UUID.randomUUID().toString().substring(0, 5).toUpperCase());

        mockMvc.perform(post("/api/v1/accounting/periods/close")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"%s","periodKey":"%s"}
                    """.formatted(lockStation, currentPeriod)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("CLOSED"));

        mockMvc.perform(post("/api/v1/accounting/journals/manual")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"stationId":"%s","reference":"M-1","description":"Locked test","lines":[{"accountCode":"1010","debitFcfa":1000,"creditFcfa":0},{"accountCode":"3010","debitFcfa":0,"creditFcfa":1000}]}
                    """.formatted(lockStation)))
            .andExpect(status().isConflict());
    }

    @Test
    void authenticatedFirstTimeUserCanSelfOnboardButExistingAttendantIsBlocked() throws Exception {
        String brandNewSub = "auth0|brandnew_" + UUID.randomUUID().toString().substring(0, 6);
        String code = "SELF-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase();
        mockMvc.perform(post("/api/v1/tenants/onboard")
                .with(user(brandNewSub).roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "organizationName":"Self Onboard Petroleum",
                      "ownerName":"Paul Biya Test",
                      "ownerEmail":"paul@selfonboard.cm",
                      "stationCode":"%s",
                      "stationName":"Station Bonanjo",
                      "city":"Douala",
                      "planName":"Starter Station",
                      "monthlyFeeFcfa":25000
                    }
                    """.formatted(code)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.organizationName").value("Self Onboard Petroleum"))
            .andExpect(jsonPath("$.primaryStationCode").value(code));

        // Now the same non-owner sub is already bound to an employee -> second onboard attempt must be 403 Forbidden
        mockMvc.perform(post("/api/v1/tenants/onboard")
                .with(user(brandNewSub).roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "organizationName":"Unauthorized Second Tenant",
                      "ownerName":"Paul Biya Test",
                      "ownerEmail":"paul@selfonboard.cm",
                      "stationCode":"UNAUTH-01",
                      "stationName":"Station Rogue",
                      "city":"Yaounde",
                      "planName":"Starter Station",
                      "monthlyFeeFcfa":25000
                    }
                    """))
            .andExpect(status().isForbidden());
    }

    @Test
    void platformAdminControlPlaneEnforcesSuperAdminRbacAndManagesTenantsAndLeads() throws Exception {
        // Regular tenant OWNER must be denied access to SaaS Platform Admin control plane
        mockMvc.perform(get("/api/v1/platform-admin/overview")
                .with(user("tenant_owner").roles("OWNER")))
            .andExpect(status().isForbidden());

        // Submit a public onboarding lead
        mockMvc.perform(post("/api/v1/public/leads")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "fullName":"Samuel Eto'o Energies",
                      "stationName":"Station Bonapriso",
                      "email":"ops@bonapriso.cm",
                      "phone":"+237699112233",
                      "pumpCount":8,
                      "selectedPlan":"Multi-Pump Pro (55 000 FCFA/mo)"
                    }
                    """))
            .andExpect(status().isCreated());

        // PLATFORM_ADMIN can inspect overview, tenants, and leads
        mockMvc.perform(get("/api/v1/platform-admin/overview")
                .with(user("saas_founder").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalTenants", greaterThanOrEqualTo(1)))
            .andExpect(jsonPath("$.openLeadsCount", greaterThanOrEqualTo(1)));

        MvcResult leadsRes = mockMvc.perform(get("/api/v1/platform-admin/leads")
                .with(user("saas_founder").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", not(empty())))
            .andReturn();
        String leadId = objectMapper.readTree(leadsRes.getResponse().getContentAsString()).get(0).get("id").asText();

        mockMvc.perform(patch("/api/v1/platform-admin/leads/" + leadId + "/status")
                .with(user("saas_founder").roles("PLATFORM_ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"QUALIFIED"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("QUALIFIED"));

        // Suspend and reactivate a newly onboarded tenant
        MvcResult onboardRes = mockMvc.perform(post("/api/v1/tenants/onboard")
                .with(user("owner_new_2").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "organizationName":"Suspend Test Oil",
                      "ownerName":"Marie",
                      "ownerEmail":"marie@suspend.cm",
                      "stationCode":"SUS-01",
                      "stationName":"Station Limbe",
                      "city":"Limbe",
                      "planName":"Starter Station",
                      "monthlyFeeFcfa":25000
                    }
                    """))
            .andExpect(status().isCreated())
            .andReturn();
        String newTenantId = objectMapper.readTree(onboardRes.getResponse().getContentAsString()).get("tenantId").asText();

        mockMvc.perform(patch("/api/v1/platform-admin/tenants/" + newTenantId + "/status")
                .with(user("saas_founder").roles("PLATFORM_ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"SUSPENDED"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("SUSPENDED"));

        mockMvc.perform(patch("/api/v1/platform-admin/tenants/" + newTenantId + "/status")
                .with(user("saas_founder").roles("PLATFORM_ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"status":"ACTIVE"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE"));
    }
}
