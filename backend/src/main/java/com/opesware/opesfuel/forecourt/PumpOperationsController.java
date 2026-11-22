package com.opesware.opesfuel.forecourt;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

record RecordCalibrationCommand(
    @DecimalMin("0.5") BigDecimal testLitres,
    boolean returnedToTank,
    @NotBlank String inspectorName,
    String notes
) {}

record RecordMaintenanceCommand(
    @NotBlank String maintenanceType,
    @NotBlank String description,
    @Min(0) long costFcfa,
    @NotBlank String technician,
    boolean outOfService,
    String nextDueDate
) {}

@RestController
@RequestMapping("/api/v1/forecourt")
public class PumpOperationsController {
    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;

    public PumpOperationsController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping("/calibrations")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_forecourt:read')")
    public List<Map<String, Object>> listCalibrations(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        boolean filterStation = stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId);
        String sql = filterStation
            ? "SELECT * FROM pump_calibrations WHERE tenant_id = ? AND station_id = ? ORDER BY tested_at DESC"
            : "SELECT * FROM pump_calibrations WHERE tenant_id = ? ORDER BY tested_at DESC";
        Object[] args = filterStation ? new Object[]{tenantId, stationId} : new Object[]{tenantId};
        return jdbcTemplate.query(sql, (rs, idx) -> Map.<String, Object>ofEntries(
            Map.entry("id", rs.getString("id")),
            Map.entry("stationId", rs.getString("station_id")),
            Map.entry("pumpId", rs.getString("pump_id")),
            Map.entry("tankId", rs.getString("tank_id")),
            Map.entry("testLitres", rs.getBigDecimal("test_litres")),
            Map.entry("returnedToTank", rs.getBoolean("returned_to_tank")),
            Map.entry("openingTotalizer", rs.getBigDecimal("opening_totalizer")),
            Map.entry("closingTotalizer", rs.getBigDecimal("closing_totalizer")),
            Map.entry("inspectorName", rs.getString("inspector_name")),
            Map.entry("notes", rs.getString("notes") != null ? rs.getString("notes") : ""),
            Map.entry("testedAt", rs.getTimestamp("tested_at").toInstant().toString())
        ), args);
    }

    @PostMapping("/pumps/{pumpId}/calibrations")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER') or hasAuthority('SCOPE_forecourt:write')")
    public Map<String, Object> recordCalibration(
        @PathVariable String pumpId,
        @Valid @RequestBody RecordCalibrationCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        Map<String, Object> pump = jdbcTemplate.queryForMap(
            """
            SELECT p.id, p.station_id, p.tank_id, p.code, p.totalizer_litres, s.tenant_id
            FROM pumps p JOIN stations s ON s.id = p.station_id
            WHERE p.id = ?
            """,
            pumpId
        );
        String stationTenant = String.valueOf(pump.get("tenant_id"));
        String stationId = String.valueOf(pump.get("station_id"));
        String tankId = String.valueOf(pump.get("tank_id"));
        accessGuard.assertStationAccess(stationId, stationTenant);

        BigDecimal opening = (BigDecimal) pump.get("totalizer_litres");
        BigDecimal closing = opening.add(cmd.testLitres());

        // Advance pump totalizer cleanly without generating a false cash shortage.
        // If fuel is NOT returned to tank, deduct test volume from tank book stock.
        jdbcTemplate.update("UPDATE pumps SET totalizer_litres = ? WHERE id = ?", closing, pumpId);
        if (!cmd.returnedToTank()) {
            jdbcTemplate.update(
                "UPDATE fuel_tanks SET book_volume_litres = GREATEST(0, book_volume_litres - ?) WHERE id = ?",
                cmd.testLitres(), tankId
            );
        }

        String id = "cal_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO pump_calibrations (
                id, tenant_id, station_id, pump_id, tank_id, test_litres, returned_to_tank,
                opening_totalizer, closing_totalizer, inspector_name, notes, tested_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id, principal.tenantId(), stationId, pumpId, tankId, cmd.testLitres(),
            cmd.returnedToTank(), opening, closing, cmd.inspectorName(), cmd.notes(),
            Timestamp.from(Instant.now())
        );

        auditRecorder.record(
            principal.tenantId(), stationId, principal.subject(),
            principal.roles().stream().findFirst().orElse("MANAGER"),
            "PUMP_CALIBRATION_TEST", "PUMP", pumpId,
            "Recorded " + cmd.testLitres() + "L meter calibration test on " + pump.get("code")
                + (cmd.returnedToTank() ? " (returned to tank)" : " (sample retained)")
        );

        return Map.of(
            "id", id,
            "pumpId", pumpId,
            "openingTotalizer", opening,
            "closingTotalizer", closing,
            "testLitres", cmd.testLitres(),
            "returnedToTank", cmd.returnedToTank()
        );
    }

    @GetMapping("/maintenance")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_forecourt:read')")
    public List<Map<String, Object>> listMaintenance(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        boolean filterStation = stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId);
        String sql = filterStation
            ? "SELECT * FROM pump_maintenance_logs WHERE tenant_id = ? AND station_id = ? ORDER BY logged_at DESC"
            : "SELECT * FROM pump_maintenance_logs WHERE tenant_id = ? ORDER BY logged_at DESC";
        Object[] args = filterStation ? new Object[]{tenantId, stationId} : new Object[]{tenantId};
        return jdbcTemplate.query(sql, (rs, idx) -> Map.<String, Object>ofEntries(
            Map.entry("id", rs.getString("id")),
            Map.entry("stationId", rs.getString("station_id")),
            Map.entry("pumpId", rs.getString("pump_id")),
            Map.entry("maintenanceType", rs.getString("maintenance_type")),
            Map.entry("description", rs.getString("description")),
            Map.entry("costFcfa", rs.getLong("cost_fcfa")),
            Map.entry("technician", rs.getString("technician")),
            Map.entry("outOfService", rs.getBoolean("out_of_service")),
            Map.entry("nextDueDate", rs.getString("next_due_date") != null ? rs.getString("next_due_date") : ""),
            Map.entry("loggedAt", rs.getTimestamp("logged_at").toInstant().toString())
        ), args);
    }

    @PostMapping("/pumps/{pumpId}/maintenance")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER') or hasAuthority('SCOPE_forecourt:write')")
    public Map<String, Object> recordMaintenance(
        @PathVariable String pumpId,
        @Valid @RequestBody RecordMaintenanceCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        Map<String, Object> pump = jdbcTemplate.queryForMap(
            "SELECT p.id, p.station_id, p.code, s.tenant_id FROM pumps p JOIN stations s ON s.id = p.station_id WHERE p.id = ?",
            pumpId
        );
        String stationId = String.valueOf(pump.get("station_id"));
        accessGuard.assertStationAccess(stationId, String.valueOf(pump.get("tenant_id")));

        String id = "mnt_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO pump_maintenance_logs (
                id, tenant_id, station_id, pump_id, maintenance_type, description,
                cost_fcfa, technician, out_of_service, next_due_date, logged_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id, principal.tenantId(), stationId, pumpId, cmd.maintenanceType().trim().toUpperCase(),
            cmd.description(), cmd.costFcfa(), cmd.technician(), cmd.outOfService(),
            cmd.nextDueDate(), Timestamp.from(Instant.now())
        );

        auditRecorder.record(
            principal.tenantId(), stationId, principal.subject(),
            principal.roles().stream().findFirst().orElse("MANAGER"),
            "PUMP_MAINTENANCE_LOGGED", "PUMP", pumpId,
            cmd.maintenanceType() + " on " + pump.get("code") + " by " + cmd.technician() + " (" + cmd.costFcfa() + " FCFA)"
        );

        return Map.of("id", id, "pumpId", pumpId, "maintenanceType", cmd.maintenanceType().toUpperCase(), "costFcfa", cmd.costFcfa());
    }
}
