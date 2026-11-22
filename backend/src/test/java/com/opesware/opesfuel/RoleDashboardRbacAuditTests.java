package com.opesware.opesfuel;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RoleDashboardRbacAuditTests {

    @Autowired
    MockMvc mvc;

    @Test
    void platformAdminInheritsOwnerAcrossTenantEndpoints() throws Exception {
        // Previously 403 Forbidden before RoleHierarchy(PLATFORM_ADMIN > OWNER)
        mvc.perform(get("/api/v1/stations")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk());

        mvc.perform(get("/api/v1/accounting/reports").param("stationId", "ALL")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk());

        mvc.perform(get("/api/v1/billing/summary")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk());

        mvc.perform(get("/api/v1/workforce/payroll").param("stationId", "ALL")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk());
    }

    @Test
    void groupCfoCanReadMultiStationFinancialsAndConsolidationButCannotMutateStationsOrPlatformAdmin() throws Exception {
        mvc.perform(get("/api/v1/stations")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk());

        mvc.perform(get("/api/v1/accounting/reports").param("stationId", "ALL")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk());

        mvc.perform(get("/api/v1/inventory/tanks").param("stationId", "ALL")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk());

        mvc.perform(get("/api/v1/fleet/accounts")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk());

        mvc.perform(get("/api/v1/consolidation/groups")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk());

        // Must NOT access SaaS Platform Admin or create/delete tenant stations
        mvc.perform(get("/api/v1/platform-admin/overview")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/stations")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"CFO-TRY\",\"name\":\"Blocked\",\"city\":\"Douala\",\"planName\":\"Starter\",\"monthlyFeeFcfa\":25000}")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isForbidden());
    }

    @Test
    void managerBlockedFromPayrollAndBillingAndPlatformAdmin() throws Exception {
        mvc.perform(get("/api/v1/workforce/payroll").param("stationId", "ALL")
                .with(user("manager@opesfuel.com").roles("MANAGER")))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/billing/summary")
                .with(user("manager@opesfuel.com").roles("MANAGER")))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/platform-admin/overview")
                .with(user("manager@opesfuel.com").roles("MANAGER")))
            .andExpect(status().isForbidden());
    }

    @Test
    void attendantStrictlyIsolatedFromAccountingPayrollBillingAndAllStationsQuery() throws Exception {
        mvc.perform(get("/api/v1/accounting/reports").param("stationId", "ALL")
                .with(user("attendant@opesfuel.com").roles("ATTENDANT")))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/workforce/employees").param("stationId", "ALL")
                .with(user("attendant@opesfuel.com").roles("ATTENDANT")))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/billing/summary")
                .with(user("attendant@opesfuel.com").roles("ATTENDANT")))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/platform-admin/overview")
                .with(user("attendant@opesfuel.com").roles("ATTENDANT")))
            .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/integrations/connectors").param("scope", "TENANT")
                .with(user("attendant@opesfuel.com").roles("ATTENDANT")))
            .andExpect(status().isForbidden());
    }
}
