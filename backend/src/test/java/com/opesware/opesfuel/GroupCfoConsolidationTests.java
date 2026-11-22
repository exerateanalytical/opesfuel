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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class GroupCfoConsolidationTests {

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired JdbcTemplate jdbcTemplate;

    @BeforeEach
    void setupSchemas() throws Exception {
        for (String mig : new String[]{
            "db/migration/V7__prelaunch_modules_hr_audit_safe_calibration.sql",
            "db/migration/V13__platform_admin_governance.sql",
            "db/migration/V22__holding_group_consolidation.sql",
            "db/migration/V25__holding_consolidation_enhancements.sql"
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
    void groupCfoEndToEndMultiSubsidiaryConsolidationAndEliminationLifecycle() throws Exception {
        // 1. Seeded baseline group loads immediately with inter-company tx & ratios
        mvc.perform(get("/api/v1/consolidation/groups")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").isNotEmpty());

        mvc.perform(get("/api/v1/consolidation/groups/hgrp_default/report")
                .param("period", "2026-11")
                .param("reportingCurrency", "USD")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reportingCurrency").value("USD"))
            .andExpect(jsonPath("$.subsidiaries.length()").value(3))
            .andExpect(jsonPath("$.consolidatedPnl.consolidatedRevenue").isNumber())
            .andExpect(jsonPath("$.consolidatedBalanceSheet.consolidatedAssets").isNumber());

        // 2. Create custom holding group, update currency, link & unlink subsidiary
        MvcResult grpRes = mvc.perform(post("/api/v1/consolidation/groups")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"CEMAC Fuels Holding SA\", \"reportingCurrency\": \"XAF\"}")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isCreated())
            .andReturn();
        String groupId = objectMapper.readTree(grpRes.getResponse().getContentAsString()).get("id").asText();

        mvc.perform(patch("/api/v1/consolidation/groups/{id}", groupId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reportingCurrency\": \"XOF\"}")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reporting_currency").value("XOF"));

        MvcResult mem1 = mvc.perform(post("/api/v1/consolidation/groups/{id}/members", groupId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tenantId\": \"ten_sub_a\", \"functionalCurrency\": \"XAF\", \"ownershipPct\": 100, \"entityName\": \"Sub A SA\", \"countryLabel\": \"CM\"}")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isCreated())
            .andReturn();
        String memberIdA = objectMapper.readTree(mem1.getResponse().getContentAsString()).get("id").asText();

        mvc.perform(post("/api/v1/consolidation/groups/{id}/members", groupId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tenantId\": \"ten_sub_b\", \"functionalCurrency\": \"USD\", \"ownershipPct\": 75, \"entityName\": \"Sub B Corp\", \"countryLabel\": \"LR\"}")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isCreated());

        // 3. Submit financials & record inter-company tx
        mvc.perform(post("/api/v1/consolidation/groups/{id}/financials", groupId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "tenantId": "ten_sub_a", "periodLabel": "2026-12",
                      "revenue": 100000000, "costOfSales": 70000000, "operatingExpenses": 10000000,
                      "totalAssets": 250000000, "totalLiabilities": 100000000, "equity": 150000000,
                      "receivablesIntercompany": 5000000, "payablesIntercompany": 0
                    }
                    """)
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk());

        mvc.perform(post("/api/v1/consolidation/groups/{id}/intercompany", groupId)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "periodLabel": "2026-12",
                      "sellerTenantId": "ten_sub_a",
                      "buyerTenantId": "ten_sub_b",
                      "currency": "XAF",
                      "amount": 5000000,
                      "description": "Inter-subsidiary diesel transfer"
                    }
                    """)
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isCreated());

        mvc.perform(get("/api/v1/consolidation/groups/{id}/intercompany", groupId)
                .param("period", "2026-12")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1));

        // 4. Run eliminations & verify journal entries
        mvc.perform(post("/api/v1/consolidation/groups/{id}/eliminate", groupId)
                .param("period", "2026-12")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.eliminatedTransactions").value(1))
            .andExpect(jsonPath("$.totalEliminatedReporting").value(5000000.0));

        mvc.perform(get("/api/v1/consolidation/groups/{id}/eliminations", groupId)
                .param("period", "2026-12")
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(1));

        // 5. Unlink subsidiary
        mvc.perform(delete("/api/v1/consolidation/groups/{id}/members/{memberId}", groupId, memberIdA)
                .with(user("group.cfo@opesfuel.com").roles("GROUP_CFO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deleted").value(true));

        // 6. RBAC: Manager and Attendant strictly forbidden
        mvc.perform(get("/api/v1/consolidation/groups")
                .with(user("manager@opesfuel.cm").roles("MANAGER")))
            .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/consolidation/groups/hgrp_default/eliminate").param("period", "2026-11")
                .with(user("accountant@opesfuel.cm").roles("ACCOUNTANT")))
            .andExpect(status().isForbidden());
    }
}
