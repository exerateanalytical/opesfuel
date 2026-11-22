package com.opesware.opesfuel;

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

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Sprint2GovernanceTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setupV9Schema() throws Exception {
        for (String mig : new String[]{
            "db/migration/V7__prelaunch_modules_hr_audit_safe_calibration.sql",
            "db/migration/V9__sprint2_billing_shop_iam_state_machines.sql"
        }) {
            var stream = getClass().getClassLoader().getResourceAsStream(mig);
            if (stream != null) {
                String sql = new String(stream.readAllBytes()).replaceAll("(?m)^--.*$", "");
                for (String stmt : sql.split(";")) {
                    String t = stmt.trim();
                    if (!t.isEmpty()) jdbcTemplate.execute(t);
                }
            }
        }
        jdbcTemplate.update("""
            MERGE INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at)
            KEY(id) VALUES ('ten_opes_cm', 'Sprint2 Tenant', 'owner@opesfuel.cm', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)
            """);
    }

    @Test
    void M03_billingCouponsProrationCreditNotesAndDunningLifecycle() throws Exception {
        // Create 20% promo coupon with max 1 redemption
        mockMvc.perform(post("/api/v1/enterprise/billing/coupons")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"CEMAC20\",\"discountType\":\"PERCENT\",\"discountValue\":20,\"maxRedemptions\":1,\"expiresAt\":\"2028-12-31\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.code").value("CEMAC20"));

        // First redemption succeeds: 55,000 -> 11,000 discount -> 44,000 net
        mockMvc.perform(post("/api/v1/enterprise/billing/coupons/validate")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"CEMAC20\",\"grossAmountFcfa\":55000}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.discountFcfa").value(11000))
            .andExpect(jsonPath("$.netAmountFcfa").value(44000));

        // Second redemption exceeds maxRedemptions -> 409 Conflict
        mockMvc.perform(post("/api/v1/enterprise/billing/coupons/validate")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"code\":\"CEMAC20\",\"grossAmountFcfa\":55000}"))
            .andExpect(status().isConflict());

        // Proration preview: upgrade from 25,000 to 55,000 with 15/30 days left -> +15,000 delta
        mockMvc.perform(post("/api/v1/enterprise/billing/proration-preview")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentMonthlyFeeFcfa\":25000,\"targetMonthlyFeeFcfa\":55000,\"daysRemainingInCycle\":15,\"totalDaysInCycle\":30}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.netProratedDeltaFcfa").value(15000))
            .andExpect(jsonPath("$.action").value("INVOICE_UPGRADE_DELTA"));

        // Issue credit note + record dunning transition
        mockMvc.perform(post("/api/v1/enterprise/billing/credit-notes")
                .with(user("acct_01").roles("ACCOUNTANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"invoiceId\":\"inv_2026_11\",\"amountFcfa\":12500,\"reason\":\"Mid-cycle station downgrade credit\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ISSUED"));

        mockMvc.perform(post("/api/v1/enterprise/billing/dunning")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"previousState\":\"PAST_DUE\",\"newState\":\"GRACE\",\"channel\":\"WHATSAPP\",\"note\":\"7-day renewal grace notice sent\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.newState").value("GRACE"));
    }

    @Test
    void M16_M17_shopFefoBarcodeCartAndStockAdjustmentStateMachine() throws Exception {
        // Seed two batches of same SKU with different expiry dates (older expiry MUST be picked first — FEFO)
        mockMvc.perform(post("/api/v1/enterprise/shop/batches")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"sku\":\"LUB-5W30\",\"barcode\":\"3425901018508\",\"itemName\":\"Total Quartz 5W-30 (4L)\",\"batchCode\":\"LOT-LATE\",\"expiryDate\":\"2028-09-01\",\"quantityRemaining\":10,\"unitPriceFcfa\":18500}"))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/enterprise/shop/batches")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"sku\":\"LUB-5W30\",\"barcode\":\"3425901018508\",\"itemName\":\"Total Quartz 5W-30 (4L)\",\"batchCode\":\"LOT-SOON\",\"expiryDate\":\"2027-01-15\",\"quantityRemaining\":2,\"unitPriceFcfa\":18500}"))
            .andExpect(status().isOk());

        // Checkout 3 units by barcode -> takes 2 from LOT-SOON and 1 from LOT-LATE = 55,500 FCFA
        mockMvc.perform(post("/api/v1/enterprise/shop/cart-checkout")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"paymentMethod\":\"MOBILE_MONEY\",\"items\":[{\"skuOrBarcode\":\"3425901018508\",\"quantity\":3}]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.grandTotalFcfa").value(55500))
            .andExpect(jsonPath("$.fefoDeductions[0].batchCode").value("LOT-SOON"))
            .andExpect(jsonPath("$.fefoDeductions[0].quantityPicked").value(2))
            .andExpect(jsonPath("$.fefoDeductions[1].batchCode").value("LOT-LATE"))
            .andExpect(jsonPath("$.fefoDeductions[1].quantityPicked").value(1));

        // Stock Adjustment state machine: DRAFT -> PENDING_APPROVAL -> self-approval 409 -> second checker APPROVED -> POSTED
        MvcResult adjRes = mockMvc.perform(post("/api/v1/enterprise/stock-adjustments")
                .with(user("mgr_maker").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"sku\":\"LUB-5W30\",\"itemName\":\"Total Quartz 5W-30\",\"qtyDelta\":-1,\"unitCostFcfa\":13000,\"reason\":\"Damaged bottle seal\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("DRAFT"))
            .andReturn();
        String adjId = objectMapper.readTree(adjRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(patch("/api/v1/enterprise/stock-adjustments/" + adjId + "/transition")
                .with(user("mgr_maker").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"PENDING_APPROVAL\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("PENDING_APPROVAL"));

        // Self-approval blocked (409)
        mockMvc.perform(patch("/api/v1/enterprise/stock-adjustments/" + adjId + "/transition")
                .with(user("mgr_maker").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"APPROVED\"}"))
            .andExpect(status().isConflict());

        // Independent checker approves & posts
        mockMvc.perform(patch("/api/v1/enterprise/stock-adjustments/" + adjId + "/transition")
                .with(user("owner_checker").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"APPROVED\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("APPROVED"));

        mockMvc.perform(patch("/api/v1/enterprise/stock-adjustments/" + adjId + "/transition")
                .with(user("acct_01").roles("ACCOUNTANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"POSTED\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("POSTED"));
    }

    @Test
    void M05_iamDelegationsBreakGlassAndPeriodicAccessReviews() throws Exception {
        MvcResult dlgRes = mockMvc.perform(post("/api/v1/enterprise/iam/delegations")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"granteeEmail\":\"deputy.manager@opesfuel.cm\",\"permissionScope\":\"APPROVE_PO_UP_TO_5M\",\"reason\":\"Owner annual leave cover\",\"expiresAt\":\"2026-12-15\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE"))
            .andReturn();
        String dlgId = objectMapper.readTree(dlgRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(patch("/api/v1/enterprise/iam/delegations/" + dlgId + "/revoke")
                .with(user("owner_01").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("REVOKED"));

        mockMvc.perform(post("/api/v1/enterprise/iam/break-glass")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"elevatedRole\":\"OWNER\",\"incidentTicket\":\"INC-2026-884\",\"justification\":\"Emergency night tanker quarantine release after water drain verified\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.reviewStatus").value("PENDING_AUDIT"));

        mockMvc.perform(post("/api/v1/enterprise/iam/access-reviews")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"cycleLabel\":\"2026-Q4\",\"targetUserEmail\":\"finance@opesfuel.cm\",\"assignedRole\":\"ACCOUNTANT\",\"decision\":\"CERTIFIED\",\"notes\":\"Verified active station accountant\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.decision").value("CERTIFIED"));
    }
}
