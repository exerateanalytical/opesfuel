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

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Sprint3ReleaseTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setupV8AndV10Schema() throws Exception {
        for (String mig : new String[]{
            "db/migration/V7__prelaunch_modules_hr_audit_safe_calibration.sql",
            "db/migration/V8__enterprise_modules_schema.sql",
            "db/migration/V10__sprint3_hardware_bridge_and_payroll_workflow.sql"
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
            KEY(id) VALUES ('ten_opes_cm', 'Sprint3 Tenant', 'owner@opesfuel.cm', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)
            """);
    }

    @Test
    void M44_M53_hardwareEdgeBridgesDomsAtgAndOcppIdempotentIngestion() throws Exception {
        // Register DOMS/PTS-2, Veeder-Root ATG, and OCPP 2.0.1 EV Charger devices
        mockMvc.perform(post("/api/v1/enterprise/hardware/devices")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"deviceCode\":\"PTS2-DLA-01\",\"protocol\":\"DOMS_PTS2\",\"endpointUri\":\"tcp://192.168.10.21:8088\",\"firmwareVersion\":\"v3.2.0\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ONLINE"));

        // T012: Forecourt pump controller transaction ingested once, replay deduplicated
        String txBody = "{\"stationId\":\"st_plateau\",\"deviceCode\":\"PTS2-DLA-01\",\"deviceEventId\":\"DOMS-EVT-9901\",\"pumpCode\":\"P01-SUP\",\"fuelGrade\":\"SUPER\",\"litresDispensed\":45.5,\"amountFcfa\":38220}";
        mockMvc.perform(post("/api/v1/enterprise/hardware/ingest/forecourt-tx")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(txBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.idempotentReplay").value(false));

        mockMvc.perform(post("/api/v1/enterprise/hardware/ingest/forecourt-tx")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(txBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.idempotentReplay").value(true));

        // Veeder-Root ATG reading with 22mm water triggers waterIngressAlarm
        mockMvc.perform(post("/api/v1/enterprise/hardware/ingest/atg-reading")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"deviceCode\":\"VR-TLS450\",\"deviceEventId\":\"ATG-EVT-501\",\"tankId\":\"tk_01\",\"fuelVolumeLitres\":24120.5,\"waterLevelMm\":22.4,\"temperatureC\":28.2}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.waterIngressAlarm").value(true));

        // OCPP 2.0.1 EV Charger kWh session automatically settles and posts to ev_utility_readings
        mockMvc.perform(post("/api/v1/enterprise/hardware/ingest/ocpp-session")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"deviceCode\":\"OCPP-BAY-01\",\"deviceEventId\":\"OCPP-TX-771\",\"connectorId\":\"CCS2-60KW-1\",\"kwhDelivered\":36.0,\"tariffFcfaPerKwh\":350}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.amountFcfa").value(12600));
    }

    @Test
    void M34_payroll8StateWorkflowWithMakerCheckerApprovalAndClose() throws Exception {
        MvcResult createRes = mockMvc.perform(post("/api/v1/enterprise/payroll-workflows")
                .with(user("acct_preparer").roles("ACCOUNTANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"periodLabel\":\"2026-11\",\"headcount\":12,\"grossFcfa\":2400000,\"deductionsFcfa\":185000}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("OPEN"))
            .andExpect(jsonPath("$.netPayableFcfa").value(2215000))
            .andReturn();
        String batchId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asText();

        // OPEN -> CALCULATED -> REVIEWED
        mockMvc.perform(patch("/api/v1/enterprise/payroll-workflows/" + batchId + "/advance")
                .with(user("acct_preparer").roles("ACCOUNTANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"CALCULATED\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("CALCULATED"));

        mockMvc.perform(patch("/api/v1/enterprise/payroll-workflows/" + batchId + "/advance")
                .with(user("acct_preparer").roles("ACCOUNTANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"REVIEWED\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("REVIEWED"));

        // Preparer self-approval MUST be blocked (409 Conflict)
        mockMvc.perform(patch("/api/v1/enterprise/payroll-workflows/" + batchId + "/advance")
                .with(user("acct_preparer").roles("ACCOUNTANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"APPROVED\"}"))
            .andExpect(status().isConflict());

        // Skipping state REVIEWED -> PAID directly MUST be blocked (409 Conflict)
        mockMvc.perform(patch("/api/v1/enterprise/payroll-workflows/" + batchId + "/advance")
                .with(user("owner_approver").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"nextStatus\":\"PAID\"}"))
            .andExpect(status().isConflict());

        // Owner approves -> POSTED -> PAYMENT_PENDING -> PAID -> CLOSED
        for (String step : new String[]{"APPROVED", "POSTED", "PAYMENT_PENDING", "PAID", "CLOSED"}) {
            mockMvc.perform(patch("/api/v1/enterprise/payroll-workflows/" + batchId + "/advance")
                    .with(user("owner_approver").roles("OWNER"))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"nextStatus\":\"" + step + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value(step));
        }
    }

    @Test
    void T014_mobileOfflineQueueReplayDeduplicationAndM55QuarantineStopSaleGate() throws Exception {
        String syncPayload = """
            {
              "operations": [
                {"clientOpId":"mob-op-001","stationId":"st_plateau","operationType":"SHIFT_CLOSE","payloadSummary":"P01 closing 12450L"},
                {"clientOpId":"mob-op-002","stationId":"st_plateau","operationType":"DIPSTICK","payloadSummary":"T01 dip 24100L"}
              ]
            }
            """;

        // First mobile reconnect applies both operations
        mockMvc.perform(post("/api/v1/enterprise/mobile/offline-sync")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(syncPayload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.appliedCount").value(2))
            .andExpect(jsonPath("$.duplicatesSkipped").value(0));

        // Network timeout retry replays exact same operations -> 0 applied, 2 duplicates skipped!
        mockMvc.perform(post("/api/v1/enterprise/mobile/offline-sync")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(syncPayload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.appliedCount").value(0))
            .andExpect(jsonPath("$.duplicatesSkipped").value(2));

        // M55: Water-contaminated tank triggers quarantine stop-sale gate
        mockMvc.perform(post("/api/v1/enterprise/quality-samples")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"tankId\":\"tk_q_test\",\"tankName\":\"Tank Q\",\"fuelGrade\":\"GASOIL\",\"batchCoaRef\":\"COA-Q1\",\"densityKgM3\":835.0,\"temperatureC\":27.0,\"waterPasteDetected\":true,\"testedBy\":\"Mgr\",\"notes\":\"Water positive\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.quarantined").value(true));

        mockMvc.perform(get("/api/v1/enterprise/quality-samples/tank-status/tk_q_test")
                .with(user("att_01").roles("ATTENDANT")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.quarantined").value(true))
            .andExpect(jsonPath("$.dispensingAllowed").value(false));
    }
}
