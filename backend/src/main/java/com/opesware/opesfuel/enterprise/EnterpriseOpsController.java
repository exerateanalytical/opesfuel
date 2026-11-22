package com.opesware.opesfuel.enterprise;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

record CreateHseRecordCmd(
    @NotBlank String stationId,
    @NotBlank String recordType,
    @NotBlank String severity,
    @NotBlank String title,
    @NotBlank String details,
    @NotBlank String inspectorOrReporter,
    String nextDueDate,
    String capaAction
) {}

record CreateFraudCaseCmd(
    @NotBlank String stationId,
    @NotBlank String anomalyType,
    @NotBlank String severity,
    @NotBlank String subjectRef,
    @Min(0) long suspectedLossFcfa,
    @NotBlank String investigator,
    @NotBlank String findings
) {}

record UpdateFraudCaseCmd(
    @NotBlank String disposition,
    @Min(0) long recoveredFcfa,
    String findings
) {}

record CreateQualitySampleCmd(
    @NotBlank String stationId,
    @NotBlank String tankId,
    @NotBlank String tankName,
    @NotBlank String fuelGrade,
    @NotBlank String batchCoaRef,
    double densityKgM3,
    double temperatureC,
    boolean waterPasteDetected,
    @NotBlank String testedBy,
    String notes
) {}

record QuarantineToggleCmd(boolean quarantined) {}

record CreateTransferCmd(
    @NotBlank String fromStationId,
    @NotBlank String fromStationName,
    @NotBlank String toStationId,
    @NotBlank String toStationName,
    @NotBlank String fuelGrade,
    double dispatchedLitres,
    @NotBlank String sealNumber,
    @NotBlank String tankerPlate,
    @NotBlank String driverName
) {}

record ReceiveTransferCmd(double receivedLitres) {}

record CreateServiceBayTicketCmd(
    @NotBlank String stationId,
    @NotBlank String serviceCategory,
    @NotBlank String vehiclePlate,
    @NotBlank String customerName,
    @NotBlank String technicianName,
    @Min(1) long amountFcfa,
    @NotBlank String paymentMethod
) {}

record CreateVoucherCmd(
    @NotBlank String stationId,
    @NotBlank String customerName,
    String customerPhone,
    @Min(500) long issuedFcfa
) {}

record RedeemVoucherCmd(@Min(1) long amountFcfa) {}

record CreateBulkOrderCmd(
    @NotBlank String stationId,
    @NotBlank String customerCompany,
    @NotBlank String fuelGrade,
    double volumeLitres,
    @Min(1) long unitPriceFcfa,
    @NotBlank String tankerTruckCode,
    @NotBlank String driverName,
    @NotBlank String deliveryDestination
) {}

record CreateFixedAssetCmd(
    @NotBlank String stationId,
    @NotBlank String assetTag,
    @NotBlank String assetName,
    @NotBlank String category,
    @NotBlank String acquisitionDate,
    @Min(1) long acquisitionCostFcfa,
    @Min(1) int usefulLifeYears,
    @NotBlank String custodian,
    String insurancePolicy
) {}

record CreateBudgetCmd(
    @NotBlank String stationId,
    @NotBlank String periodLabel,
    @NotBlank String category,
    @Min(0) long budgetFcfa,
    @Min(0) long actualFcfa
) {}

record CreateApprovalCmd(
    @NotBlank String stationId,
    @NotBlank String requestType,
    @NotBlank String title,
    @Min(0) long amountFcfa
) {}

record ApprovalDecisionCmd(@NotBlank String status) {}

record CreateEvUtilityCmd(
    @NotBlank String stationId,
    @NotBlank String meterType,
    @NotBlank String connectorOrMeter,
    double quantityUnit,
    @NotBlank String unitLabel,
    @Min(0) long revenueOrCostFcfa
) {}

record CreateFranchiseCmd(
    @NotBlank String stationId,
    @NotBlank String dealerName,
    @NotBlank String operatingModel,
    double royaltyFcfaPerLitre,
    double monthlyTargetLitres,
    int complianceScorePct,
    @NotBlank String renewalDate
) {}

@RestController
@RequestMapping("/api/v1/enterprise")
public class EnterpriseOpsController {
    private final JdbcTemplate jdbc;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder audit;

