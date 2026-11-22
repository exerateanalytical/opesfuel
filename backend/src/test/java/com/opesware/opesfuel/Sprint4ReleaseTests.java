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

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Sprint4ReleaseTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setupV11Schema() throws Exception {
        for (String mig : new String[]{
            "db/migration/V7__prelaunch_modules_hr_audit_safe_calibration.sql",
            "db/migration/V8__enterprise_modules_schema.sql",
            "db/migration/V11__sprint4_calibration_catalog_returns.sql"
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
            KEY(id) VALUES ('ten_opes_cm', 'Sprint4 Tenant', 'owner@opesfuel.cm', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)
            """);
        jdbcTemplate.update("DELETE FROM tenant_fuel_catalog_prices WHERE tenant_id = 'ten_opes_cm'");
        jdbcTemplate.update("DELETE FROM tank_calibration_versions WHERE tenant_id = 'ten_opes_cm'");
        jdbcTemplate.update("DELETE FROM tank_dip_readings_versioned WHERE tenant_id = 'ten_opes_cm'");
        jdbcTemplate.update("DELETE FROM shop_sale_returns WHERE tenant_id = 'ten_opes_cm'");
    }

    @Test
    void T007_globalFuelCatalogStartsEmptyAndRequiresMakerCheckerApproval() throws Exception {
        // Initial catalog grades MUST exist with null selling prices
        mockMvc.perform(get("/api/v1/enterprise/global-fuel-catalog")
                .with(user("mgr_01").roles("MANAGER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].gradeCode").value("SUPER"))
            .andExpect(jsonPath("$[0].sellingPrice").value(nullValue()))
            .andExpect(jsonPath("$[0].pricingStatus").value("UNSET_PENDING_TENANT_APPROVAL"));

        // Manager proposes a selling price -> still PENDING_APPROVAL (sellingPrice still null)
        mockMvc.perform(post("/api/v1/enterprise/global-fuel-catalog/propose-price")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"gradeCode\":\"SUPER\",\"sellingPrice\":845,\"currencyCode\":\"FCFA\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pricingStatus").value("PENDING_APPROVAL"))
            .andExpect(jsonPath("$.sellingPrice").value(nullValue()));

        // Same user self-approval MUST be blocked (409 Conflict)
        mockMvc.perform(patch("/api/v1/enterprise/global-fuel-catalog/SUPER/approve")
                .with(user("mgr_01").roles("OWNER")))
            .andExpect(status().isConflict());

        // Independent Owner approves -> price becomes ACTIVE
        mockMvc.perform(patch("/api/v1/enterprise/global-fuel-catalog/SUPER/approve")
                .with(user("owner_02").roles("OWNER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pricingStatus").value("ACTIVE"))
            .andExpect(jsonPath("$.sellingPrice").value(845));
    }

    @Test
    void T010_wetStockCalibrationChangePreservesHistoricalReadingsAndAppliesNewChart() throws Exception {
        // Publish Calibration v1: 10.0 L/mm + 0 offset
        mockMvc.perform(post("/api/v1/enterprise/tanks/tk_cal_01/calibrations")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"slopeLitresPerMm\":10.0,\"offsetLitres\":0.0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.versionNo").value(1));

        // Record dip 1000mm under v1 -> 10,000.0 L
        mockMvc.perform(post("/api/v1/enterprise/tanks/tk_cal_01/versioned-dip")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"dipMm\":1000.0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.calibrationVersionNo").value(1))
            .andExpect(jsonPath("$.calibratedLitres").value(10000.0));

        // Publish Calibration v2: 12.5 L/mm + 50 offset (new tank re-strapping)
        mockMvc.perform(post("/api/v1/enterprise/tanks/tk_cal_01/calibrations")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"slopeLitresPerMm\":12.5,\"offsetLitres\":50.0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.versionNo").value(2));

        // Record dip 1000mm under v2 -> 12,550.0 L
        mockMvc.perform(post("/api/v1/enterprise/tanks/tk_cal_01/versioned-dip")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"dipMm\":1000.0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.calibrationVersionNo").value(2))
            .andExpect(jsonPath("$.calibratedLitres").value(12550.0));

        // Verify historical reading 0 STILL preserves v1 (10,000.0 L) while reading 1 uses v2 (12,550.0 L)
        mockMvc.perform(get("/api/v1/enterprise/tanks/tk_cal_01/calibrations")
                .with(user("acct_01").roles("ACCOUNTANT")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.readings[0].calibration_version_no").value(1))
            .andExpect(jsonPath("$.readings[0].calibrated_litres").value(10000.0))
            .andExpect(jsonPath("$.readings[1].calibration_version_no").value(2))
            .andExpect(jsonPath("$.readings[1].calibrated_litres").value(12550.0));
    }

    @Test
    void T019_shopReturnBlocksOverReturnAndPostsBalancedRefundReversal() throws Exception {
        // Original sale had 3 units of 5W30 oil at 18,000 FCFA -> return 2 units succeeds (36,000 FCFA)
        mockMvc.perform(post("/api/v1/enterprise/shop-returns")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"originalSaleId\":\"sale_9001\",\"sku\":\"LUB-5W30\",\"originalQty\":3,\"returnQty\":2,\"unitPriceFcfa\":18000,\"reason\":\"Damaged seal\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.refundAmountFcfa").value(36000))
            .andExpect(jsonPath("$.cumulativeReturnedQty").value(2));

        // Attempting to return 2 MORE units on same receipt (2 + 2 > 3) MUST fail (409 Conflict)
        mockMvc.perform(post("/api/v1/enterprise/shop-returns")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"originalSaleId\":\"sale_9001\",\"sku\":\"LUB-5W30\",\"originalQty\":3,\"returnQty\":2,\"unitPriceFcfa\":18000,\"reason\":\"Duplicate claim\"}"))
            .andExpect(status().isConflict());
    }

    @Test
    void M24_interStationTransferExceedingHalfPercentLossAutoOpensFraudCase() throws Exception {
        MvcResult createRes = mockMvc.perform(post("/api/v1/enterprise/transfers")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"fromStationId\":\"st_bonanjo\",\"fromStationName\":\"Bonanjo\",\"toStationId\":\"st_bastos\",\"toStationName\":\"Bastos\",\"fuelGrade\":\"GASOIL\",\"dispatchedLitres\":20000,\"tankerPlate\":\"LT-881-CM\",\"driverName\":\"Jean-Paul Mbarga\",\"sealNumber\":\"SL-771\"}"))
            .andExpect(status().isOk())
            .andReturn();
        String transferId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asText();

        // Receiving 19,400 L out of 20,000 L = 3.0% transit shortage (>0.5%) -> auto-opens fraud case!
        mockMvc.perform(post("/api/v1/enterprise/transfers/" + transferId + "/reconcile-transit")
                .with(user("mgr_02").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"receivedLitres\":19400}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.varianceLitres").value(600.0))
            .andExpect(jsonPath("$.toleranceBreached").value(true))
            .andExpect(jsonPath("$.autoFraudCaseId").isNotEmpty());
    }

    @Test
    void M55_quarantinedTankBlocksPreDispenseAndCleanTankPasses() throws Exception {
        // Clean tank passes pre-dispense check
        mockMvc.perform(post("/api/v1/enterprise/forecourt/pre-dispense-check")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"tankId\":\"tk_clean_99\",\"pumpCode\":\"P01\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.authorized").value(true));

        // Quarantine tank due to water detection
        mockMvc.perform(post("/api/v1/enterprise/quality-samples")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"tankId\":\"tk_blocked_88\",\"tankName\":\"Tank 88\",\"fuelGrade\":\"SUPER\",\"batchCoaRef\":\"COA-88\",\"densityKgM3\":742.0,\"temperatureC\":26.5,\"waterPasteDetected\":true,\"testedBy\":\"Mgr\",\"notes\":\"Water alarm\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.quarantined").value(true));

        // Pre-dispense check on quarantined tank MUST block with 409 Conflict
        mockMvc.perform(post("/api/v1/enterprise/forecourt/pre-dispense-check")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"tankId\":\"tk_blocked_88\",\"pumpCode\":\"P04\"}"))
            .andExpect(status().isConflict());
    }
}
