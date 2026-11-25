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

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * SaaS policy: fail-closed tenant resolution, read-only public demo, trial expiry and suspension locks.
 * The test profile relaxes these; here they are switched ON to mirror production defaults.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestPropertySource(properties = {
    "opesfuel.security.allow-default-tenant-fallback=false",
    "opesfuel.demo.tenant-id=ten_pol_demo",
    "opesfuel.demo.read-only=true",
    "opesfuel.billing.enforce-trial-lock=true"
})
class TenantPolicyEnforcementTests {

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbc;

    @BeforeEach
    void fixtures() {
        jdbc.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE");
        jdbc.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_status VARCHAR(24) NOT NULL DEFAULT 'CURRENT'");
        try { jdbc.execute("ALTER TABLE billing_invoices ADD COLUMN IF NOT EXISTS due_at TIMESTAMP"); } catch (Exception ignored) {} // exists in production via V9
        tenant("ten_pol_demo", "ACTIVE", "CURRENT", "NULL");
        tenant("ten_pol_expired", "ACTIVE", "TRIAL", "DATEADD('DAY', -2, CURRENT_TIMESTAMP)");
        tenant("ten_pol_live_trial", "ACTIVE", "TRIAL", "DATEADD('DAY', 10, CURRENT_TIMESTAMP)");
        tenant("ten_pol_suspended", "SUSPENDED", "CURRENT", "NULL");
        tenant("ten_pol_paid", "ACTIVE", "CURRENT", "DATEADD('DAY', -30, CURRENT_TIMESTAMP)");
    }

    private void tenant(String id, String status, String billing, String trialExpr) {
        jdbc.update("DELETE FROM tenants WHERE id = ?", id);
        jdbc.update("INSERT INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at) "
            + "VALUES (?, ?, 'o@test.com', 'FCFA', 'CM', 'Africa/Douala', ?, CURRENT_TIMESTAMP)", id, id, status);
        jdbc.update("UPDATE tenants SET billing_status = ?, trial_ends_at = " + trialExpr + " WHERE id = ?", billing, id);
    }

    private RequestPostProcessor as(String tenant, String role) {
        var j = jwt().jwt(t -> {
            t.subject("auth0|pol_user");
            t.claim("https://opesfuel.com/roles", List.of(role));
            if (tenant != null) t.claim("https://opesfuel.com/tenant_id", tenant);
        }).authorities(new SimpleGrantedAuthority("ROLE_" + role));
        return j;
    }

    @Test
    void tokenWithoutTenantClaimIsRejectedInsteadOfLandingInDemoTenant() throws Exception {
        mvc.perform(get("/api/v1/stations").with(as(null, "OWNER"))).andExpect(status().isForbidden());
    }

    @Test
    void demoTenantIsReadOnlyForOwnersButPlatformAdminIsNot() throws Exception {
        mvc.perform(post("/api/v1/stations").with(as("ten_pol_demo", "OWNER")).contentType("application/json").content("{}"))
            .andExpect(status().isForbidden())
            .andExpect(content().string(containsString("DEMO_READ_ONLY")));
        mvc.perform(get("/api/v1/stations").with(as("ten_pol_demo", "OWNER")))
            .andExpect(content().string(not(containsString("DEMO_READ_ONLY"))));
        mvc.perform(post("/api/v1/stations").with(as("ten_pol_demo", "PLATFORM_ADMIN")).contentType("application/json").content("{}"))
            .andExpect(content().string(not(containsString("DEMO_READ_ONLY"))));
    }

    @Test
    void expiredTrialBecomesReadOnlyWith402ButStillReadable() throws Exception {
        mvc.perform(post("/api/v1/stations").with(as("ten_pol_expired", "OWNER")).contentType("application/json").content("{}"))
            .andExpect(status().isPaymentRequired())
            .andExpect(content().string(containsString("SUBSCRIPTION_REQUIRED")));
        mvc.perform(get("/api/v1/stations").with(as("ten_pol_expired", "OWNER")))
            .andExpect(content().string(not(containsString("SUBSCRIPTION_REQUIRED"))));
    }

    @Test
    void activeTrialAndPaidTenantsAreNotLocked() throws Exception {
        for (String t : new String[]{"ten_pol_live_trial", "ten_pol_paid"}) {
            mvc.perform(post("/api/v1/stations").with(as(t, "OWNER")).contentType("application/json").content("{}"))
                .andExpect(content().string(not(containsString("SUBSCRIPTION_REQUIRED"))))
                .andExpect(content().string(not(containsString("TENANT_SUSPENDED"))));
        }
    }

    @Test
    void suspendedTenantIsBlockedEvenForReads() throws Exception {
        mvc.perform(get("/api/v1/stations").with(as("ten_pol_suspended", "OWNER")))
            .andExpect(status().isForbidden())
            .andExpect(content().string(containsString("TENANT_SUSPENDED")));
    }

    @Test
    void subscriptionStatusReportsTheSameLockRulesTheServerEnforces() throws Exception {
        mvc.perform(get("/api/v1/billing/subscription-status").with(as("ten_pol_live_trial", "OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.trialActive").value(true))
            .andExpect(jsonPath("$.readOnly").value(false))
            .andExpect(jsonPath("$.billingStatus").value("TRIAL"))
            .andExpect(jsonPath("$.trialDaysRemaining").value(org.hamcrest.Matchers.greaterThanOrEqualTo(9)));
        mvc.perform(get("/api/v1/billing/subscription-status").with(as("ten_pol_expired", "OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.trialActive").value(false))
            .andExpect(jsonPath("$.readOnly").value(true))
            .andExpect(jsonPath("$.trialDaysRemaining").value(0));
        mvc.perform(get("/api/v1/billing/subscription-status").with(as("ten_pol_paid", "OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.readOnly").value(false))
            .andExpect(jsonPath("$.billingStatus").value("CURRENT"));
    }

    @Test
    void lockMessagesUseTheStandardErrorShapeSoEveryAppCanShowThem() throws Exception {
        mvc.perform(post("/api/v1/stations").with(as("ten_pol_expired", "OWNER")).contentType("application/json").content("{}"))
            .andExpect(status().isPaymentRequired())
            .andExpect(jsonPath("$.status").value(402))
            .andExpect(jsonPath("$.detail").value(containsString("read-only")));
    }
}
