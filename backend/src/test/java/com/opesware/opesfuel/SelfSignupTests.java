package com.opesware.opesfuel;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = "opesfuel.auth0.action-secret=test-action-secret")
class SelfSignupTests {

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void schema() {
        jdbc.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE");
        jdbc.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_status VARCHAR(24) NOT NULL DEFAULT 'CURRENT'");
        jdbc.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_pumps INTEGER DEFAULT 12");
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
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS tenant_feature_flags (
                tenant_id VARCHAR(64) PRIMARY KEY, ai_copilot_enabled BOOLEAN DEFAULT TRUE, hardware_bridge_enabled BOOLEAN DEFAULT TRUE,
                ocpp_ev_enabled BOOLEAN DEFAULT TRUE, b2b_wholesale_enabled BOOLEAN DEFAULT TRUE, franchise_mode_enabled BOOLEAN DEFAULT FALSE,
                white_label_branding_enabled BOOLEAN DEFAULT TRUE, custom_monthly_override_fcfa BIGINT, updated_by VARCHAR(128),
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )""");
    }

    private String body(String email, String website) {
        return "{\"companyName\":\"Station Test SARL\",\"ownerName\":\"Awa Test\",\"email\":\"" + email
            + "\",\"phone\":\"+237600000000\",\"city\":\"Douala\",\"website\":\"" + website + "\"}";
    }

    @Test
    void signupCreatesIsolatedTrialWorkspaceAndRejectsDuplicates() throws Exception {
        String email = "owner-" + UUID.randomUUID().toString().substring(0, 6) + "@example.com";
        mvc.perform(post("/api/v1/public/auth/signup").contentType("application/json").content(body(email, "")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.tenantId").exists())
            .andExpect(jsonPath("$.nextStep").value("SIGN_IN_WITH_VERIFIED_EMAIL"));
        assertEquals("TRIAL", jdbc.queryForObject("SELECT billing_status FROM tenants WHERE owner_email = ?", String.class, email));
        assertEquals("OWNER", jdbc.queryForObject("SELECT role FROM user_accounts WHERE email = ?", String.class, email));
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM stations s JOIN tenants t ON s.tenant_id = t.id WHERE t.owner_email = ?", Integer.class, email));

        mvc.perform(post("/api/v1/public/auth/signup").contentType("application/json").content(body(email.toUpperCase(), "")))
            .andExpect(status().isConflict());
    }

    @Test
    void honeypotAndInvalidInputAreRejected() throws Exception {
        mvc.perform(post("/api/v1/public/auth/signup").contentType("application/json").content(body("bot@example.com", "http://spam")))
            .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/public/auth/signup").contentType("application/json").content("{\"companyName\":\"\",\"ownerName\":\"x\",\"email\":\"nope\"}"))
            .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void identityClaimsRequireSecretVerifiedEmailAndLinkTheLoginOnce() throws Exception {
        String email = "claims-" + UUID.randomUUID().toString().substring(0, 6) + "@example.com";
        mvc.perform(post("/api/v1/public/auth/signup").contentType("application/json").content(body(email, ""))).andExpect(status().isCreated());
        String req = "{\"email\":\"" + email + "\",\"sub\":\"auth0|real123\",\"emailVerified\":true}";

        mvc.perform(post("/api/v1/public/auth/identity-claims").contentType("application/json").content(req))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/public/auth/identity-claims").header("X-Auth0-Action-Secret", "wrong").contentType("application/json").content(req))
            .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/public/auth/identity-claims").header("X-Auth0-Action-Secret", "test-action-secret").contentType("application/json")
                .content("{\"email\":\"" + email + "\",\"sub\":\"auth0|evil\",\"emailVerified\":false}"))
            .andExpect(status().isForbidden());
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM user_accounts WHERE email = ? AND auth0_sub LIKE 'pending|%'", Integer.class, email));

        mvc.perform(post("/api/v1/public/auth/identity-claims").header("X-Auth0-Action-Secret", "test-action-secret").contentType("application/json").content(req))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.roles[0]").value("OWNER"))
            .andExpect(jsonPath("$.tenant_id").value(containsString("ten_")));
        assertEquals("auth0|real123", jdbc.queryForObject("SELECT auth0_sub FROM user_accounts WHERE email = ?", String.class, email));

        mvc.perform(post("/api/v1/public/auth/identity-claims").header("X-Auth0-Action-Secret", "test-action-secret").contentType("application/json")
                .content("{\"email\":\"ghost@example.com\",\"sub\":\"auth0|g\",\"emailVerified\":true}"))
            .andExpect(status().isNotFound());
    }
}