    public EnterpriseOpsController(
        JdbcTemplate jdbc,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder audit
    ) {
        this.jdbc = jdbc;
        this.accessGuard = accessGuard;
        this.audit = audit;
    }

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT')")
    public Map<String, Object> overview() {
        String tenantId = accessGuard.currentTenantId();
        return Map.ofEntries(
            Map.entry("hseRecords", count("SELECT COUNT(*) FROM hse_records WHERE tenant_id = ?", tenantId)),
            Map.entry("openFraudCases", count("SELECT COUNT(*) FROM fraud_cases WHERE tenant_id = ? AND disposition = 'UNDER_INVESTIGATION'", tenantId)),
            Map.entry("quarantinedTanks", count("SELECT COUNT(*) FROM fuel_quality_samples WHERE tenant_id = ? AND quarantined = TRUE", tenantId)),
            Map.entry("activeTransfers", count("SELECT COUNT(*) FROM interstation_transfers WHERE tenant_id = ? AND status = 'IN_TRANSIT'", tenantId)),
            Map.entry("serviceBayTickets", count("SELECT COUNT(*) FROM service_bay_tickets WHERE tenant_id = ?", tenantId)),
            Map.entry("activeVouchers", count("SELECT COUNT(*) FROM loyalty_vouchers WHERE tenant_id = ? AND status = 'ACTIVE'", tenantId)),
            Map.entry("bulkOrders", count("SELECT COUNT(*) FROM bulk_wholesale_orders WHERE tenant_id = ?", tenantId)),
            Map.entry("fixedAssetsCount", count("SELECT COUNT(*) FROM fixed_assets WHERE tenant_id = ?", tenantId)),
            Map.entry("pendingApprovals", count("SELECT COUNT(*) FROM maker_checker_approvals WHERE tenant_id = ? AND status = 'PENDING'", tenantId)),
            Map.entry("evUtilityReadings", count("SELECT COUNT(*) FROM ev_utility_readings WHERE tenant_id = ?", tenantId)),
            Map.entry("franchiseAgreements", count("SELECT COUNT(*) FROM franchise_agreements WHERE tenant_id = ?", tenantId))
        );
    }

