package com.opesware.opesfuel.enterprise;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

record RegisterHardwareDeviceCmd(
    @NotBlank String stationId,
    @NotBlank String deviceCode,
    @NotBlank String protocol,
    @NotBlank String endpointUri,
    String firmwareVersion
) {}

record IngestForecourtTxCmd(
    @NotBlank String stationId,
    @NotBlank String deviceCode,
    @NotBlank String deviceEventId,
    @NotBlank String pumpCode,
    @NotBlank String fuelGrade,
    double litresDispensed,
    @Min(1) long amountFcfa
) {}

record IngestAtgReadingCmd(
    @NotBlank String stationId,
    @NotBlank String deviceCode,
    @NotBlank String deviceEventId,
    @NotBlank String tankId,
    double fuelVolumeLitres,
    double waterLevelMm,
    double temperatureC
) {}

record IngestOcppSessionCmd(
    @NotBlank String stationId,
    @NotBlank String deviceCode,
    @NotBlank String deviceEventId,
    @NotBlank String connectorId,
    double kwhDelivered,
    @Min(1) long tariffFcfaPerKwh
) {}

record CreatePayrollBatchCmd(
    @NotBlank String stationId,
    @NotBlank String periodLabel,
    @Min(1) int headcount,
    @Min(0) long grossFcfa,
    @Min(0) long deductionsFcfa
) {}

record AdvancePayrollBatchCmd(@NotBlank String nextStatus) {}

record MobileOfflineOp(
    @NotBlank String clientOpId,
    @NotBlank String stationId,
    @NotBlank String operationType,
    @NotBlank String payloadSummary
) {}

record MobileOfflineSyncBatchCmd(@NotEmpty List<@Valid MobileOfflineOp> operations) {}

@RestController
@RequestMapping("/api/v1/enterprise")
public class Sprint3HardwareAndWorkflowController {
    private static final Set<String> VALID_PROTOCOLS = Set.of("DOMS_PTS2", "VEEDER_ROOT_ATG", "OCPP_201_EV");

    private static final Map<String, Set<String>> PAYROLL_TRANSITIONS = Map.of(
        "OPEN", Set.of("CALCULATED"),
        "CALCULATED", Set.of("REVIEWED"),
        "REVIEWED", Set.of("APPROVED"),
        "APPROVED", Set.of("POSTED"),
        "POSTED", Set.of("PAYMENT_PENDING"),
        "PAYMENT_PENDING", Set.of("PAID"),
        "PAID", Set.of("CLOSED"),
        "CLOSED", Set.of()
    );

    private final JdbcTemplate jdbc;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder audit;

    public Sprint3HardwareAndWorkflowController(JdbcTemplate jdbc, TenantAccessGuard accessGuard, AuditTrailRecorder audit) {
        this.jdbc = jdbc;
        this.accessGuard = accessGuard;
        this.audit = audit;
    }

    // =========================================================================
    // M44 & M53: Hardware Edge Bridge Registry & Idempotent Telemetry Ingestion
    // =========================================================================
    @GetMapping("/hardware/devices")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listDevices() {
        return jdbc.queryForList(
            "SELECT * FROM hardware_edge_devices WHERE tenant_id = ? ORDER BY created_at DESC",
            accessGuard.currentTenantId()
        );
    }

    @PostMapping("/hardware/devices")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> registerDevice(@Valid @RequestBody RegisterHardwareDeviceCmd cmd) {
        String protocol = cmd.protocol().trim().toUpperCase();
        if (!VALID_PROTOCOLS.contains(protocol)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unsupported hardware bridge protocol: " + protocol);
        }
        String tenantId = accessGuard.currentTenantId();
        String id = "hw_" + UUID.randomUUID().toString().substring(0, 8);
        Timestamp now = Timestamp.from(Instant.now());
        jdbc.update(
            "INSERT INTO hardware_edge_devices (id, tenant_id, station_id, device_code, protocol, endpoint_uri, firmware_version, status, last_heartbeat_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.deviceCode().trim().toUpperCase(), protocol,
            cmd.endpointUri().trim(), cmd.firmwareVersion() != null ? cmd.firmwareVersion() : "v2.4.1",
            "ONLINE", now, now
        );
        return Map.of("id", id, "deviceCode", cmd.deviceCode().trim().toUpperCase(), "protocol", protocol, "status", "ONLINE");
    }

