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

import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class FleetClientPortalRbacTests {

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbcTemplate;
    @Autowired ObjectMapper objectMapper;

    private String stationId;
    private String accountAId;
    private String accountBId;
    private String otherMomoTxId;
    private String portalEmail;

    @BeforeEach
    void setupFixtures() throws Exception {
        try {
            jdbcTemplate.execute("ALTER TABLE event_publication ALTER COLUMN serialized_event CLOB");
        } catch (Exception ignored) {}

        for (String mig : new String[]{
            "db/migration/V7__prelaunch_modules_hr_audit_safe_calibration.sql",
            "db/migration/V14__cameroon_momo_payments.sql",
            "db/migration/V17__fleet_client_portal.sql"
        }) {
            var stream = getClass().getClassLoader().getResourceAsStream(mig);
            if (stream != null) {
                String sql = new String(stream.readAllBytes()).replaceAll("(?m)^--.*$", "");
                for (String stmt : sql.split(";")) {
                    String t = stmt.trim();
                    if (!t.isEmpty()) {
                        try {
                            jdbcTemplate.execute(t);
                        } catch (Exception ignored) {}
                    }
                }
            }
        }

        jdbcTemplate.update("""
            MERGE INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at)
            KEY(id) VALUES ('ten_opes_cm', 'OpesFuel Test Tenant', 'owner@opesfuel.com', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)
            """);

        String suffix = UUID.randomUUID().toString().substring(0, 6);
        stationId = "st_fltp_" + suffix;
        jdbcTemplate.update("""
            INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            VALUES (?, 'ten_opes_cm', ?, 'Fleet Portal Station', 'Douala', 'FCFA', 'Enterprise Network', 85000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """, stationId, "FP-" + suffix.toUpperCase());

        accountAId = "flt_a_" + suffix;
        accountBId = "flt_b_" + suffix;
        jdbcTemplate.update("""
            INSERT INTO fleet_accounts (id, tenant_id, company_name, tax_id, credit_limit_fcfa, balance_owed_fcfa, status, version)
            VALUES (?, 'ten_opes_cm', ?, ?, 5000000, 1200000, 'ACTIVE', 0)
            """, accountAId, "Atlas Freight " + suffix, "M91A" + suffix.toUpperCase());
        jdbcTemplate.update("""
            INSERT INTO fleet_accounts (id, tenant_id, company_name, tax_id, credit_limit_fcfa, balance_owed_fcfa, status, version)
            VALUES (?, 'ten_opes_cm', ?, ?, 4000000, 900000, 'ACTIVE', 0)
            """, accountBId, "Rival Logistics " + suffix, "M91B" + suffix.toUpperCase());

        jdbcTemplate.update("""
            INSERT INTO fleet_vehicles (id, account_id, plate_number, driver_name, allowed_grade, monthly_litre_cap, active, created_at)
            VALUES (?, ?, 'LT-701-FP', 'Paul Ndongo', 'GASOIL', 2500, TRUE, CURRENT_TIMESTAMP)
            """, "veh_a_" + suffix, accountAId);
        jdbcTemplate.update("""
            INSERT INTO fleet_vehicles (id, account_id, plate_number, driver_name, allowed_grade, monthly_litre_cap, active, created_at)
            VALUES (?, ?, 'LT-999-FP', 'Rival Driver', 'GASOIL', 1500, TRUE, CURRENT_TIMESTAMP)
            """, "veh_b_" + suffix, accountBId);

        jdbcTemplate.update("""
            INSERT INTO fleet_transactions (id, account_id, station_id, vehicle_plate, driver_name, grade, litres, amount_fcfa, created_at)
            VALUES (?, ?, ?, 'LT-701-FP', 'Paul Ndongo', 'GASOIL', 100.0, 82800, CURRENT_TIMESTAMP)
            """, "ftx_a_" + suffix, accountAId, stationId);
        jdbcTemplate.update("""
            INSERT INTO fleet_transactions (id, account_id, station_id, vehicle_plate, driver_name, grade, litres, amount_fcfa, created_at)
            VALUES (?, ?, ?, 'LT-999-FP', 'Rival Driver', 'SUPER', 50.0, 42000, CURRENT_TIMESTAMP)
            """, "ftx_b_" + suffix, accountBId, stationId);

        otherMomoTxId = "momo_other_" + suffix;
        jdbcTemplate.update("""
            INSERT INTO momo_transactions (
                id, tenant_id, target_type, target_id, provider, environment, msisdn, amount_fcfa,
                api_currency, external_id, reference_id, status, created_by, created_at, updated_at, expires_at
            ) VALUES (?, 'ten_opes_cm', 'FLEET_BALANCE', ?, 'MTN_MOMO', 'sandbox', '237677000111', 300000,
                      'XAF', ?, ?, 'SUCCESSFUL', 'rival@bollore.cm', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, otherMomoTxId, accountBId, "EXT-" + suffix, "REF-" + suffix);

        portalEmail = "fleetmgr-" + suffix + "@atlas.cm";
    }

    @Test
    void fleetClientWorkflowsAreStrictlyScopedAndSessionRevocationWorks() throws Exception {
        // 1. Owner invites Fleet Client user for Account A
        mvc.perform(post("/api/v1/fleet/accounts/{id}/portal-users", accountAId)
                .with(user("owner@opesfuel.com").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"%s","fullName":"Marc Fotso","phone":"+237677112233","temporaryPassword":"InitialPassword1!"}
                    """.formatted(portalEmail)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.fleetAccountId").value(accountAId));

        // 2. Fleet Client signs in via public endpoint and receives fltp_* token
        MvcResult loginRes = mvc.perform(post("/api/v1/public/fleet-portal/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"%s","password":"InitialPassword1!"}
                    """.formatted(portalEmail)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("FLEET_CLIENT"))
            .andExpect(jsonPath("$.user.fleetAccountId").value(accountAId))
            .andReturn();

        Map<?, ?> loginBody = objectMapper.readValue(loginRes.getResponse().getContentAsString(), Map.class);
        String token = String.valueOf(loginBody.get("token"));

        // 3. Allowed: Read own dashboard, fuelings (only Account A!), vehicles with MTD usage, monthly VAT statement, payments
        mvc.perform(get("/api/v1/fleet-portal/dashboard").header("X-Fleet-Token", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fleetAccountId").value(accountAId))
            .andExpect(jsonPath("$.utilizationPercent").value(24.0))
            .andExpect(jsonPath("$.activeVehicleCount").value(1))
            .andExpect(jsonPath("$.frozenVehicleCount").value(0));

        mvc.perform(get("/api/v1/fleet-portal/fuelings").param("grade", "GASOIL").header("X-Fleet-Token", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].vehicle_plate").value("LT-701-FP"));

        mvc.perform(get("/api/v1/fleet-portal/vehicles").header("X-Fleet-Token", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].plate_number").value("LT-701-FP"))
            .andExpect(jsonPath("$[0].mtdLitres").value(100.0));

        String period = YearMonth.now(ZoneOffset.UTC).toString();
        mvc.perform(get("/api/v1/fleet-portal/statements/{period}", period).header("X-Fleet-Token", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalTtcFcfa").value(82800))
            .andExpect(jsonPath("$.gradeBreakdown[0].grade").value("GASOIL"));

        mvc.perform(get("/api/v1/fleet-portal/payments").header("X-Fleet-Token", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));

        // 4. Allowed: Freeze OWN vehicle card & update limits
        mvc.perform(put("/api/v1/fleet-portal/vehicles/LT-701-FP/limits")
                .header("X-Fleet-Token", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"cardNumber":"CRD-701","dailyLitreCap":120,"monthlyLitreCap":2000,"allowedGradesCsv":"GASOIL","active":false}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.active").value(false));

        // 5. Blocked (403): Cannot modify another fleet account's vehicle!
        mvc.perform(put("/api/v1/fleet-portal/vehicles/LT-999-FP/limits")
                .header("X-Fleet-Token", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"cardNumber":"HACK","dailyLitreCap":1,"active":false}
                    """))
            .andExpect(status().isForbidden());

        // 6. Blocked (403): Strictly isolated from all tenant/platform internal endpoints & other MoMo tx status
        mvc.perform(get("/api/v1/accounting/reports").param("stationId", stationId).header("X-Fleet-Token", token))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/workforce/payroll").param("stationId", stationId).header("X-Fleet-Token", token))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/fleet/accounts").header("X-Fleet-Token", token))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/payments/momo/initiate")
                .header("X-Fleet-Token", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"provider":"MTN_MOMO","phoneNumber":"+237677112233","amountFcfa":50000,"targetType":"SAAS_INVOICE","targetId":"inv_1"}
                    """))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/payments/momo/{txId}/status", otherMomoTxId).header("X-Fleet-Token", token))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/platform-admin/governance/directory/resolve")
                .header("X-Fleet-Token", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"identifier\":\"owner@opesfuel.com\"}"))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/audit/logs")
                .header("X-Fleet-Token", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"action\":\"SPOOF\",\"entityType\":\"TENANT\",\"entityId\":\"x\",\"summary\":\"spoof\"}"))
            .andExpect(status().isForbidden());

        // 7. Password change works and invalidates old password
        mvc.perform(post("/api/v1/fleet-portal/change-password")
                .header("X-Fleet-Token", token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"currentPassword":"InitialPassword1!","newPassword":"RotatedPassword2@"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.updated").value(true));

        mvc.perform(post("/api/v1/public/fleet-portal/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"email":"%s","password":"InitialPassword1!"}
                    """.formatted(portalEmail)))
            .andExpect(status().isUnauthorized());

        // 8. Server-side logout revokes session token immediately
        mvc.perform(post("/api/v1/fleet-portal/logout").header("X-Fleet-Token", token))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.signedOut").value(true));

        mvc.perform(get("/api/v1/fleet-portal/dashboard").header("X-Fleet-Token", token))
            .andExpect(status().isUnauthorized());
    }
}
