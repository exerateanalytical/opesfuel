package com.opesware.opesfuel;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AttendantRbacWorkflowTests {

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbcTemplate;

    private String stationId;
    private String employeeId;

    @BeforeEach
    void setupFixtures() throws Exception {
        try {
            jdbcTemplate.execute("ALTER TABLE event_publication ALTER COLUMN serialized_event CLOB");
        } catch (Exception ignored) {}
        for (String mig : new String[]{
            "db/migration/V12__company_branding_and_letterhead.sql"
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
        stationId = "st_att_" + java.util.UUID.randomUUID().toString().substring(0, 6);
        jdbcTemplate.update("""
            INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            VALUES (?, 'ten_opes_cm', ?, 'Attendant Island Station', 'Douala', 'FCFA', 'Starter Station', 25000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """, stationId, "ATT-" + java.util.UUID.randomUUID().toString().substring(0, 4).toUpperCase());

        employeeId = "emp_att_" + java.util.UUID.randomUUID().toString().substring(0, 6);
        jdbcTemplate.update("""
            INSERT INTO employees (id, station_id, auth0_sub, full_name, role, phone, shift_window, base_salary_fcfa, cumulative_variance_fcfa, clocked_in, version)
            VALUES (?, ?, 'attendant@opesfuel.com', 'Koffi Mensah', 'ATTENDANT', '+237690000004', '06:00 - 14:00', 145000, 0, FALSE, 0)
            """, employeeId, stationId);
    }

    @Test
    void attendantCanClockInAndReadStationsWhileStrictlyBlockedFromFinancialsStatementsPayrollAndAdmin() throws Exception {
        var attendant = user("attendant@opesfuel.com").roles("ATTENDANT");

        String coworkerId = "emp_cow_" + java.util.UUID.randomUUID().toString().substring(0, 6);
        jdbcTemplate.update("""
            INSERT INTO employees (id, station_id, auth0_sub, full_name, role, phone, shift_window, base_salary_fcfa, cumulative_variance_fcfa, clocked_in, version)
            VALUES (?, ?, 'other@opesfuel.com', 'Jean Paul', 'ATTENDANT', '+237690000005', '14:00 - 22:00', 145000, 0, FALSE, 0)
            """, coworkerId, stationId);

        // 1. Allowed: Self clock-in attendance toggle, read stations, read pumps, read fleet accounts
        mvc.perform(post("/api/v1/workforce/employees/{id}/attendance", employeeId).with(attendant))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.clockedIn").value(true));

        // 1b. Blocked (403): Cannot clock in/out a coworker
        mvc.perform(post("/api/v1/workforce/employees/{id}/attendance", coworkerId).with(attendant))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/forecourt/pumps").param("stationId", stationId).with(attendant))
            .andExpect(status().isOk());

        mvc.perform(get("/api/v1/fleet/accounts").with(attendant))
            .andExpect(status().isOk());

        // 2. Strictly blocked (403) from corporate AR statements, accounting P&L, payroll, deliveries, pump deletion, branding, AI
        mvc.perform(get("/api/v1/fleet/accounts/flt_any/statement").with(attendant))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/accounting/reports").param("stationId", stationId).with(attendant))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/workforce/payroll").param("stationId", stationId).with(attendant))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/inventory/deliveries")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tankId\":\"tk_1\",\"supplierName\":\"SCDP\",\"bolNumber\":\"BOL-1\",\"bolLitres\":10000,\"actualReceivedLitres\":10000,\"unitCostFcfa\":700}")
                .with(attendant))
            .andExpect(status().isForbidden());

        mvc.perform(delete("/api/v1/forecourt/pumps/pmp_any").with(attendant))
            .andExpect(status().isForbidden());

        mvc.perform(put("/api/v1/tenants/current/branding")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tradingName\":\"X\",\"legalName\":\"Y\"}")
                .with(attendant))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/ai/subscription/activate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"%s\",\"active\":true}".formatted(stationId))
                .with(attendant))
            .andExpect(status().isForbidden());
    }
}
