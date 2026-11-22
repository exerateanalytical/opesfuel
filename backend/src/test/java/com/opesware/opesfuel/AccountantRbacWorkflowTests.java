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
class AccountantRbacWorkflowTests {

    @Autowired MockMvc mvc;
    @Autowired JdbcTemplate jdbcTemplate;

    private String stationId;

    @BeforeEach
    void setupAccountsAndStation() throws Exception {
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
        try {
            jdbcTemplate.execute("ALTER TABLE event_publication ALTER COLUMN serialized_event CLOB");
        } catch (Exception ignored) {}
        jdbcTemplate.update("""
            MERGE INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at)
            KEY(id) VALUES ('ten_opes_cm', 'OpesFuel Test Tenant', 'owner@opesfuel.com', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)
            """);
        for (String[] acc : new String[][]{
            {"1010", "Cash on Hand", "ASSET"},
            {"1020", "Mobile Money Clearing", "ASSET"},
            {"1030", "Bank Operating Account", "ASSET"},
            {"2010", "Supplier Accounts Payable", "LIABILITY"},
            {"2200", "VAT Payable", "LIABILITY"},
            {"6010", "Operating Expenses", "EXPENSE"},
            {"6100", "Salaries & Variance", "EXPENSE"}
        }) {
            try {
                jdbcTemplate.update("INSERT INTO accounts (code, name, account_type) VALUES (?, ?, ?)", acc[0], acc[1], acc[2]);
            } catch (Exception ignored) {}
        }
        stationId = "st_acc_" + java.util.UUID.randomUUID().toString().substring(0, 6);
        jdbcTemplate.update("""
            INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            VALUES (?, 'ten_opes_cm', ?, 'Accountant Audit Station', 'Douala', 'FCFA', 'Growth Multi-Station', 65000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)
            """, stationId, "ACC-" + java.util.UUID.randomUUID().toString().substring(0, 4).toUpperCase());
    }

    @Test
    void accountantPostsCompoundManualJournalTaxApAndPeriodsWhileBlockedFromForecourtAndAdmin() throws Exception {
        var accountant = user("finance@opesfuel.com").roles("ACCOUNTANT");

        // 1. Post a balanced 3-line compound SYSCOHADA manual journal
        mvc.perform(post("/api/v1/accounting/journals/manual")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "stationId": "%s",
                      "reference": "MJ-COMP-001",
                      "description": "Month-end payroll + utilities accrual",
                      "lines": [
                        { "accountCode": "6100", "debitFcfa": 150000, "creditFcfa": 0 },
                        { "accountCode": "6010", "debitFcfa": 50000, "creditFcfa": 0 },
                        { "accountCode": "1030", "debitFcfa": 0, "creditFcfa": 200000 }
                      ]
                    }
                    """.formatted(stationId))
                .with(accountant))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.reference").value("MJ-COMP-001"))
            .andExpect(jsonPath("$.lines.length()").value(3));

        // 2. Unbalanced compound journal rejected
        mvc.perform(post("/api/v1/accounting/journals/manual")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "stationId": "%s",
                      "reference": "MJ-BAD-002",
                      "description": "Unbalanced test",
                      "lines": [
                        { "accountCode": "6100", "debitFcfa": 100000, "creditFcfa": 0 },
                        { "accountCode": "1030", "debitFcfa": 0, "creditFcfa": 50000 }
                      ]
                    }
                    """.formatted(stationId))
                .with(accountant))
            .andExpect(status().is4xxClientError());

        // 3. Supplier AP Settlement, 19.25% VAT Remittance, and Fiscal Period Lock
        mvc.perform(post("/api/v1/accounting/ap-payments")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "stationId": "%s",
                      "supplierName": "SCDP Depot Douala",
                      "reference": "AP-ACC-2026",
                      "amountFcfa": 350000,
                      "paymentSource": "BANK"
                    }
                    """.formatted(stationId))
                .with(accountant))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/v1/accounting/vat-remittances")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "stationId": "%s",
                      "periodLabel": "2026-10",
                      "reference": "DGI-TVA-2026-10",
                      "amountFcfa": 180000,
                      "paymentSource": "BANK"
                    }
                    """.formatted(stationId))
            .with(accountant))
            .andExpect(status().isCreated());

        mvc.perform(post("/api/v1/accounting/periods/close")
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {
                      "stationId": "%s",
                      "periodKey": "2026-09"
                    }
                    """.formatted(stationId))
                .with(accountant))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("CLOSED"));

        // 4. Strictly blocked (403) from forecourt shift open, staff clock-in, branding update, and AI billing
        mvc.perform(post("/api/v1/workforce/employees/emp_any/attendance").with(accountant))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/forecourt/shifts/open")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"%s\",\"pumpId\":\"p1\",\"attendantId\":\"a1\"}".formatted(stationId))
                .with(accountant))
            .andExpect(status().isForbidden());

        mvc.perform(put("/api/v1/tenants/current/branding")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"tradingName\":\"X\",\"legalName\":\"Y\"}")
                .with(accountant))
            .andExpect(status().isForbidden());

        mvc.perform(post("/api/v1/ai/subscription/activate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"%s\",\"active\":true}".formatted(stationId))
                .with(accountant))
            .andExpect(status().isForbidden());
    }
}