    @PostMapping("/hardware/ingest/forecourt-tx")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT') or hasAuthority('SCOPE_forecourt:write')")
    @Transactional
    public Map<String, Object> ingestForecourtTx(@Valid @RequestBody IngestForecourtTxCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        if (eventExists(tenantId, cmd.deviceEventId())) {
            return Map.of("acknowledged", true, "idempotentReplay", true, "deviceEventId", cmd.deviceEventId());
        }
        String id = "hwe_" + UUID.randomUUID().toString().substring(0, 8);
        String summary = "DOMS/PTS-2 " + cmd.pumpCode() + " (" + cmd.fuelGrade() + "): " + cmd.litresDispensed() + " L = " + cmd.amountFcfa() + " FCFA";
        jdbc.update(
            "INSERT INTO hardware_telemetry_events (id, tenant_id, station_id, device_code, protocol, device_event_id, summary, alarm_triggered, received_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.deviceCode(), "DOMS_PTS2", cmd.deviceEventId(), summary, false, Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "acknowledged", true, "idempotentReplay", false, "summary", summary);
    }

    @PostMapping("/hardware/ingest/atg-reading")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER') or hasAuthority('SCOPE_inventory:write')")
    @Transactional
    public Map<String, Object> ingestAtgReading(@Valid @RequestBody IngestAtgReadingCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        if (eventExists(tenantId, cmd.deviceEventId())) {
            return Map.of("acknowledged", true, "idempotentReplay", true, "deviceEventId", cmd.deviceEventId());
        }
        boolean waterAlarm = cmd.waterLevelMm() > 15.0;
        String id = "hwe_" + UUID.randomUUID().toString().substring(0, 8);
        String summary = "Veeder-Root ATG " + cmd.tankId() + ": " + cmd.fuelVolumeLitres() + " L | Water " + cmd.waterLevelMm() + "mm | " + cmd.temperatureC() + "C";
        jdbc.update(
            "INSERT INTO hardware_telemetry_events (id, tenant_id, station_id, device_code, protocol, device_event_id, summary, alarm_triggered, received_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.deviceCode(), "VEEDER_ROOT_ATG", cmd.deviceEventId(), summary, waterAlarm, Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "acknowledged", true, "idempotentReplay", false, "waterIngressAlarm", waterAlarm, "summary", summary);
    }

    @PostMapping("/hardware/ingest/ocpp-session")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    @Transactional
    public Map<String, Object> ingestOcppSession(@Valid @RequestBody IngestOcppSessionCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        if (eventExists(tenantId, cmd.deviceEventId())) {
            return Map.of("acknowledged", true, "idempotentReplay", true, "deviceEventId", cmd.deviceEventId());
        }
        long amountFcfa = Math.round(cmd.kwhDelivered() * cmd.tariffFcfaPerKwh());
        String id = "hwe_" + UUID.randomUUID().toString().substring(0, 8);
        String summary = "OCPP 2.0.1 " + cmd.connectorId() + ": " + cmd.kwhDelivered() + " kWh = " + amountFcfa + " FCFA";
        Timestamp now = Timestamp.from(Instant.now());
        jdbc.update(
            "INSERT INTO hardware_telemetry_events (id, tenant_id, station_id, device_code, protocol, device_event_id, summary, alarm_triggered, received_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.deviceCode(), "OCPP_201_EV", cmd.deviceEventId(), summary, false, now
        );
        jdbc.update(
            "INSERT INTO ev_utility_readings (id, tenant_id, station_id, meter_type, connector_or_meter, quantity_unit, unit_label, revenue_or_cost_fcfa, recorded_at) VALUES (?,?,?,?,?,?,?,?,?)",
            "evu_" + UUID.randomUUID().toString().substring(0, 8), tenantId, cmd.stationId(),
            "EV_CHARGER_SESSION", cmd.connectorId(), cmd.kwhDelivered(), "kWh", amountFcfa, now
        );
        return Map.of("id", id, "acknowledged", true, "idempotentReplay", false, "amountFcfa", amountFcfa, "summary", summary);
    }

    @GetMapping("/hardware/events")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listHardwareEvents() {
        return jdbc.queryForList(
            "SELECT * FROM hardware_telemetry_events WHERE tenant_id = ? ORDER BY received_at DESC LIMIT 50",
            accessGuard.currentTenantId()
        );
    }

    // =========================================================================
    // M34: Strict 8-State Payroll Workflow Engine
    // =========================================================================
    @GetMapping("/payroll-workflows")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listPayrollBatches() {
        return jdbc.queryForList(
            "SELECT * FROM payroll_workflow_batches WHERE tenant_id = ? ORDER BY created_at DESC",
            accessGuard.currentTenantId()
        );
    }

    @PostMapping("/payroll-workflows")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public Map<String, Object> createPayrollBatch(@Valid @RequestBody CreatePayrollBatchCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String id = "prw_" + UUID.randomUUID().toString().substring(0, 8);
        long net = Math.max(0L, cmd.grossFcfa() - cmd.deductionsFcfa());
        Timestamp now = Timestamp.from(Instant.now());
        jdbc.update(
            "INSERT INTO payroll_workflow_batches (id, tenant_id, station_id, period_label, headcount, gross_fcfa, deductions_fcfa, net_payable_fcfa, status, prepared_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.periodLabel(), cmd.headcount(), cmd.grossFcfa(),
            cmd.deductionsFcfa(), net, "OPEN", actor.subject(), now, now
        );
        return Map.of("id", id, "status", "OPEN", "netPayableFcfa", net);
    }

    @PatchMapping("/payroll-workflows/{batchId}/advance")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public Map<String, Object> advancePayrollBatch(@PathVariable String batchId, @Valid @RequestBody AdvancePayrollBatchCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        Map<String, Object> row = jdbc.queryForMap(
            "SELECT status, prepared_by FROM payroll_workflow_batches WHERE id = ? AND tenant_id = ?",
            batchId, tenantId
        );
        String current = String.valueOf(row.get("status"));
        String preparedBy = String.valueOf(row.get("prepared_by"));
        String next = cmd.nextStatus().trim().toUpperCase();

        if (!PAYROLL_TRANSITIONS.getOrDefault(current, Set.of()).contains(next)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Invalid payroll state transition: " + current + " -> " + next);
        }
        if ("APPROVED".equals(next) && preparedBy.equalsIgnoreCase(actor.subject())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Maker-checker violation: payroll preparer cannot approve own payroll batch.");
        }
        jdbc.update(
            "UPDATE payroll_workflow_batches SET status = ?, approved_by = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by END, updated_at = ? WHERE id = ? AND tenant_id = ?",
            next, next, actor.subject(), Timestamp.from(Instant.now()), batchId, tenantId
        );
        audit.record(tenantId, null, actor.subject(), actor.roles().toString(), "PAYROLL_BATCH_" + next, "PAYROLL", batchId, current + " -> " + next);
        return Map.of("id", batchId, "previousStatus", current, "status", next);
    }

    // =========================================================================
    // M45 / T014: Mobile Offline Sync Deduplication & M55 Tank Quarantine Gate
    // =========================================================================
    @PostMapping("/mobile/offline-sync")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    @Transactional
    public Map<String, Object> syncMobileOfflineQueue(@Valid @RequestBody MobileOfflineSyncBatchCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        int applied = 0;
        int duplicatesSkipped = 0;
        List<Map<String, Object>> results = new ArrayList<>();

        for (MobileOfflineOp op : cmd.operations()) {
            Integer existing = jdbc.queryForObject(
                "SELECT COUNT(*) FROM mobile_offline_sync_log WHERE tenant_id = ? AND client_op_id = ?",
                Integer.class, tenantId, op.clientOpId()
            );
            if (existing != null && existing > 0) {
                duplicatesSkipped++;
                results.add(Map.of("clientOpId", op.clientOpId(), "status", "DUPLICATE_SKIPPED"));
            } else {
                String id = "msy_" + UUID.randomUUID().toString().substring(0, 8);
                jdbc.update(
                    "INSERT INTO mobile_offline_sync_log (id, tenant_id, station_id, client_op_id, operation_type, actor_sub, payload_summary, synced_at) VALUES (?,?,?,?,?,?,?,?)",
                    id, tenantId, op.stationId(), op.clientOpId(), op.operationType().toUpperCase(),
                    actor.subject(), op.payloadSummary(), Timestamp.from(Instant.now())
                );
                applied++;
                results.add(Map.of("clientOpId", op.clientOpId(), "status", "APPLIED", "syncId", id));
            }
        }
        return Map.of("appliedCount", applied, "duplicatesSkipped", duplicatesSkipped, "results", results);
    }

    @GetMapping("/quality-samples/tank-status/{tankId}")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public Map<String, Object> checkTankQuarantineGate(@PathVariable String tankId) {
        String tenantId = accessGuard.currentTenantId();
        Integer qCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM fuel_quality_samples WHERE tenant_id = ? AND tank_id = ? AND quarantined = TRUE",
            Integer.class, tenantId, tankId
        );
        boolean quarantined = qCount != null && qCount > 0;
        return Map.of("tankId", tankId, "quarantined", quarantined, "dispensingAllowed", !quarantined);
    }

    private boolean eventExists(String tenantId, String deviceEventId) {
        Integer c = jdbc.queryForObject(
            "SELECT COUNT(*) FROM hardware_telemetry_events WHERE tenant_id = ? AND device_event_id = ?",
            Integer.class, tenantId, deviceEventId
        );
        return c != null && c > 0;
    }
}
