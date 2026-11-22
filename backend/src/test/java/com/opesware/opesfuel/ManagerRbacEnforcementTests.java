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
class ManagerRbacEnforcementTests {

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setupSchemas() throws Exception {
        for (String mig : new String[]{
            "db/migration/V7__prelaunch_modules_hr_audit_safe_calibration.sql",
            "db/migration/V8__enterprise_modules_schema.sql",
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
    }

    @Test
    void managerBlockedFromDestructiveVoidFinancialsBrandingAiBillingPayrollAndFranchises() throws Exception {
        var manager = user("manager@opesfuel.com").roles("MANAGER");

        // 1. Cannot void/delete shifts, tanks, deliveries, or corporate B2B fleet accounts
        mvc.perform(delete("/api/v1/forecourt/shifts/sh_any").with(manager))
            .andExpect(status().isForbidden());

        mvc.perform(delete("/api/v1/inventory/tanks/tk_any").with(manager))
            .andExpect(status().isForbidden());

        mvc.perform(delete("/api/v1/inventory/deliveries/del_any").with(manager))
            .andExpect(status().isForbidden());

        mvc.perform(delete("/api/v1/fleet/accounts/flt_any").with(manager))
            .andExpect(status().isForbidden());

        // 2. Cannot overwrite company legal branding / letterhead (can still read it for receipts)
        mvc.perform(get("/api/v1/tenants/current/branding").with(manager))
            .andExpect(status().isOk());

        mvc.perform(put("/api/v1/tenants/current/branding")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tradingName\":\"Hijacked Station\",\"legalName\":\"Hijacked SA\"}")
                .with(manager))
            .andExpect(status().isForbidden());

        // 3. Cannot toggle Paid AI Copilot SaaS add-on billing
        mvc.perform(post("/api/v1/ai/subscription/activate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"active\":true}")
                .with(manager))
            .andExpect(status().isForbidden());

        // 4. Cannot access payroll summary or execute payroll runs
        mvc.perform(get("/api/v1/workforce/payroll").with(manager))
            .andExpect(status().isForbidden());

        // 5. Cannot read or create corporate franchise royalty agreements
        mvc.perform(get("/api/v1/enterprise/franchises").with(manager))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/enterprise/franchises")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"dealerName\":\"Test\",\"operatingModel\":\"CODO\",\"royaltyFcfaPerLitre\":10,\"monthlyTargetLitres\":100000,\"complianceScorePct\":90,\"renewalDate\":\"2028-12-31\"}")
                .with(manager))
            .andExpect(status().isForbidden());

        // 6. CAN submit a Maker-Checker approval request to Owner, but CANNOT self-approve/decide it
        mvc.perform(post("/api/v1/enterprise/approvals")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"requestType\":\"SHIFT_VOID\",\"title\":\"Request void duplicate shift\",\"amountFcfa\":125000}")
                .with(manager))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING"));

        mvc.perform(patch("/api/v1/enterprise/approvals/apr_any")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"status\":\"APPROVED\"}")
                .with(manager))
            .andExpect(status().isForbidden());
    }
}
