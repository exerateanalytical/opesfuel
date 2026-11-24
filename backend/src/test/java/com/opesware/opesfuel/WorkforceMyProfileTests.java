package com.opesware.opesfuel;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Mobile app support: an attendant can read their own employee record (and nothing of anyone else's, no salary). */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class WorkforceMyProfileTests {

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    private String stationId;
    private String empId;
    private String sub;

    @BeforeEach
    void fixtures() {
        try { jdbc.execute("ALTER TABLE event_publication ALTER COLUMN serialized_event CLOB"); } catch (Exception ignored) {}
        jdbc.update("""
            MERGE INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at)
            KEY(id) VALUES ('ten_opes_cm', 'Test Tenant', 'owner@opesfuel.com', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)
            """);
        stationId = "st_me_" + UUID.randomUUID().toString().substring(0, 6);
        jdbc.update("""
            INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            VALUES (?, 'ten_opes_cm', ?, 'Me Station', 'Douala', 'FCFA', 'Starter Station', 25000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """, stationId, "ME-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase());
        empId = "emp_me_" + UUID.randomUUID().toString().substring(0, 6);
        sub = "auth0|me_" + UUID.randomUUID().toString().substring(0, 6);
        jdbc.update("""
            INSERT INTO employees (id, station_id, auth0_sub, full_name, role, phone, shift_window, clocked_in, base_salary_fcfa, cumulative_variance_fcfa, version)
            VALUES (?, ?, ?, 'Kofi Test', 'ATTENDANT', '+237 600 000 000', '06:00 - 14:00', FALSE, 123456, 0, 0)
            """, empId, stationId, sub);
    }

    private org.springframework.test.web.servlet.request.RequestPostProcessor as(String subject) {
        return jwt().jwt(j -> j.subject(subject)
                .claim("https://opesfuel.com/roles", List.of("ATTENDANT"))
                .claim("https://opesfuel.com/tenant_id", "ten_opes_cm")
                .claim("https://opesfuel.com/station_ids", List.of(stationId)))
            .authorities(new SimpleGrantedAuthority("ROLE_ATTENDANT"));
    }

    @Test
    void attendantSeesOnlyTheirOwnProfileWithoutSalary() throws Exception {
        mvc.perform(get("/api/v1/workforce/me").with(as(sub)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(empId))
            .andExpect(jsonPath("$.stationId").value(stationId))
            .andExpect(jsonPath("$.fullName").value("Kofi Test"))
            .andExpect(content().string(not(containsString("123456"))))
            .andExpect(content().string(not(containsString("baseSalary"))));
    }

    @Test
    void unlinkedLoginGetsNotFoundNotSomeoneElsesRecord() throws Exception {
        mvc.perform(get("/api/v1/workforce/me").with(as("auth0|stranger")))
            .andExpect(status().isNotFound());
    }
}
