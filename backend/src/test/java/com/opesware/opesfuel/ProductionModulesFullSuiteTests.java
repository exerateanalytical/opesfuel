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

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProductionModulesFullSuiteTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    void setupSchemas() throws Exception {
        for (String mig : new String[]{
            "db/migration/V10__sprint3_hardware_bridge_and_payroll_workflow.sql",
            "db/migration/V13__platform_admin_governance.sql",
            "db/migration/V14__cameroon_momo_payments.sql",
            "db/migration/V15__messaging_delivery_and_otps.sql",
            "db/migration/V16__issued_documents_registry.sql",
            "db/migration/V17__fleet_client_portal.sql",
            "db/migration/V18__lpg_cylinder_exchange.sql",
            "db/migration/V19__cmms_maintenance_generator_parts.sql",
            "db/migration/V20__edge_agent_devices.sql",
            "db/migration/V21__customer_loyalty_and_receipts.sql",
            "db/migration/V22__holding_group_consolidation.sql"
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
            MERGE INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, created_at)
            KEY(id) VALUES ('st_plateau', 'ten_opes_cm', 'DLA-01', 'Bonanjo Flagship', 'Douala', 'FCFA', 'Pro', 50000, CURRENT_TIMESTAMP)
            """);
    }

    @Test
    void documentVerifyPortalHandlesValidRevokedExpiredAndNotFound() throws Exception {
        String fp = "OPF-99AA-11BB-22CC-33DD";
        mockMvc.perform(post("/api/v1/documents/register")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"fingerprint":"OPF-99AA-11BB-22CC-33DD","docType":"LICENSE_CERTIFICATE","docSerial":"LIC-2026-01",
                     "organizationName":"OpesFuel Cameroon SA","subjectName":"Bonanjo Energy","sha256Hash":"abc123def456","expiresAt":"2028-12-31"}
                    """))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("VALID"));

        // Public verification works without auth
        mockMvc.perform(get("/api/v1/public/verify/" + fp))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("VALID"))
            .andExpect(jsonPath("$.verified").value(true))
            .andExpect(jsonPath("$.organizationName").value("OpesFuel Cameroon SA"));

        // Revoke -> public verify immediately shows REVOKED
        mockMvc.perform(post("/api/v1/documents/" + fp + "/revoke")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"reason\":\"Superseded by renewed enterprise license\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("REVOKED"));

        mockMvc.perform(get("/api/v1/public/verify/" + fp))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("REVOKED"))
            .andExpect(jsonPath("$.verified").value(false));

        // Unknown fingerprint -> NOT_FOUND
        mockMvc.perform(get("/api/v1/public/verify/OPF-0000-0000-0000-0000"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("NOT_FOUND"));
    }

    @Test
    void corporateFleetPortalLoginScopingAndServerSideSpendLimitEnforcement() throws Exception {
        // Create fleet account
        MvcResult accRes = mockMvc.perform(post("/api/v1/fleet/accounts")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"companyName\":\"Camrail Logistics SA\",\"taxId\":\"M0126000991\",\"creditLimitFcfa\":5000000}"))
            .andExpect(status().isCreated())
            .andReturn();
        String accountId = objectMapper.readTree(accRes.getResponse().getContentAsString()).get("id").asText();

        // Register vehicle
        mockMvc.perform(post("/api/v1/fleet/accounts/" + accountId + "/vehicles")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"plateNumber\":\"LT-441-CM\",\"driverName\":\"Paul Ndongo\",\"allowedGrade\":\"GASOIL\",\"monthlyLitreCap\":1500}"))
            .andExpect(status().isCreated());

        // Invite fleet portal client user
        mockMvc.perform(post("/api/v1/fleet/accounts/" + accountId + "/portal-users")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"fleetmgr@camrail.cm\",\"fullName\":\"Marc Fotso\",\"phone\":\"+237699001122\",\"temporaryPassword\":\"Camrail2026!\"}"))
            .andExpect(status().isCreated());

        // Login as corporate fleet client
        MvcResult loginRes = mockMvc.perform(post("/api/v1/public/fleet-portal/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"fleetmgr@camrail.cm\",\"password\":\"Camrail2026!\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("FLEET_CLIENT"))
            .andReturn();
        String fleetToken = objectMapper.readTree(loginRes.getResponse().getContentAsString()).get("token").asText();

        // Dashboard accessible with X-Fleet-Token
        mockMvc.perform(get("/api/v1/fleet-portal/dashboard").header("X-Fleet-Token", fleetToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.companyName").value("Camrail Logistics SA"))
            .andExpect(jsonPath("$.creditLimitFcfa").value(5000000));

        // Fleet client cannot access station admin endpoints (RBAC isolation)
        mockMvc.perform(get("/api/v1/fleet/accounts").header("X-Fleet-Token", fleetToken))
            .andExpect(status().isForbidden());

        // Fleet client sets strict vehicle spend limit: GASOIL only, max 100L/day
        mockMvc.perform(put("/api/v1/fleet-portal/vehicles/LT-441-CM/limits")
                .header("X-Fleet-Token", fleetToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"cardNumber\":\"CRD-441\",\"dailyLitreCap\":100,\"monthlyLitreCap\":1500,\"dailyXafCap\":100000,\"allowedGradesCsv\":\"GASOIL\",\"active\":true}"))
            .andExpect(status().isOk());

        // Server-side guard BLOCKS unauthorized grade (SUPER) -> 409 Conflict
        mockMvc.perform(post("/api/v1/fleet/vouchers")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"accountId\":\"" + accountId + "\",\"stationId\":\"st_plateau\",\"vehiclePlate\":\"LT-441-CM\",\"driverName\":\"Paul Ndongo\",\"grade\":\"SUPER\",\"litres\":30}"))
            .andExpect(status().isConflict());

        // Server-side guard ALLOWS authorized GASOIL within daily cap (60L <= 100L)
        mockMvc.perform(post("/api/v1/fleet/vouchers")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"accountId\":\"" + accountId + "\",\"stationId\":\"st_plateau\",\"vehiclePlate\":\"LT-441-CM\",\"driverName\":\"Paul Ndongo\",\"grade\":\"GASOIL\",\"litres\":60}"))
            .andExpect(status().isCreated());

        // Server-side guard BLOCKS second fueling exceeding 100L daily cap (60 + 50 = 110 > 100)
        mockMvc.perform(post("/api/v1/fleet/vouchers")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"accountId\":\"" + accountId + "\",\"stationId\":\"st_plateau\",\"vehiclePlate\":\"LT-441-CM\",\"driverName\":\"Paul Ndongo\",\"grade\":\"GASOIL\",\"litres\":50}"))
            .andExpect(status().isConflict());

        // CSV export & VAT statement work for fleet client
        mockMvc.perform(get("/api/v1/fleet-portal/fuelings.csv").header("X-Fleet-Token", fleetToken))
            .andExpect(status().isOk())
            .andExpect(content().string(org.hamcrest.Matchers.containsString("LT-441-CM")));

        String period = java.time.YearMonth.now(java.time.ZoneOffset.UTC).toString();
        mockMvc.perform(get("/api/v1/fleet-portal/statements/" + period).header("X-Fleet-Token", fleetToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalLitres").value(60.0));
    }

    @Test
    void lpgCylinderExchangeTracksFullEmptyDepositsAndGuardsNegativeStock() throws Exception {
        MvcResult s1 = mockMvc.perform(post("/api/v1/lpg/skus")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"brand\":\"TRADEX\",\"sizeKg\":12.5,\"skuCode\":\"TDX-12.5KG\",\"gasRefillPriceFcfa\":6500,\"depositFcfa\":18000,\"crossBrandSwapFeeFcfa\":1500}"))
            .andExpect(status().isOk()).andReturn();
        String tdxId = objectMapper.readTree(s1.getResponse().getContentAsString()).get("id").asText();

        MvcResult s2 = mockMvc.perform(post("/api/v1/lpg/skus")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"brand\":\"TOTALGAZ\",\"sizeKg\":12.5,\"skuCode\":\"TOT-12.5KG\",\"gasRefillPriceFcfa\":6500,\"depositFcfa\":18000,\"crossBrandSwapFeeFcfa\":1500}"))
            .andExpect(status().isOk()).andReturn();
        String totId = objectMapper.readTree(s2.getResponse().getContentAsString()).get("id").asText();

        // Negative stock guard blocks refill before delivery
        mockMvc.perform(post("/api/v1/lpg/transactions")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"skuId\":\"" + tdxId + "\",\"txType\":\"REFILL_EXCHANGE\",\"quantity\":2}"))
            .andExpect(status().isConflict());

        // Attendant blocked from SUPPLIER_DELIVERY (RBAC)
        mockMvc.perform(post("/api/v1/lpg/transactions")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"skuId\":\"" + tdxId + "\",\"txType\":\"SUPPLIER_DELIVERY\",\"quantity\":20}"))
            .andExpect(status().isForbidden());

        // Manager receives 20 full bottles
        mockMvc.perform(post("/api/v1/lpg/transactions")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"skuId\":\"" + tdxId + "\",\"txType\":\"SUPPLIER_DELIVERY\",\"quantity\":20}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.remainingFullQty").value(20));

        // Attendant does refill exchange (2 full out, 2 empty in -> 13,000 FCFA)
        mockMvc.perform(post("/api/v1/lpg/transactions")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"skuId\":\"" + tdxId + "\",\"txType\":\"REFILL_EXCHANGE\",\"quantity\":2,\"customerName\":\"Mme Bello\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.remainingFullQty").value(18))
            .andExpect(jsonPath("$.remainingEmptyQty").value(2))
            .andExpect(jsonPath("$.totalFcfa").value(13000));

        // New sale with deposit (1 bottle -> 6500 gas + 18000 deposit = 24500 FCFA)
        mockMvc.perform(post("/api/v1/lpg/transactions")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"skuId\":\"" + tdxId + "\",\"txType\":\"NEW_SALE_WITH_DEPOSIT\",\"quantity\":1}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.depositDeltaFcfa").value(18000))
            .andExpect(jsonPath("$.totalFcfa").value(24500));

        // Cross-brand swap (customer brings empty TOTALGAZ, gets full TRADEX + 1500 fee)
        mockMvc.perform(post("/api/v1/lpg/transactions")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"skuId\":\"" + tdxId + "\",\"swapFromSkuId\":\"" + totId + "\",\"txType\":\"CROSS_BRAND_SWAP\",\"quantity\":1}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.swapFeeFcfa").value(1500))
            .andExpect(jsonPath("$.totalFcfa").value(8000));

        // Daily reconciliation verifies deposit liability = 18000
        mockMvc.perform(get("/api/v1/lpg/reconciliation?stationId=st_plateau").with(user("mgr_01").roles("MANAGER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.cumulativeDepositLiabilityFcfa").value(18000))
            .andExpect(jsonPath("$.totalFullBottles").value(16));
    }

    @Test
    void cmmsWorkOrderStateMachinePmGeneratorAndSparePartsRollup() throws Exception {
        MvcResult woRes = mockMvc.perform(post("/api/v1/cmms/work-orders")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"assetName\":\"Perkins 250kVA Generator\",\"orderType\":\"CORRECTIVE\",\"priority\":\"HIGH\",\"title\":\"AVR Voltage Regulator Fault\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("OPEN")).andReturn();
        String woId = objectMapper.readTree(woRes.getResponse().getContentAsString()).get("id").asText();

        // Invalid transition OPEN -> VERIFIED must fail (409)
        mockMvc.perform(patch("/api/v1/cmms/work-orders/" + woId + "/transition")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"VERIFIED\"}"))
            .andExpect(status().isConflict());

        // Valid progression OPEN -> ASSIGNED -> IN_PROGRESS -> DONE -> VERIFIED
        mockMvc.perform(patch("/api/v1/cmms/work-orders/" + woId + "/transition")
                .with(user("mgr_01").roles("MANAGER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"ASSIGNED\",\"assignedTechnician\":\"Tech Jean\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("ASSIGNED"));
        mockMvc.perform(patch("/api/v1/cmms/work-orders/" + woId + "/transition")
                .with(user("mgr_01").roles("MANAGER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"IN_PROGRESS\"}"))
            .andExpect(status().isOk());

        // Create spare part & issue 2 units to WO
        MvcResult partRes = mockMvc.perform(post("/api/v1/cmms/spare-parts")
                .with(user("mgr_01").roles("MANAGER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"partCode\":\"AVR-SX460\",\"partName\":\"AVR Module SX460\",\"category\":\"GENERATOR\",\"stockQty\":3,\"reorderLevel\":1,\"unitCostFcfa\":45000}"))
            .andExpect(status().isOk()).andReturn();
        String partId = objectMapper.readTree(partRes.getResponse().getContentAsString()).get("id").asText();

        mockMvc.perform(post("/api/v1/cmms/spare-parts/" + partId + "/issue")
                .with(user("mgr_01").roles("MANAGER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"workOrderId\":\"" + woId + "\",\"quantity\":2}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalCostFcfa").value(90000))
            .andExpect(jsonPath("$.reorderAlert").value(true));

        mockMvc.perform(patch("/api/v1/cmms/work-orders/" + woId + "/transition")
                .with(user("mgr_01").roles("MANAGER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"DONE\",\"laborCostFcfa\":35000}"))
            .andExpect(status().isOk());
        mockMvc.perform(patch("/api/v1/cmms/work-orders/" + woId + "/transition")
                .with(user("owner_01").roles("OWNER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"VERIFIED\"}"))
            .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("VERIFIED"));

        // Asset cost rollup = 35000 labor + 90000 parts = 125000
        mockMvc.perform(get("/api/v1/cmms/cost-rollup").with(user("acct_01").roles("ACCOUNTANT")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].total_maintenance_fcfa").value(125000));

        // Standby generator runtime log
        mockMvc.perform(post("/api/v1/cmms/generator-logs")
                .with(user("mgr_01").roles("MANAGER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"generatorName\":\"Perkins 250kVA\",\"hoursStart\":1240.5,\"hoursEnd\":1246.5,\"fuelLitres\":48.0,\"fuelSource\":\"INTERNAL_DIESEL_TANK\",\"fuelCostFcfa\":39744,\"powerOutageReason\":\"ENEO grid feeder trip\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.runtime_hours").value(6.0))
            .andExpect(jsonPath("$.litresPerHour").value(8.0));

        // Due PM schedule auto-generates PREVENTIVE WO
        mockMvc.perform(post("/api/v1/cmms/pm-schedules")
                .with(user("mgr_01").roles("MANAGER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"assetName\":\"Tokheim Pump 01\",\"title\":\"Nozzle Filter & Seal Check\",\"intervalDays\":30,\"nextDueDate\":\"2020-01-01\"}"))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/cmms/pm-schedules/generate-due").with(user("mgr_01").roles("MANAGER")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.generatedWorkOrders").value(1));
    }

    @Test
    void edgeDeviceRegistryHeartbeatIngestAndRevocation() throws Exception {
        MvcResult devRes = mockMvc.perform(post("/api/v1/edge/devices")
                .with(user("owner_01").roles("OWNER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"deviceName\":\"RPi4-Bonanjo-Site01\",\"driversCsv\":\"DOMS_PTS2,VEEDER_ROOT_ATG,OCPP_201_EV\"}"))
            .andExpect(status().isCreated()).andReturn();
        JsonNode dev = objectMapper.readTree(devRes.getResponse().getContentAsString());
        String devId = dev.get("id").asText();
        String apiKey = dev.get("apiKey").asText();
        assertTrue(apiKey.startsWith("opf_edge_"));

        // Heartbeat with valid X-Edge-Key succeeds
        mockMvc.perform(post("/api/v1/public/edge/heartbeat")
                .header("X-Edge-Key", apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"agentVersion\":\"1.0.0\",\"hostname\":\"rpi-bonanjo\",\"outboxDepth\":0}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.acknowledged").value(true));

        // Ingest telemetry (first time + idempotent replay)
        String ingestBody = "{\"protocol\":\"DOMS_PTS2\",\"deviceEventId\":\"PTS-EVT-771\",\"summary\":\"Pump 1: 50L SUPER\",\"alarmTriggered\":false}";
        mockMvc.perform(post("/api/v1/public/edge/ingest").header("X-Edge-Key", apiKey)
                .contentType(MediaType.APPLICATION_JSON).content(ingestBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.idempotentReplay").value(false));
        mockMvc.perform(post("/api/v1/public/edge/ingest").header("X-Edge-Key", apiKey)
                .contentType(MediaType.APPLICATION_JSON).content(ingestBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.idempotentReplay").value(true));

        // Revoke key -> subsequent heartbeat rejected with 401
        mockMvc.perform(post("/api/v1/edge/devices/" + devId + "/revoke").with(user("owner_01").roles("OWNER")))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/public/edge/heartbeat").header("X-Edge-Key", apiKey))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void loyaltyEarnCampaignRedeemPublicPassAndWhatsappReceipt() throws Exception {
        mockMvc.perform(post("/api/v1/loyalty/rules")
                .with(user("mgr_01").roles("MANAGER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"fuelGrade\":\"SUPER\",\"pointsPerLitre\":2.0,\"pointsPer1000Xaf\":0}"))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/loyalty/campaigns")
                .with(user("mgr_01").roles("MANAGER")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"All-Day 5% Promo\",\"campaignType\":\"HAPPY_HOUR\",\"discountPct\":5.0,\"fuelGrade\":\"SUPER\",\"startHour\":0,\"endHour\":23}"))
            .andExpect(status().isCreated());

        MvcResult earnRes = mockMvc.perform(post("/api/v1/loyalty/earn")
                .with(user("att_01").roles("ATTENDANT")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"+237677998877\",\"fuelGrade\":\"SUPER\",\"litres\":250.0,\"amountXaf\":210000,\"reference\":\"SHIFT-101\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.earnedPoints").value(500))
            .andExpect(jsonPath("$.discountXaf").value(10500))
            .andExpect(jsonPath("$.tier").value("SILVER"))
            .andReturn();
        String passToken = objectMapper.readTree(earnRes.getResponse().getContentAsString()).get("passToken").asText();

        // Redeem 100 pts (1000 FCFA) -> 400 left
        mockMvc.perform(post("/api/v1/loyalty/redeem")
                .with(user("att_01").roles("ATTENDANT")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"phone\":\"+237677998877\",\"points\":100,\"reference\":\"POS-12\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.remainingBalance").value(400));

        // Public pass lookup without auth
        mockMvc.perform(get("/api/v1/public/loyalty/pass/" + passToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.pointsBalance").value(400))
            .andExpect(jsonPath("$.tier").value("SILVER"));

        // Send digital WhatsApp receipt
        mockMvc.perform(post("/api/v1/loyalty/receipts/send")
                .with(user("att_01").roles("ATTENDANT")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"channel\":\"WHATSAPP\",\"recipientPhone\":\"+237677998877\",\"stationName\":\"Bonanjo Flagship\",\"fuelGrade\":\"SUPER\",\"litres\":50,\"totalFcfa\":42000}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.channel").value("WHATSAPP"));
    }

    @Test
    void holdingGroupConsolidationMultiCurrencyEliminationsAndMinorityInterest() throws Exception {
        // Set FX rate = 600 XAF / USD in V13 platform_global_settings table
        jdbcTemplate.update("""
            MERGE INTO platform_global_settings (id, xaf_per_usd_rate, updated_at)
            KEY(id) VALUES ('GLOBAL', 600.0, CURRENT_TIMESTAMP)
            """);

        MvcResult gRes = mockMvc.perform(post("/api/v1/consolidation/groups")
                .with(user("cfo_01").roles("GROUP_CFO")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"OpesEnergy Africa Holding\",\"reportingCurrency\":\"XAF\"}"))
            .andExpect(status().isCreated()).andReturn();
        String groupId = objectMapper.readTree(gRes.getResponse().getContentAsString()).get("id").asText();

        // Add 3 subsidiaries: Cameroon (XAF, 100%), Senegal (XOF, 80% -> 20% NCI), Liberia (USD, 100%)
        mockMvc.perform(post("/api/v1/consolidation/groups/" + groupId + "/members")
                .with(user("cfo_01").roles("GROUP_CFO")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"tenantId\":\"ten_cm\",\"functionalCurrency\":\"XAF\",\"ownershipPct\":100}")).andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/consolidation/groups/" + groupId + "/members")
                .with(user("cfo_01").roles("GROUP_CFO")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"tenantId\":\"ten_sn\",\"functionalCurrency\":\"XOF\",\"ownershipPct\":80}")).andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/consolidation/groups/" + groupId + "/members")
                .with(user("cfo_01").roles("GROUP_CFO")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"tenantId\":\"ten_lr\",\"functionalCurrency\":\"USD\",\"ownershipPct\":100}")).andExpect(status().isCreated());

        // Submit 2026-11 financials
        mockMvc.perform(post("/api/v1/consolidation/groups/" + groupId + "/financials")
                .with(user("cfo_01").roles("GROUP_CFO")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"tenantId\":\"ten_cm\",\"periodLabel\":\"2026-11\",\"revenue\":10000000,\"costOfSales\":7000000,\"operatingExpenses\":1000000,\"totalAssets\":50000000,\"totalLiabilities\":20000000,\"equity\":30000000,\"receivablesIntercompany\":2000000,\"payablesIntercompany\":0}"))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/consolidation/groups/" + groupId + "/financials")
                .with(user("cfo_01").roles("GROUP_CFO")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"tenantId\":\"ten_sn\",\"periodLabel\":\"2026-11\",\"revenue\":5000000,\"costOfSales\":3500000,\"operatingExpenses\":500000,\"totalAssets\":25000000,\"totalLiabilities\":10000000,\"equity\":15000000,\"receivablesIntercompany\":0,\"payablesIntercompany\":2000000}"))
            .andExpect(status().isOk());
        // USD subsidiary: $10,000 rev * 600 = 6,000,000 XAF
        mockMvc.perform(post("/api/v1/consolidation/groups/" + groupId + "/financials")
                .with(user("cfo_01").roles("GROUP_CFO")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"tenantId\":\"ten_lr\",\"periodLabel\":\"2026-11\",\"revenue\":10000,\"costOfSales\":6000,\"operatingExpenses\":1000,\"totalAssets\":40000,\"totalLiabilities\":10000,\"equity\":30000,\"receivablesIntercompany\":0,\"payablesIntercompany\":0}"))
            .andExpect(status().isOk());

        // Intercompany fuel supply CM -> SN of 2,000,000 XAF and eliminate
        mockMvc.perform(post("/api/v1/consolidation/groups/" + groupId + "/intercompany")
                .with(user("cfo_01").roles("GROUP_CFO")).contentType(MediaType.APPLICATION_JSON)
                .content("{\"periodLabel\":\"2026-11\",\"sellerTenantId\":\"ten_cm\",\"buyerTenantId\":\"ten_sn\",\"currency\":\"XAF\",\"amount\":2000000,\"description\":\"Bulk gasoil transfer\"}"))
            .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/consolidation/groups/" + groupId + "/eliminate?period=2026-11")
                .with(user("cfo_01").roles("GROUP_CFO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.eliminatedTransactions").value(1));

        // Consolidated report:
        // Gross Rev = 10M + 5M + 6M = 21M; Elim = 2M -> Consolidated Rev = 19M
        // SN net income = 1M -> 20% minority interest = 200,000 XAF
        mockMvc.perform(get("/api/v1/consolidation/groups/" + groupId + "/report?period=2026-11")
                .with(user("cfo_01").roles("GROUP_CFO")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.consolidatedPnl.consolidatedRevenue").value(19000000.0))
            .andExpect(jsonPath("$.consolidatedPnl.minorityInterestNetIncome").value(200000.0))
            .andExpect(jsonPath("$.consolidatedBalanceSheet.intercompanyBalanceElimination").value(2000000.0));
    }
}
