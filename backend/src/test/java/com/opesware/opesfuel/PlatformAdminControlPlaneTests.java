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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PlatformAdminControlPlaneTests {

    @Autowired
    MockMvc mvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setupSchemas() throws Exception {
        for (String mig : new String[]{
            "db/migration/V7__prelaunch_modules_hr_audit_safe_calibration.sql",
            "db/migration/V12__company_branding_and_letterhead.sql",
            "db/migration/V13__platform_admin_governance.sql",
            "db/migration/V14__cameroon_momo_payments.sql",
            "db/migration/V15__messaging_delivery_and_otps.sql",
            "db/migration/V20__edge_agent_devices.sql",
            "db/migration/V23__api_integration_connectors.sql",
            "db/migration/V24__platform_admin_control_plane.sql"
        }) {
            var stream = getClass().getClassLoader().getResourceAsStream(mig);
            if (stream != null) {
                String sql = new String(stream.readAllBytes()).replaceAll("(?m)^--.*$", "");
                for (String stmt : sql.split(";")) {
                    String t = stmt.trim();
                    if (!t.isEmpty()) {
                        try {
                            jdbcTemplate.execute(t);
                        } catch (Exception ignored) {
                            // Ignore idempotent duplicate DDL on repeated test methods
                        }
                    }
                }
            }
        }
    }

    @Test
    void platformAdminExecutiveOverviewAndHealthTelemetryReturnLiveData() throws Exception {
        mvc.perform(get("/api/v1/platform-admin/overview")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalTenants").isNumber())
            .andExpect(jsonPath("$.collectionRatePct").isNumber())
            .andExpect(jsonPath("$.planTierBreakdown").isArray())
            .andExpect(jsonPath("$.openSupportTickets").isNumber());

        mvc.perform(get("/api/v1/platform-admin/health-telemetry")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("HEALTHY"))
            .andExpect(jsonPath("$.databaseStatus").value("UP"))
            .andExpect(jsonPath("$.flywayMigrationsApplied").isNumber())
            .andExpect(jsonPath("$.webhookSuccessRatePct").isNumber());
    }

    @Test
    void tenantLifecycleProvisioningDetail360TrialPlanAndAccessRecoveryWorkEndToEnd() throws Exception {
        MvcResult createRes = mvc.perform(post("/api/v1/platform-admin/tenants")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "name": "Wouri Petroleum SARL",
                      "ownerEmail": "ceo@wouripetroleum.cm",
                      "countryCode": "CM",
                      "timezone": "Africa/Douala",
                      "city": "Douala",
                      "planCode": "starter",
                      "initialStations": 2,
                      "trialDays": 14
                    }
                    """)
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Wouri Petroleum SARL"))
            .andExpect(jsonPath("$.stationCount").value(2))
            .andExpect(jsonPath("$.planCode").value("starter"))
            .andReturn();

        JsonNode created = objectMapper.readTree(createRes.getResponse().getContentAsString());
        String tenantId = created.get("id").asText();
        assertThat(tenantId).startsWith("ten_");

        // Extend trial +14 days
        mvc.perform(patch("/api/v1/platform-admin/tenants/{id}/trial", tenantId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"days\": 14, \"reason\": \"Enterprise onboarding pilot\"}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.billingStatus").value("TRIAL"))
            .andExpect(jsonPath("$.trialEndsAt").isNotEmpty());

        // Upgrade to enterprise plan
        mvc.perform(patch("/api/v1/platform-admin/tenants/{id}/plan", tenantId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"planCode\": \"enterprise\"}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.planCode").value("enterprise"))
            .andExpect(jsonPath("$.monthlyMrrFcfa").value(240000));

        // Fetch full Tenant 360 detail
        mvc.perform(get("/api/v1/platform-admin/tenants/{id}", tenantId)
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stations").isArray())
            .andExpect(jsonPath("$.stations.length()").value(2))
            .andExpect(jsonPath("$.recentAuditLogs").isArray());

        // Resend owner access recovery
        mvc.perform(post("/api/v1/platform-admin/tenants/{id}/resend-access", tenantId)
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ownerEmail").value("ceo@wouripetroleum.cm"));
    }

    @Test
    void supportDeskTicketsRepliesAndAuditedImpersonationSessionWorkflow() throws Exception {
        // Tenant owner submits a ticket into the Support Desk
        MvcResult tktRes = mvc.perform(post("/api/v1/support/tickets")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "subject": "Edge Agent offline on Pump Island B",
                      "description": "Our Raspberry Pi edge agent stopped sending heartbeats after power outage.",
                      "category": "EDGE_HARDWARE",
                      "priority": "URGENT"
                    }
                    """)
                .with(user("owner@opesfuel.cm").roles("OWNER")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.priority").value("URGENT"))
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andReturn();

        String ticketId = objectMapper.readTree(tktRes.getResponse().getContentAsString()).get("id").asText();

        // Super-Admin posts both a public reply and a private internal note
        mvc.perform(post("/api/v1/platform-admin/support/tickets/{id}/messages", ticketId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\": \"Investigating Edge Agent heartbeat logs now.\", \"internalNote\": false, \"notifyRequester\": true}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.senderRole").value("PLATFORM_ADMIN"));

        mvc.perform(post("/api/v1/platform-admin/support/tickets/{id}/messages", ticketId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\": \"INTERNAL ONLY: rotate TLS cert on edge host.\", \"internalNote\": true, \"notifyRequester\": false}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isCreated());

        // Tenant OWNER must ONLY see non-internal messages (2 = original description + public reply), NEVER the internal note
        mvc.perform(get("/api/v1/support/tickets/{id}/messages", ticketId)
                .with(user("owner@opesfuel.cm").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(2));

        // Tenant OWNER posts a follow-up reply
        mvc.perform(post("/api/v1/support/tickets/{id}/messages", ticketId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"body\": \"Thank you, router power has been restored on Island B.\"}")
                .with(user("owner@opesfuel.cm").roles("OWNER")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.internalNote").value(false));

        mvc.perform(patch("/api/v1/platform-admin/support/tickets/{id}", ticketId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\": \"IN_PROGRESS\"}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        // Start & end audited impersonation session
        MvcResult impRes = mvc.perform(post("/api/v1/platform-admin/support/impersonations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tenantId\": \"ten_opes_cm\", \"ticketId\": \"" + ticketId + "\", \"reason\": \"Diagnosing Edge Agent connectivity\"}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("ACTIVE"))
            .andReturn();

        String impId = objectMapper.readTree(impRes.getResponse().getContentAsString()).get("id").asText();

        mvc.perform(post("/api/v1/platform-admin/support/impersonations/{id}/end", impId)
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ENDED"));
    }

    @Test
    void globalBillingLicensesRevocationBroadcastsAndAuditLogsPersistEndToEnd() throws Exception {
        // Issue global invoice and settle it
        MvcResult invRes = mvc.perform(post("/api/v1/platform-admin/invoices")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tenantId\": \"ten_opes_cm\", \"periodLabel\": \"2026-12\", \"totalFcfa\": 110000, \"channel\": \"MTN_MOMO\"}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("ISSUED"))
            .andReturn();
        String invId = objectMapper.readTree(invRes.getResponse().getContentAsString()).get("id").asText();

        mvc.perform(post("/api/v1/platform-admin/invoices/{id}/mark-paid", invId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"paymentChannel\": \"MTN_MOMO\", \"providerReference\": \"MOMO-CM-99210\"}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PAID"));

        // Issue and revoke enterprise license
        MvcResult licRes = mvc.perform(post("/api/v1/platform-admin/licenses")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"organizationName\": \"CamFuel Holdings SA\", \"tierName\": \"National Sovereign License\", \"maxStations\": 40, \"annualFeeFcfa\": 12000000, \"expiresAt\": \"2027-12-31\"}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("ACTIVE"))
            .andReturn();
        String licId = objectMapper.readTree(licRes.getResponse().getContentAsString()).get("id").asText();

        mvc.perform(post("/api/v1/platform-admin/licenses/{id}/revoke", licId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\": \"Superseded by upgraded corporate license\"}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("REVOKED"));

        // Send persisted in-app broadcast
        mvc.perform(post("/api/v1/platform-admin/broadcasts")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"channel\": \"IN_APP\", \"audience\": \"ALL_ACTIVE\", \"title\": \"Scheduled Maintenance\", \"message\": \"Zero-downtime Flyway V24 upgrade complete.\"}")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.dispatchedCount").isNumber());

        // Cross-tenant audit logs & MoMo settlements
        mvc.perform(get("/api/v1/platform-admin/audit-logs")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        mvc.perform(get("/api/v1/platform-admin/momo-settlements")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray());

        // Non-platform admin must be forbidden from all new endpoints
        mvc.perform(get("/api/v1/platform-admin/support/tickets")
                .with(user("owner@opesfuel.cm").roles("OWNER")))
            .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/platform-admin/health-telemetry")
                .with(user("accountant@opesfuel.cm").roles("ACCOUNTANT")))
            .andExpect(status().isForbidden());
    }
}
