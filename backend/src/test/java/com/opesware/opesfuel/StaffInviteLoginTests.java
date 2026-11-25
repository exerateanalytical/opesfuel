package com.opesware.opesfuel;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** Staff onboarding end to end: invite -> login record -> first sign-in claims -> employee link -> "me". Plus privilege ceilings. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "opesfuel.auth0.action-secret=test-action-secret")
class StaffInviteLoginTests {

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    private String stationId, empId, suffix;

    @BeforeEach
    void fixtures() {
        try { jdbc.execute("ALTER TABLE event_publication ALTER COLUMN serialized_event CLOB"); } catch (Exception ignored) {}
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS user_accounts (
                id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL, auth0_sub VARCHAR(128) NOT NULL,
                full_name VARCHAR(160) NOT NULL, email VARCHAR(180) NOT NULL, phone VARCHAR(64),
                role VARCHAR(32) NOT NULL, assigned_station_id VARCHAR(64), preferred_language VARCHAR(8) DEFAULT 'en',
                email_alerts_enabled BOOLEAN DEFAULT TRUE, status VARCHAR(24) DEFAULT 'ACTIVE',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )""");
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
                id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL, station_id VARCHAR(64),
                actor_email VARCHAR(180) NOT NULL, actor_role VARCHAR(32) NOT NULL, action VARCHAR(64) NOT NULL,
                entity_type VARCHAR(64) NOT NULL, entity_id VARCHAR(64) NOT NULL, summary CLOB NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )""");
        jdbc.update("""
            MERGE INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at)
            KEY(id) VALUES ('ten_opes_cm', 'Test Tenant', 'owner@opesfuel.com', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)
            """);
        suffix = UUID.randomUUID().toString().substring(0, 6);
        stationId = "st_inv_" + suffix;
        jdbc.update("""
            INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            VALUES (?, 'ten_opes_cm', ?, 'Invite Station', 'Douala', 'FCFA', 'Starter Station', 25000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """, stationId, "INV-" + suffix.substring(0, 3).toUpperCase());
        empId = "emp_inv_" + suffix;
        jdbc.update("""
            INSERT INTO employees (id, station_id, auth0_sub, full_name, role, phone, shift_window, clocked_in, base_salary_fcfa, cumulative_variance_fcfa, version)
            VALUES (?, ?, NULL, 'Ngono Pompiste', 'ATTENDANT', '+237 600 111 222', '06:00 - 14:00', FALSE, 90000, 0, 0)
            """, empId, stationId);
    }

    private RequestPostProcessor as(String sub, String role, String tenant) {
        return jwt().jwt(j -> j.subject(sub).claim("https://opesfuel.com/roles", List.of(role)).claim("https://opesfuel.com/tenant_id", tenant))
            .authorities(new SimpleGrantedAuthority("ROLE_" + role));
    }

    private String invite(String email, String role, boolean withEmployee) {
        return "{\"stationId\":\"" + stationId + "\",\"email\":\"" + email + "\",\"role\":\"" + role + "\"" + (withEmployee ? ",\"employeeId\":\"" + empId + "\"" : "") + "}";
    }

    @Test
    void managerCanInviteAnAttendantWhoThenSignsInAndIsLinkedToTheirEmployeeRecord() throws Exception {
        String email = "ngono-" + suffix + "@example.com";
        mvc.perform(post("/api/v1/identity/invites").with(as("auth0|mgr", "MANAGER", "ten_opes_cm")).contentType("application/json").content(invite(email, "ATTENDANT", true)))
            .andExpect(status().isCreated());
        // a login record now exists so the first sign-in is not refused at the door
        assertEquals("ATTENDANT", jdbc.queryForObject("SELECT role FROM user_accounts WHERE email = ?", String.class, email));
        assertEquals("Ngono Pompiste", jdbc.queryForObject("SELECT full_name FROM user_accounts WHERE email = ?", String.class, email));

        // first verified sign-in: Auth0 Action asks for claims
        mvc.perform(post("/api/v1/public/auth/identity-claims").header("X-Auth0-Action-Secret", "test-action-secret").contentType("application/json")
                .content("{\"email\":\"" + email + "\",\"sub\":\"auth0|ngono_" + suffix + "\",\"emailVerified\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tenant_id").value("ten_opes_cm"))
            .andExpect(jsonPath("$.roles[0]").value("ATTENDANT"))
            .andExpect(jsonPath("$.station_ids[0]").value(stationId));
        assertEquals("auth0|ngono_" + suffix, jdbc.queryForObject("SELECT auth0_sub FROM employees WHERE id = ?", String.class, empId));
        assertEquals("ACCEPTED", jdbc.queryForObject("SELECT status FROM user_invites WHERE email = ?", String.class, email));

        // the mobile app can now find "me"
        mvc.perform(get("/api/v1/workforce/me").with(jwt().jwt(j -> j.subject("auth0|ngono_" + suffix)
                    .claim("https://opesfuel.com/roles", List.of("ATTENDANT")).claim("https://opesfuel.com/tenant_id", "ten_opes_cm")
                    .claim("https://opesfuel.com/station_ids", List.of(stationId))).authorities(new SimpleGrantedAuthority("ROLE_ATTENDANT"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(empId));
    }

    @Test
    void invitesCannotEscalatePrivilegeOrReuseAnExistingLogin() throws Exception {
        // managers may only invite attendants
        for (String role : new String[]{"MANAGER", "ACCOUNTANT", "OWNER"}) {
            mvc.perform(post("/api/v1/identity/invites").with(as("auth0|mgr", "MANAGER", "ten_opes_cm")).contentType("application/json")
                    .content(invite("x-" + role.toLowerCase() + "-" + suffix + "@example.com", role, false)))
                .andExpect(status().isForbidden());
        }
        // platform / CFO roles can never be granted by invite (not a valid employee role)
        mvc.perform(post("/api/v1/identity/invites").with(as("auth0|own", "OWNER", "ten_opes_cm")).contentType("application/json")
                .content(invite("root-" + suffix + "@example.com", "PLATFORM_ADMIN", false)))
            .andExpect(status().is4xxClientError());
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_accounts WHERE email = ?", Integer.class, "root-" + suffix + "@example.com"));
        // owners may invite accountants
        String acc = "acc-" + suffix + "@example.com";
        mvc.perform(post("/api/v1/identity/invites").with(as("auth0|own", "OWNER", "ten_opes_cm")).contentType("application/json").content(invite(acc, "ACCOUNTANT", false)))
            .andExpect(status().isCreated());
        // the same email can never be invited twice (one login per email, no cross-company hijack)
        mvc.perform(post("/api/v1/identity/invites").with(as("auth0|own", "OWNER", "ten_opes_cm")).contentType("application/json").content(invite(acc, "ACCOUNTANT", false)))
            .andExpect(status().is4xxClientError());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM user_accounts WHERE email = ?", Integer.class, acc));
    }

    @Test
    void anInvitationTokenCannotBeAcceptedFromAnotherCompany() throws Exception {
        String email = "tok-" + suffix + "@example.com";
        mvc.perform(post("/api/v1/identity/invites").with(as("auth0|own", "OWNER", "ten_opes_cm")).contentType("application/json").content(invite(email, "ATTENDANT", true))).andExpect(status().isCreated());
        String token = jdbc.queryForObject("SELECT invite_token FROM user_invites WHERE email = ?", String.class, email);
        mvc.perform(post("/api/v1/identity/invites/" + token + "/accept").with(as("auth0|intruder", "ATTENDANT", "ten_other_company")))
            .andExpect(status().isForbidden());
    }

    @Test
    void updatingMyProfileChangesOnlyMyOwnRecord() throws Exception {
        String a = "a-" + suffix, b = "b-" + suffix;
        jdbc.update("INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, role) VALUES (?, 'ten_opes_cm', ?, 'Alice A', ?, 'ATTENDANT')", "usr_" + a, "auth0|" + a, a + "@x.cm");
        jdbc.update("INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, role) VALUES (?, 'ten_opes_cm', ?, 'Bob B', ?, 'ATTENDANT')", "usr_" + b, "auth0|" + b, b + "@x.cm");
        mvc.perform(patch("/api/v1/identity/profile").with(as("auth0|" + a, "ATTENDANT", "ten_opes_cm")).contentType("application/json")
                .content("{\"fullName\":\"Alice Renamed\",\"phone\":\"+237 699 000 000\",\"preferredLanguage\":\"fr\",\"emailAlertsEnabled\":true}"))
            .andExpect(status().isOk());
        assertEquals("Alice Renamed", jdbc.queryForObject("SELECT full_name FROM user_accounts WHERE id = ?", String.class, "usr_" + a));
        assertEquals("Bob B", jdbc.queryForObject("SELECT full_name FROM user_accounts WHERE id = ?", String.class, "usr_" + b));
    }
}
