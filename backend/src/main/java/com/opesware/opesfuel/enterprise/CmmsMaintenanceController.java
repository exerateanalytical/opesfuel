package com.opesware.opesfuel.enterprise;

import com.opesware.opesfuel.inventory.InventoryQueryApi;
import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

record CreateWorkOrderCommand(
    @NotBlank String stationId,
    String assetId,
    @NotBlank String assetName,
    @NotBlank String orderType,
    String priority,
    @NotBlank String title,
    String description,
    String assignedTechnician,
    String scheduledDate
) {}

record TransitionWorkOrderCommand(
    @NotBlank String nextStatus,
    String assignedTechnician,
    Long laborCostFcfa
) {}

record CreatePmScheduleCommand(
    @NotBlank String stationId,
    String assetId,
    @NotBlank String assetName,
    @NotBlank String title,
    Integer intervalDays,
    Double intervalHours,
    String nextDueDate
) {}

record LogGeneratorRuntimeCommand(
    @NotBlank String stationId,
    String assetId,
    @NotBlank String generatorName,
    double hoursStart,
    double hoursEnd,
    @Positive double fuelLitres,
    String fuelSource,
    long fuelCostFcfa,
    String powerOutageReason,
    Boolean deductInternalDieselTank
) {}

record CreateSparePartCommand(
    @NotBlank String stationId,
    @NotBlank String partCode,
    @NotBlank String partName,
    String category,
    @Min(0) int stockQty,
    @Min(0) int reorderLevel,
    @Min(0) long unitCostFcfa
) {}

record IssueSparePartCommand(
    @NotBlank String workOrderId,
    @Min(1) int quantity
) {}

@RestController
@RequestMapping("/api/v1/cmms")
public class CmmsMaintenanceController {

    private static final Logger log = LoggerFactory.getLogger(CmmsMaintenanceController.class);

    private static final Map<String, Set<String>> ALLOWED_TRANSITIONS = Map.of(
        "OPEN", Set.of("ASSIGNED", "IN_PROGRESS"),
        "ASSIGNED", Set.of("IN_PROGRESS", "ON_HOLD"),
        "IN_PROGRESS", Set.of("ON_HOLD", "DONE"),
        "ON_HOLD", Set.of("IN_PROGRESS", "ASSIGNED"),
        "DONE", Set.of("VERIFIED", "IN_PROGRESS"),
        "VERIFIED", Set.of()
    );

    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;
    private final InventoryQueryApi inventoryQueryApi;