    // --- M38: HSE Safety & Environmental ---
    @GetMapping("/hse-records")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT')")
    public List<Map<String, Object>> listHseRecords() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM hse_records WHERE tenant_id = ? ORDER BY recorded_at DESC", tenantId);
    }

    @PostMapping("/hse-records")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    public Map<String, Object> createHseRecord(@Valid @RequestBody CreateHseRecordCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String id = "hse_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO hse_records (id, tenant_id, station_id, record_type, severity, title, details, inspector_or_reporter, next_due_date, capa_action, status, recorded_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.recordType().toUpperCase(), cmd.severity().toUpperCase(),
            cmd.title(), cmd.details(), cmd.inspectorOrReporter(), cmd.nextDueDate(), cmd.capaAction(),
            "OPEN", Timestamp.from(Instant.now())
        );
        audit.record(tenantId, cmd.stationId(), actor.subject(), actor.roles().toString(), "HSE_RECORD_LOGGED", "HSE", id, cmd.title());
        return Map.of("id", id, "status", "OPEN", "title", cmd.title());
    }

    // --- M39: Fraud & Loss Prevention ---
    @GetMapping("/fraud-cases")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listFraudCases() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM fraud_cases WHERE tenant_id = ? ORDER BY opened_at DESC", tenantId);
    }

    @PostMapping("/fraud-cases")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> createFraudCase(@Valid @RequestBody CreateFraudCaseCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String id = "frd_" + UUID.randomUUID().toString().substring(0, 8);
        Timestamp now = Timestamp.from(Instant.now());
        jdbc.update(
            "INSERT INTO fraud_cases (id, tenant_id, station_id, anomaly_type, severity, subject_ref, suspected_loss_fcfa, recovered_fcfa, investigator, findings, disposition, opened_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.anomalyType().toUpperCase(), cmd.severity().toUpperCase(),
            cmd.subjectRef(), cmd.suspectedLossFcfa(), 0L, cmd.investigator(), cmd.findings(),
            "UNDER_INVESTIGATION", now, now
        );
        audit.record(tenantId, cmd.stationId(), actor.subject(), actor.roles().toString(), "FRAUD_CASE_OPENED", "FRAUD_CASE", id, cmd.subjectRef());
        return Map.of("id", id, "disposition", "UNDER_INVESTIGATION");
    }

    @PatchMapping("/fraud-cases/{caseId}")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public Map<String, Object> updateFraudCase(@PathVariable String caseId, @Valid @RequestBody UpdateFraudCaseCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        jdbc.update(
            "UPDATE fraud_cases SET disposition = ?, recovered_fcfa = ?, findings = COALESCE(?, findings), updated_at = ? WHERE id = ? AND tenant_id = ?",
            cmd.disposition().toUpperCase(), cmd.recoveredFcfa(), cmd.findings(), Timestamp.from(Instant.now()), caseId, tenantId
        );
        return Map.of("id", caseId, "disposition", cmd.disposition().toUpperCase(), "recoveredFcfa", cmd.recoveredFcfa());
    }

    // --- M55: Fuel Quality Control & Quarantine ---
    @GetMapping("/quality-samples")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listQualitySamples() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM fuel_quality_samples WHERE tenant_id = ? ORDER BY tested_at DESC", tenantId);
    }

    @PostMapping("/quality-samples")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> createQualitySample(@Valid @RequestBody CreateQualitySampleCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "qc_" + UUID.randomUUID().toString().substring(0, 8);
        boolean autoQuarantine = cmd.waterPasteDetected();
        jdbc.update(
            "INSERT INTO fuel_quality_samples (id, tenant_id, station_id, tank_id, tank_name, fuel_grade, batch_coa_ref, density_kg_m3, temperature_c, water_paste_detected, quarantined, tested_by, notes, tested_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.tankId(), cmd.tankName(), cmd.fuelGrade().toUpperCase(),
            cmd.batchCoaRef(), cmd.densityKgM3(), cmd.temperatureC(), cmd.waterPasteDetected(),
            autoQuarantine, cmd.testedBy(), cmd.notes(), Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "quarantined", autoQuarantine);
    }

    @PatchMapping("/quality-samples/{sampleId}/quarantine")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> toggleQuarantine(@PathVariable String sampleId, @RequestBody QuarantineToggleCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        jdbc.update(
            "UPDATE fuel_quality_samples SET quarantined = ? WHERE id = ? AND tenant_id = ?",
            cmd.quarantined(), sampleId, tenantId
        );
        return Map.of("id", sampleId, "quarantined", cmd.quarantined());
    }

    // --- M25: Inter-Station Transfers ---
    @GetMapping("/transfers")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listTransfers() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM interstation_transfers WHERE tenant_id = ? ORDER BY dispatched_at DESC", tenantId);
    }

    @PostMapping("/transfers")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> createTransfer(@Valid @RequestBody CreateTransferCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "trf_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO interstation_transfers (id, tenant_id, from_station_id, from_station_name, to_station_id, to_station_name, fuel_grade, dispatched_litres, seal_number, tanker_plate, driver_name, status, dispatched_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.fromStationId(), cmd.fromStationName(), cmd.toStationId(), cmd.toStationName(),
            cmd.fuelGrade().toUpperCase(), cmd.dispatchedLitres(), cmd.sealNumber(), cmd.tankerPlate(),
            cmd.driverName(), "IN_TRANSIT", Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "status", "IN_TRANSIT");
    }

    @PatchMapping("/transfers/{transferId}/receive")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> receiveTransfer(@PathVariable String transferId, @RequestBody ReceiveTransferCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        jdbc.update(
            "UPDATE interstation_transfers SET received_litres = ?, status = 'RECEIVED', received_at = ? WHERE id = ? AND tenant_id = ?",
            cmd.receivedLitres(), Timestamp.from(Instant.now()), transferId, tenantId
        );
        return Map.of("id", transferId, "status", "RECEIVED", "receivedLitres", cmd.receivedLitres());
    }

    // --- M18: Car Wash & Service Bay POS ---
    @GetMapping("/service-bay")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT')")
    public List<Map<String, Object>> listServiceBay() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM service_bay_tickets WHERE tenant_id = ? ORDER BY created_at DESC", tenantId);
    }

    @PostMapping("/service-bay")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    public Map<String, Object> createServiceBayTicket(@Valid @RequestBody CreateServiceBayTicketCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "bay_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO service_bay_tickets (id, tenant_id, station_id, service_category, vehicle_plate, customer_name, technician_name, amount_fcfa, payment_method, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.serviceCategory().toUpperCase(), cmd.vehiclePlate().toUpperCase(),
            cmd.customerName(), cmd.technicianName(), cmd.amountFcfa(), cmd.paymentMethod().toUpperCase(),
            "COMPLETED", Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "amountFcfa", cmd.amountFcfa(), "status", "COMPLETED");
    }

    // --- M23: Loyalty & Prepaid Fuel Vouchers ---
    @GetMapping("/loyalty-vouchers")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT')")
    public List<Map<String, Object>> listVouchers() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM loyalty_vouchers WHERE tenant_id = ? ORDER BY issued_at DESC", tenantId);
    }

    @PostMapping("/loyalty-vouchers")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    public Map<String, Object> issueVoucher(@Valid @RequestBody CreateVoucherCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "vch_" + UUID.randomUUID().toString().substring(0, 8);
        String code = "OPF-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        int points = (int) (cmd.issuedFcfa() / 1000L);
        jdbc.update(
            "INSERT INTO loyalty_vouchers (id, tenant_id, station_id, voucher_code, customer_name, customer_phone, issued_fcfa, balance_fcfa, loyalty_points, status, issued_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), code, cmd.customerName(), cmd.customerPhone(),
            cmd.issuedFcfa(), cmd.issuedFcfa(), points, "ACTIVE", Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "voucherCode", code, "balanceFcfa", cmd.issuedFcfa(), "loyaltyPoints", points);
    }

    @PatchMapping("/loyalty-vouchers/{voucherId}/redeem")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    public Map<String, Object> redeemVoucher(@PathVariable String voucherId, @Valid @RequestBody RedeemVoucherCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        Long bal = jdbc.queryForObject(
            "SELECT balance_fcfa FROM loyalty_vouchers WHERE id = ? AND tenant_id = ?",
            Long.class, voucherId, tenantId
        );
        long current = bal != null ? bal : 0L;
        long nextBal = Math.max(0L, current - cmd.amountFcfa());
        String nextStatus = nextBal == 0L ? "REDEEMED" : "ACTIVE";
        jdbc.update(
            "UPDATE loyalty_vouchers SET balance_fcfa = ?, status = ? WHERE id = ? AND tenant_id = ?",
            nextBal, nextStatus, voucherId, tenantId
        );
        return Map.of("id", voucherId, "balanceFcfa", nextBal, "status", nextStatus);
    }

    // --- M24 & M52: Bulk Wholesale & Tanker Fleet Dispatch ---
    @GetMapping("/bulk-orders")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listBulkOrders() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM bulk_wholesale_orders WHERE tenant_id = ? ORDER BY created_at DESC", tenantId);
    }

    @PostMapping("/bulk-orders")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> createBulkOrder(@Valid @RequestBody CreateBulkOrderCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "blk_" + UUID.randomUUID().toString().substring(0, 8);
        long total = Math.round(cmd.volumeLitres() * cmd.unitPriceFcfa());
        jdbc.update(
            "INSERT INTO bulk_wholesale_orders (id, tenant_id, station_id, customer_company, fuel_grade, volume_litres, unit_price_fcfa, total_fcfa, tanker_truck_code, driver_name, delivery_destination, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.customerCompany(), cmd.fuelGrade().toUpperCase(),
            cmd.volumeLitres(), cmd.unitPriceFcfa(), total, cmd.tankerTruckCode(), cmd.driverName(),
            cmd.deliveryDestination(), "SCHEDULED", Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "totalFcfa", total, "status", "SCHEDULED");
    }

    // --- M36: Fixed Assets Register ---
    @GetMapping("/fixed-assets")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listFixedAssets() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM fixed_assets WHERE tenant_id = ? ORDER BY created_at DESC", tenantId);
    }

    @PostMapping("/fixed-assets")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public Map<String, Object> createFixedAsset(@Valid @RequestBody CreateFixedAssetCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "ast_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO fixed_assets (id, tenant_id, station_id, asset_tag, asset_name, category, acquisition_date, acquisition_cost_fcfa, useful_life_years, custodian, insurance_policy, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.assetTag(), cmd.assetName(), cmd.category().toUpperCase(),
            cmd.acquisitionDate(), cmd.acquisitionCostFcfa(), cmd.usefulLifeYears(), cmd.custodian(),
            cmd.insurancePolicy(), "ACTIVE", Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "assetTag", cmd.assetTag(), "status", "ACTIVE");
    }

    // --- M54 & M05: Budgets & Maker-Checker Approvals ---
    @GetMapping("/budgets")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listBudgets() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM station_budgets WHERE tenant_id = ? ORDER BY period_label DESC", tenantId);
    }

    @PostMapping("/budgets")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public Map<String, Object> createBudget(@Valid @RequestBody CreateBudgetCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "bdg_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO station_budgets (id, tenant_id, station_id, period_label, category, budget_fcfa, actual_fcfa, updated_at) VALUES (?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.periodLabel(), cmd.category().toUpperCase(),
            cmd.budgetFcfa(), cmd.actualFcfa(), Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "budgetFcfa", cmd.budgetFcfa());
    }

    @GetMapping("/approvals")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listApprovals() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM maker_checker_approvals WHERE tenant_id = ? ORDER BY created_at DESC", tenantId);
    }

    @PostMapping("/approvals")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> createApproval(@Valid @RequestBody CreateApprovalCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String id = "apr_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO maker_checker_approvals (id, tenant_id, station_id, request_type, title, amount_fcfa, requested_by, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.requestType().toUpperCase(), cmd.title(),
            cmd.amountFcfa(), actor.subject(), "PENDING", Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "status", "PENDING");
    }

    @PatchMapping("/approvals/{approvalId}")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public Map<String, Object> decideApproval(@PathVariable String approvalId, @Valid @RequestBody ApprovalDecisionCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String requestedBy = jdbc.queryForObject(
            "SELECT requested_by FROM maker_checker_approvals WHERE id = ? AND tenant_id = ?",
            String.class, approvalId, tenantId
        );
        if (requestedBy != null && requestedBy.equalsIgnoreCase(actor.subject())) {
            throw new org.springframework.web.server.ResponseStatusException(
                org.springframework.http.HttpStatus.CONFLICT,
                "Maker-checker violation (T005): requester cannot approve their own submission."
            );
        }
        jdbc.update(
            "UPDATE maker_checker_approvals SET status = ?, decided_by = ?, decided_at = ? WHERE id = ? AND tenant_id = ?",
            cmd.status().toUpperCase(), actor.subject(), Timestamp.from(Instant.now()), approvalId, tenantId
        );
        return Map.of("id", approvalId, "status", cmd.status().toUpperCase(), "decidedBy", actor.subject());
    }

    // --- M53: EV Charging & Utility Metering ---
    @GetMapping("/ev-utility")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listEvUtility() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM ev_utility_readings WHERE tenant_id = ? ORDER BY recorded_at DESC", tenantId);
    }

    @PostMapping("/ev-utility")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> createEvUtility(@Valid @RequestBody CreateEvUtilityCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "evu_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO ev_utility_readings (id, tenant_id, station_id, meter_type, connector_or_meter, quantity_unit, unit_label, revenue_or_cost_fcfa, recorded_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.meterType().toUpperCase(), cmd.connectorOrMeter(),
            cmd.quantityUnit(), cmd.unitLabel(), cmd.revenueOrCostFcfa(), Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "meterType", cmd.meterType().toUpperCase());
    }

    // --- M51: Franchise & Dealer Agreements ---
    @GetMapping("/franchises")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listFranchises() {
        String tenantId = accessGuard.currentTenantId();
        return jdbc.queryForList("SELECT * FROM franchise_agreements WHERE tenant_id = ? ORDER BY created_at DESC", tenantId);
    }

    @PostMapping("/franchises")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> createFranchise(@Valid @RequestBody CreateFranchiseCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "frn_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO franchise_agreements (id, tenant_id, station_id, dealer_name, operating_model, royalty_fcfa_per_litre, monthly_target_litres, compliance_score_pct, renewal_date, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.dealerName(), cmd.operatingModel().toUpperCase(),
            cmd.royaltyFcfaPerLitre(), cmd.monthlyTargetLitres(), cmd.complianceScorePct(),
            cmd.renewalDate(), "ACTIVE", Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "dealerName", cmd.dealerName(), "status", "ACTIVE");
    }

    private long count(String sql, String tenantId) {
        Long v = jdbc.queryForObject(sql, Long.class, tenantId);
        return v != null ? v : 0L;
    }
}