    public CmmsMaintenanceController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder,
        InventoryQueryApi inventoryQueryApi
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
        this.inventoryQueryApi = inventoryQueryApi;
    }

    // --- WORK ORDERS ---

    @GetMapping("/work-orders")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listWorkOrders(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        if (stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId)) {
            return jdbcTemplate.queryForList(
                "SELECT * FROM cmms_work_orders WHERE tenant_id = ? AND station_id = ? ORDER BY created_at DESC LIMIT 200",
                tenantId, stationId
            );
        }
        return jdbcTemplate.queryForList(
            "SELECT * FROM cmms_work_orders WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 200",
            tenantId
        );
    }

    @PostMapping("/work-orders")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> createWorkOrder(@Valid @RequestBody CreateWorkOrderCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String id = "wo_" + UUID.randomUUID().toString().substring(0, 10);
        String type = cmd.orderType().trim().toUpperCase();
        if (!"CORRECTIVE".equals(type) && !"PREVENTIVE".equals(type)) {
            throw new IllegalArgumentException("orderType must be CORRECTIVE or PREVENTIVE.");
        }
        String initialStatus = (cmd.assignedTechnician() != null && !cmd.assignedTechnician().isBlank()) ? "ASSIGNED" : "OPEN";
        Date sched = (cmd.scheduledDate() != null && !cmd.scheduledDate().isBlank()) ? Date.valueOf(cmd.scheduledDate()) : null;

        jdbcTemplate.update(
            """
            INSERT INTO cmms_work_orders (
                id, tenant_id, station_id, asset_id, asset_name, order_type, priority,
                title, description, status, assigned_technician, scheduled_date, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id, principal.tenantId(), cmd.stationId(), cmd.assetId(), cmd.assetName().trim(),
            type, cmd.priority() != null ? cmd.priority().trim().toUpperCase() : "MEDIUM",
            cmd.title().trim(), cmd.description(), initialStatus, cmd.assignedTechnician(),
            sched, principal.subject(), Timestamp.from(Instant.now())
        );
        auditRecorder.record(principal.tenantId(), cmd.stationId(), principal.subject(), "MANAGER",
            "CMMS_WO_CREATED", "WORK_ORDER", id, type + " WO: " + cmd.title() + " (" + cmd.assetName() + ")");
        return jdbcTemplate.queryForMap("SELECT * FROM cmms_work_orders WHERE id = ?", id);
    }

    @PatchMapping("/work-orders/{id}/transition")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> transitionWorkOrder(
        @PathVariable String id,
        @Valid @RequestBody TransitionWorkOrderCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        Map<String, Object> wo = jdbcTemplate.queryForMap("SELECT * FROM cmms_work_orders WHERE id = ?", id);
        accessGuard.assertTenantMatch(String.valueOf(wo.get("tenant_id")));

        String current = String.valueOf(wo.get("status"));
        String next = cmd.nextStatus().trim().toUpperCase();
        Set<String> allowed = ALLOWED_TRANSITIONS.getOrDefault(current, Set.of());
        if (!allowed.contains(next)) {
            throw new IllegalStateException("Invalid CMMS work order transition: " + current + " -> " + next);
        }

        Timestamp now = Timestamp.from(Instant.now());
        String tech = cmd.assignedTechnician() != null ? cmd.assignedTechnician() : (String) wo.get("assigned_technician");
        long laborCost = cmd.laborCostFcfa() != null ? cmd.laborCostFcfa() : ((Number) wo.get("labor_cost_fcfa")).longValue();

        jdbcTemplate.update(
            """
            UPDATE cmms_work_orders
            SET status = ?, assigned_technician = ?, labor_cost_fcfa = ?,
                started_at = CASE WHEN ? = 'IN_PROGRESS' AND started_at IS NULL THEN ? ELSE started_at END,
                completed_at = CASE WHEN ? = 'DONE' THEN ? ELSE completed_at END,
                verified_by = CASE WHEN ? = 'VERIFIED' THEN ? ELSE verified_by END,
                verified_at = CASE WHEN ? = 'VERIFIED' THEN ? ELSE verified_at END
            WHERE id = ?
            """,
            next, tech, laborCost, next, now, next, now, next, principal.subject(), next, now, id
        );
        return jdbcTemplate.queryForMap("SELECT * FROM cmms_work_orders WHERE id = ?", id);
    }

    // --- PREVENTIVE MAINTENANCE SCHEDULES ---

    @GetMapping("/pm-schedules")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listPmSchedules() {
        return jdbcTemplate.queryForList(
            "SELECT * FROM cmms_pm_schedules WHERE tenant_id = ? ORDER BY next_due_date ASC",
            accessGuard.currentTenantId()
        );
    }

    @PostMapping("/pm-schedules")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> createPmSchedule(@Valid @RequestBody CreatePmScheduleCommand cmd) {
        String id = "pm_" + UUID.randomUUID().toString().substring(0, 10);
        LocalDate nextDue = (cmd.nextDueDate() != null && !cmd.nextDueDate().isBlank())
            ? LocalDate.parse(cmd.nextDueDate())
            : LocalDate.now(ZoneOffset.UTC).plusDays(cmd.intervalDays() != null ? cmd.intervalDays() : 30);
        jdbcTemplate.update(
            """
            INSERT INTO cmms_pm_schedules (
                id, tenant_id, station_id, asset_id, asset_name, title,
                interval_days, interval_hours, next_due_date, active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
            """,
            id, accessGuard.currentTenantId(), cmd.stationId(), cmd.assetId(), cmd.assetName().trim(),
            cmd.title().trim(), cmd.intervalDays(), cmd.intervalHours(), Date.valueOf(nextDue), Timestamp.from(Instant.now())
        );
        return jdbcTemplate.queryForMap("SELECT * FROM cmms_pm_schedules WHERE id = ?", id);
    }

    @PostMapping("/pm-schedules/generate-due")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> triggerDuePmGeneration() {
        int count = generateDuePreventiveWorkOrders();
        return Map.of("generatedWorkOrders", count, "runAt", Instant.now().toString());
    }

    @Scheduled(cron = "0 15 2 * * *")
    public void scheduledPmWorkOrderSweep() {
        try {
            generateDuePreventiveWorkOrders();
        } catch (Exception ex) {
            log.debug("CMMS scheduled PM sweep skipped: {}", ex.getMessage());
        }
    }

    public int generateDuePreventiveWorkOrders() {
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<Map<String, Object>> due = jdbcTemplate.queryForList(
            "SELECT * FROM cmms_pm_schedules WHERE active = TRUE AND next_due_date <= ?",
            Date.valueOf(today)
        );
        int generated = 0;
        for (Map<String, Object> s : due) {
            String woId = "wo_pm_" + UUID.randomUUID().toString().substring(0, 8);
            jdbcTemplate.update(
                """
                INSERT INTO cmms_work_orders (
                    id, tenant_id, station_id, asset_id, asset_name, order_type, priority,
                    title, description, status, scheduled_date, created_by, created_at
                ) VALUES (?, ?, ?, ?, ?, 'PREVENTIVE', 'MEDIUM', ?, 'Auto-generated from PM schedule', 'OPEN', ?, 'cmms-scheduler', ?)
                """,
                woId, s.get("tenant_id"), s.get("station_id"), s.get("asset_id"), s.get("asset_name"),
                "[PM] " + s.get("title"), Date.valueOf(today), Timestamp.from(Instant.now())
            );
            int intervalDays = s.get("interval_days") instanceof Number n && n.intValue() > 0 ? n.intValue() : 30;
            jdbcTemplate.update(
                "UPDATE cmms_pm_schedules SET last_run_at = ?, next_due_date = ? WHERE id = ?",
                Timestamp.from(Instant.now()), Date.valueOf(today.plusDays(intervalDays)), s.get("id")
            );
            generated++;
        }
        return generated;
    }

    // --- STANDBY GENERATOR RUNTIME & FUEL LOG ---

    @GetMapping("/generator-logs")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listGeneratorLogs(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        if (stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId)) {
            return jdbcTemplate.queryForList(
                "SELECT * FROM cmms_generator_logs WHERE tenant_id = ? AND station_id = ? ORDER BY logged_at DESC LIMIT 150",
                tenantId, stationId
            );
        }
        return jdbcTemplate.queryForList(
            "SELECT * FROM cmms_generator_logs WHERE tenant_id = ? ORDER BY logged_at DESC LIMIT 150",
            tenantId
        );
    }

    @PostMapping("/generator-logs")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> logGeneratorRun(@Valid @RequestBody LogGeneratorRuntimeCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        if (cmd.hoursEnd() <= cmd.hoursStart()) {
            throw new IllegalArgumentException("Generator closing meter hours must exceed opening meter hours.");
        }
        double runtime = Math.round((cmd.hoursEnd() - cmd.hoursStart()) * 100.0) / 100.0;
        String source = cmd.fuelSource() != null ? cmd.fuelSource().trim().toUpperCase() : "INTERNAL_DIESEL_TANK";

        boolean tankDeducted = false;
        if (Boolean.TRUE.equals(cmd.deductInternalDieselTank()) && "INTERNAL_DIESEL_TANK".equals(source)) {
            Optional<InventoryQueryApi.TankSnapshot> gasoilTank =
                inventoryQueryApi.findPrimaryTankByStationAndGrade(cmd.stationId(), "GASOIL");
            if (gasoilTank.isPresent()) {
                inventoryQueryApi.deductStandaloneFuelSale(gasoilTank.get().id(), BigDecimal.valueOf(cmd.fuelLitres()));
                tankDeducted = true;
            }
        }

        String id = "gen_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO cmms_generator_logs (
                id, tenant_id, station_id, asset_id, generator_name, hours_start, hours_end,
                runtime_hours, fuel_litres, fuel_source, fuel_cost_fcfa, power_outage_reason, logged_by, logged_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id, principal.tenantId(), cmd.stationId(), cmd.assetId(), cmd.generatorName().trim(),
            cmd.hoursStart(), cmd.hoursEnd(), runtime, cmd.fuelLitres(), source,
            cmd.fuelCostFcfa(), cmd.powerOutageReason(), principal.subject(), Timestamp.from(Instant.now())
        );

        Map<String, Object> row = new LinkedHashMap<>(jdbcTemplate.queryForMap("SELECT * FROM cmms_generator_logs WHERE id = ?", id));
        row.put("internalDieselTankDeducted", tankDeducted);
        row.put("litresPerHour", Math.round((cmd.fuelLitres() / runtime) * 100.0) / 100.0);
        return row;
    }

    // --- SPARE PARTS INVENTORY & ISSUE TO WORK ORDER ---

    @GetMapping("/spare-parts")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listSpareParts(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        if (stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId)) {
            return jdbcTemplate.queryForList(
                "SELECT * FROM cmms_spare_parts WHERE tenant_id = ? AND station_id = ? ORDER BY part_name ASC",
                tenantId, stationId
            );
        }
        return jdbcTemplate.queryForList(
            "SELECT * FROM cmms_spare_parts WHERE tenant_id = ? ORDER BY part_name ASC",
            tenantId
        );
    }

    @PostMapping("/spare-parts")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> createSparePart(@Valid @RequestBody CreateSparePartCommand cmd) {
        String id = "prt_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO cmms_spare_parts (
                id, tenant_id, station_id, part_code, part_name, category, stock_qty, reorder_level, unit_cost_fcfa, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id, accessGuard.currentTenantId(), cmd.stationId(), cmd.partCode().trim().toUpperCase(),
            cmd.partName().trim(), cmd.category() != null ? cmd.category().trim().toUpperCase() : "DISPENSER",
            cmd.stockQty(), cmd.reorderLevel(), cmd.unitCostFcfa(), Timestamp.from(Instant.now())
        );
        return jdbcTemplate.queryForMap("SELECT * FROM cmms_spare_parts WHERE id = ?", id);
    }

    @PostMapping("/spare-parts/{partId}/issue")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> issuePartToWorkOrder(
        @PathVariable String partId,
        @Valid @RequestBody IssueSparePartCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        Map<String, Object> part = jdbcTemplate.queryForMap("SELECT * FROM cmms_spare_parts WHERE id = ?", partId);
        accessGuard.assertTenantMatch(String.valueOf(part.get("tenant_id")));
        int stock = ((Number) part.get("stock_qty")).intValue();
        if (stock < cmd.quantity()) {
            throw new IllegalStateException("Insufficient spare part stock (" + stock + " available).");
        }
        Map<String, Object> wo = jdbcTemplate.queryForMap("SELECT id, tenant_id, station_id FROM cmms_work_orders WHERE id = ?", cmd.workOrderId());
        accessGuard.assertTenantMatch(String.valueOf(wo.get("tenant_id")));

        long totalCost = ((Number) part.get("unit_cost_fcfa")).longValue() * cmd.quantity();
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update("UPDATE cmms_spare_parts SET stock_qty = stock_qty - ?, updated_at = ? WHERE id = ?", cmd.quantity(), now, partId);
        jdbcTemplate.update("UPDATE cmms_work_orders SET parts_cost_fcfa = parts_cost_fcfa + ? WHERE id = ?", totalCost, cmd.workOrderId());

        String issueId = "iss_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            "INSERT INTO cmms_part_issues (id, tenant_id, station_id, work_order_id, part_id, quantity, total_cost_fcfa, issued_by, issued_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            issueId, principal.tenantId(), wo.get("station_id"), cmd.workOrderId(), partId, cmd.quantity(), totalCost, principal.subject(), now
        );

        int remaining = stock - cmd.quantity();
        boolean lowStock = remaining <= ((Number) part.get("reorder_level")).intValue();
        return Map.of(
            "issueId", issueId,
            "partId", partId,
            "workOrderId", cmd.workOrderId(),
            "quantityIssued", cmd.quantity(),
            "totalCostFcfa", totalCost,
            "remainingStockQty", remaining,
            "reorderAlert", lowStock
        );
    }

    @GetMapping("/cost-rollup")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> assetCostRollup() {
        return jdbcTemplate.queryForList(
            """
            SELECT asset_name,
                   COUNT(*) AS work_order_count,
                   COALESCE(SUM(labor_cost_fcfa), 0) AS total_labor_fcfa,
                   COALESCE(SUM(parts_cost_fcfa), 0) AS total_parts_fcfa,
                   COALESCE(SUM(labor_cost_fcfa + parts_cost_fcfa), 0) AS total_maintenance_fcfa
            FROM cmms_work_orders
            WHERE tenant_id = ?
            GROUP BY asset_name
            ORDER BY total_maintenance_fcfa DESC
            """,
            accessGuard.currentTenantId()
        );
    }
}
