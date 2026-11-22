package com.opesware.opesfuel.enterprise;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

record ProposeCatalogPriceCmd(
    @NotBlank String gradeCode,
    @Positive long sellingPrice,
    String currencyCode
) {}

record CreateTankCalibrationCmd(
    @Positive double slopeLitresPerMm,
    double offsetLitres
) {}

record RecordVersionedDipCmd(
    @Positive double dipMm
) {}

record CreateShopReturnCmd(
    @NotBlank String stationId,
    @NotBlank String originalSaleId,
    @NotBlank String sku,
    @Min(1) int originalQty,
    @Min(1) int returnQty,
    @Min(1) long unitPriceFcfa,
    @NotBlank String reason
) {}

record ReconcileTransitCmd(
    @Positive double receivedLitres
) {}

record PreDispenseCheckCmd(
    @NotBlank String stationId,
    @NotBlank String tankId,
    @NotBlank String pumpCode
) {}

@RestController
@RequestMapping("/api/v1/enterprise")
public class Sprint4ComplianceAndControlsController {

    private static final List<Map<String, String>> GLOBAL_FUEL_GRADES = List.of(
        Map.of("gradeCode", "SUPER", "label", "Super Unleaded (RON 95)", "category", "LIQUID_FUEL", "unit", "LITRE"),
        Map.of("gradeCode", "GASOIL", "label", "Gasoil / Automotive Diesel", "category", "LIQUID_FUEL", "unit", "LITRE"),
        Map.of("gradeCode", "KEROSENE", "label", "Domestic Kerosene (DPK)", "category", "LIQUID_FUEL", "unit", "LITRE"),
        Map.of("gradeCode", "JET_A1", "label", "Aviation Jet A-1", "category", "AVIATION", "unit", "LITRE"),
        Map.of("gradeCode", "LPG", "label", "Liquefied Petroleum Gas (LPG)", "category", "GAS", "unit", "KG"),
        Map.of("gradeCode", "CNG", "label", "Compressed Natural Gas (CNG)", "category", "GAS", "unit", "KG"),
        Map.of("gradeCode", "LNG", "label", "Liquefied Natural Gas (LNG)", "category", "GAS", "unit", "KG"),
        Map.of("gradeCode", "EV_KWH", "label", "EV Fast Charging Energy", "category", "ELECTRIC", "unit", "KWH"),
        Map.of("gradeCode", "ADBLUE", "label", "AdBlue / DEF Exhaust Fluid", "category", "ADDITIVE", "unit", "LITRE")
    );

    private final JdbcTemplate jdbc;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder audit;

    public Sprint4ComplianceAndControlsController(
        JdbcTemplate jdbc,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder audit
    ) {
        this.jdbc = jdbc;
        this.accessGuard = accessGuard;
        this.audit = audit;
    }

    // =========================================================================
    // T007: Global Fuel Catalog With Empty Initial Selling Prices + Maker-Checker
    // =========================================================================
    @GetMapping("/global-fuel-catalog")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT')")
    public List<Map<String, Object>> listGlobalFuelCatalog() {
        String tenantId = accessGuard.currentTenantId();
        List<Map<String, Object>> tenantPrices = jdbc.queryForList(
            "SELECT * FROM tenant_fuel_catalog_prices WHERE tenant_id = ?",
            tenantId
        );
        Map<String, Map<String, Object>> byGrade = new LinkedHashMap<>();
        for (Map<String, Object> row : tenantPrices) {
            byGrade.put(String.valueOf(row.get("grade_code")).toUpperCase(), row);
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, String> g : GLOBAL_FUEL_GRADES) {
            String code = g.get("gradeCode");
            Map<String, Object> tp = byGrade.get(code);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("gradeCode", code);
            item.put("label", g.get("label"));
            item.put("category", g.get("category"));
            item.put("unit", g.get("unit"));
            if (tp == null) {
                item.put("sellingPrice", null);
                item.put("proposedSellingPrice", null);
                item.put("currencyCode", null);
                item.put("pricingStatus", "UNSET_PENDING_TENANT_APPROVAL");
                item.put("proposedBy", null);
                item.put("approvedBy", null);
            } else {
                item.put("sellingPrice", tp.get("approved_selling_price"));
                item.put("proposedSellingPrice", tp.get("proposed_selling_price"));
                item.put("currencyCode", tp.get("currency_code"));
                item.put("pricingStatus", tp.get("status"));
                item.put("proposedBy", tp.get("proposed_by"));
                item.put("approvedBy", tp.get("approved_by"));
            }
            out.add(item);
        }
        return out;
    }

    @PostMapping("/global-fuel-catalog/propose-price")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    @Transactional
    public Map<String, Object> proposeCatalogPrice(@Valid @RequestBody ProposeCatalogPriceCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String code = cmd.gradeCode().trim().toUpperCase();
        boolean validGrade = GLOBAL_FUEL_GRADES.stream().anyMatch(g -> g.get("gradeCode").equals(code));
        if (!validGrade) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown global fuel catalog grade: " + code);
        }
        String currency = (cmd.currencyCode() != null && !cmd.currencyCode().isBlank())
            ? cmd.currencyCode().trim().toUpperCase()
            : "FCFA";
        Integer exists = jdbc.queryForObject(
            "SELECT COUNT(*) FROM tenant_fuel_catalog_prices WHERE tenant_id = ? AND grade_code = ?",
            Integer.class, tenantId, code
        );
        Timestamp now = Timestamp.from(Instant.now());
        if (exists != null && exists > 0) {
            jdbc.update(
                "UPDATE tenant_fuel_catalog_prices SET proposed_selling_price = ?, currency_code = ?, status = 'PENDING_APPROVAL', proposed_by = ?, updated_at = ? WHERE tenant_id = ? AND grade_code = ?",
                cmd.sellingPrice(), currency, actor.subject(), now, tenantId, code
            );
        } else {
            jdbc.update(
                "INSERT INTO tenant_fuel_catalog_prices (id, tenant_id, grade_code, proposed_selling_price, approved_selling_price, currency_code, status, proposed_by, approved_by, updated_at) VALUES (?,?,?,?,NULL,?,'PENDING_APPROVAL',?,NULL,?)",
                "tfp_" + UUID.randomUUID().toString().substring(0, 8),
                tenantId, code, cmd.sellingPrice(), currency, actor.subject(), now
            );
        }
        audit.record(tenantId, null, actor.subject(), actor.roles().toString(), "CATALOG_PRICE_PROPOSED", "FUEL_CATALOG", code,
            "Proposed " + cmd.sellingPrice() + " " + currency + " (awaiting maker-checker approval)");
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("gradeCode", code);
        res.put("proposedSellingPrice", cmd.sellingPrice());
        res.put("sellingPrice", null);
        res.put("pricingStatus", "PENDING_APPROVAL");
        return res;
    }

    @PatchMapping("/global-fuel-catalog/{gradeCode}/approve")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    @Transactional
    public Map<String, Object> approveCatalogPrice(@PathVariable String gradeCode) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String code = gradeCode.trim().toUpperCase();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM tenant_fuel_catalog_prices WHERE tenant_id = ? AND grade_code = ?",
            tenantId, code
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No proposed selling price found for grade: " + code);
        }
        Map<String, Object> row = rows.get(0);
        String proposedBy = String.valueOf(row.get("proposed_by"));
        if (proposedBy.equalsIgnoreCase(actor.subject())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Maker-checker violation (T005/T007): price proposer cannot approve their own fuel price.");
        }
        Long proposedPrice = ((Number) row.get("proposed_selling_price")).longValue();
        jdbc.update(
            "UPDATE tenant_fuel_catalog_prices SET approved_selling_price = ?, status = 'ACTIVE', approved_by = ?, updated_at = ? WHERE tenant_id = ? AND grade_code = ?",
            proposedPrice, actor.subject(), Timestamp.from(Instant.now()), tenantId, code
        );
        audit.record(tenantId, null, actor.subject(), actor.roles().toString(), "CATALOG_PRICE_APPROVED", "FUEL_CATALOG", code,
            "Approved selling price " + proposedPrice);
        return Map.of("gradeCode", code, "sellingPrice", proposedPrice, "pricingStatus", "ACTIVE", "approvedBy", actor.subject());
    }

    // =========================================================================
    // T010: Versioned Wet-Stock Tank Calibration Charts (Historical Immutability)
    // =========================================================================
    @GetMapping("/tanks/{tankId}/calibrations")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT')")
    public Map<String, Object> getTankCalibrationHistory(@PathVariable String tankId) {
        String tenantId = accessGuard.currentTenantId();
        List<Map<String, Object>> versions = jdbc.queryForList(
            "SELECT * FROM tank_calibration_versions WHERE tenant_id = ? AND tank_id = ? ORDER BY version_no DESC",
            tenantId, tankId
        );
        List<Map<String, Object>> readings = jdbc.queryForList(
            "SELECT * FROM tank_dip_readings_versioned WHERE tenant_id = ? AND tank_id = ? ORDER BY recorded_at ASC",
            tenantId, tankId
        );
        return Map.of("tankId", tankId, "versions", versions, "readings", readings);
    }

    @PostMapping("/tanks/{tankId}/calibrations")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    @Transactional
    public Map<String, Object> publishTankCalibration(
        @PathVariable String tankId,
        @Valid @RequestBody CreateTankCalibrationCmd cmd
    ) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        Integer maxVer = jdbc.queryForObject(
            "SELECT COALESCE(MAX(version_no), 0) FROM tank_calibration_versions WHERE tenant_id = ? AND tank_id = ?",
            Integer.class, tenantId, tankId
        );
        int nextVer = (maxVer != null ? maxVer : 0) + 1;

        jdbc.update(
            "UPDATE tank_calibration_versions SET status = 'SUPERSEDED' WHERE tenant_id = ? AND tank_id = ? AND status = 'ACTIVE'",
            tenantId, tankId
        );
        String id = "tcv_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO tank_calibration_versions (id, tenant_id, tank_id, version_no, slope_litres_per_mm, offset_litres, status, approved_by, effective_from) VALUES (?,?,?,?,?,?,'ACTIVE',?,?)",
            id, tenantId, tankId, nextVer, cmd.slopeLitresPerMm(), cmd.offsetLitres(), actor.subject(), Timestamp.from(Instant.now())
        );
        audit.record(tenantId, null, actor.subject(), actor.roles().toString(), "TANK_CALIBRATION_ACTIVATED", "TANK", tankId,
            "Activated strapping chart v" + nextVer + " (" + cmd.slopeLitresPerMm() + " L/mm)");
        return Map.of("id", id, "tankId", tankId, "versionNo", nextVer, "status", "ACTIVE", "slopeLitresPerMm", cmd.slopeLitresPerMm());
    }

    @PostMapping("/tanks/{tankId}/versioned-dip")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    @Transactional
    public Map<String, Object> recordVersionedDip(
        @PathVariable String tankId,
        @Valid @RequestBody RecordVersionedDipCmd cmd
    ) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        List<Map<String, Object>> activeCharts = jdbc.queryForList(
            "SELECT * FROM tank_calibration_versions WHERE tenant_id = ? AND tank_id = ? AND status = 'ACTIVE' ORDER BY version_no DESC LIMIT 1",
            tenantId, tankId
        );
        if (activeCharts.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No active calibration chart configured for tank " + tankId);
        }
        Map<String, Object> chart = activeCharts.get(0);
        String calId = String.valueOf(chart.get("id"));
        int verNo = ((Number) chart.get("version_no")).intValue();
        double slope = ((Number) chart.get("slope_litres_per_mm")).doubleValue();
        double offset = ((Number) chart.get("offset_litres")).doubleValue();
        double calibratedLitres = Math.round((cmd.dipMm() * slope + offset) * 100.0) / 100.0;

        String id = "dipv_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO tank_dip_readings_versioned (id, tenant_id, tank_id, calibration_version_id, calibration_version_no, dip_mm, calibrated_litres, recorded_by, recorded_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id, tenantId, tankId, calId, verNo, cmd.dipMm(), calibratedLitres, actor.subject(), Timestamp.from(Instant.now())
        );
        return Map.of(
            "id", id,
            "tankId", tankId,
            "calibrationVersionNo", verNo,
            "dipMm", cmd.dipMm(),
            "calibratedLitres", calibratedLitres
        );
    }

    // =========================================================================
    // T019: Shop Return / Refund Reversal With Cumulative Over-Return Guard
    // =========================================================================
    @GetMapping("/shop-returns")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listShopReturns() {
        return jdbc.queryForList(
            "SELECT * FROM shop_sale_returns WHERE tenant_id = ? ORDER BY created_at DESC",
            accessGuard.currentTenantId()
        );
    }

    @PostMapping("/shop-returns")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    @Transactional
    public Map<String, Object> processShopReturn(@Valid @RequestBody CreateShopReturnCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        Integer alreadyReturned = jdbc.queryForObject(
            "SELECT COALESCE(SUM(returned_qty), 0) FROM shop_sale_returns WHERE tenant_id = ? AND original_sale_id = ? AND sku = ?",
            Integer.class, tenantId, cmd.originalSaleId(), cmd.sku().trim().toUpperCase()
        );
        int prev = alreadyReturned != null ? alreadyReturned : 0;
        if (prev + cmd.returnQty() > cmd.originalQty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "Over-return blocked (T019): cumulative returned quantity (" + (prev + cmd.returnQty()) + ") exceeds original sold quantity (" + cmd.originalQty() + ").");
        }
        long refundFcfa = (long) cmd.returnQty() * cmd.unitPriceFcfa();
        String id = "ret_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO shop_sale_returns (id, tenant_id, station_id, original_sale_id, sku, original_qty, returned_qty, unit_price_fcfa, refund_amount_fcfa, reason, processed_by, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.originalSaleId(), cmd.sku().trim().toUpperCase(),
            cmd.originalQty(), cmd.returnQty(), cmd.unitPriceFcfa(), refundFcfa, cmd.reason(),
            actor.subject(), Timestamp.from(Instant.now())
        );
        audit.record(tenantId, cmd.stationId(), actor.subject(), actor.roles().toString(), "SHOP_RETURN_REFUNDED", "SHOP_RETURN", id,
            "Returned " + cmd.returnQty() + "x " + cmd.sku().toUpperCase() + " = " + refundFcfa + " FCFA");
        return Map.of("id", id, "refundAmountFcfa", refundFcfa, "cumulativeReturnedQty", prev + cmd.returnQty(), "status", "REFUNDED");
    }

    // =========================================================================
    // M24: Inter-Station Transfer Transit Loss Tolerance & Auto Fraud Escalation
    // =========================================================================
    @PostMapping("/transfers/{transferId}/reconcile-transit")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    @Transactional
    public Map<String, Object> reconcileTransferTransit(
        @PathVariable String transferId,
        @Valid @RequestBody ReconcileTransitCmd cmd
    ) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM interstation_transfers WHERE id = ? AND tenant_id = ?",
            transferId, tenantId
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Inter-station transfer not found: " + transferId);
        }
        Map<String, Object> trf = rows.get(0);
        double dispatched = ((Number) trf.get("dispatched_litres")).doubleValue();
        double varianceLitres = Math.round((dispatched - cmd.receivedLitres()) * 100.0) / 100.0;
        double variancePct = dispatched > 0 ? Math.round((Math.abs(varianceLitres) / dispatched) * 10000.0) / 100.0 : 0.0;
        boolean toleranceBreached = variancePct > 0.5;
        String stationId = String.valueOf(trf.get("to_station_id"));

        jdbc.update(
            "UPDATE interstation_transfers SET received_litres = ?, status = 'RECEIVED' WHERE id = ? AND tenant_id = ?",
            cmd.receivedLitres(), transferId, tenantId
        );

        String autoFraudCaseId = null;
        if (toleranceBreached) {
            autoFraudCaseId = "frd_" + UUID.randomUUID().toString().substring(0, 8);
            long estimatedLossFcfa = Math.max(0L, Math.round(Math.abs(varianceLitres) * 840.0));
            Timestamp now = Timestamp.from(Instant.now());
            jdbc.update(
                "INSERT INTO fraud_cases (id, tenant_id, station_id, anomaly_type, severity, subject_ref, suspected_loss_fcfa, recovered_fcfa, investigator, findings, disposition, opened_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                autoFraudCaseId, tenantId, stationId, "TRANSIT_FUEL_SHORTAGE", "HIGH",
                "Transfer " + transferId + " (" + varianceLitres + " L / " + variancePct + "%)",
                estimatedLossFcfa, 0L, actor.subject(),
                "Auto-escalated: tanker transit variance exceeded 0.5% statutory threshold.",
                "UNDER_INVESTIGATION", now, now
            );
        }

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("transferId", transferId);
        res.put("dispatchedLitres", dispatched);
        res.put("receivedLitres", cmd.receivedLitres());
        res.put("varianceLitres", varianceLitres);
        res.put("variancePercent", variancePct);
        res.put("toleranceBreached", toleranceBreached);
        res.put("autoFraudCaseId", autoFraudCaseId);
        return res;
    }

    // =========================================================================
    // M55: Quarantined Tank Live Pre-Dispense Stop-Sale Enforcement
    // =========================================================================
    @PostMapping("/forecourt/pre-dispense-check")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    public Map<String, Object> enforceQuarantinePreDispense(@Valid @RequestBody PreDispenseCheckCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        Integer qCount = jdbc.queryForObject(
            "SELECT COUNT(*) FROM fuel_quality_samples WHERE tenant_id = ? AND tank_id = ? AND quarantined = TRUE",
            Integer.class, tenantId, cmd.tankId()
        );
        if (qCount != null && qCount > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "STOP-SALE ENFORCED (M55): Tank " + cmd.tankId() + " is under active quality quarantine. Pump " + cmd.pumpCode() + " cannot open or dispense until released.");
        }
        return Map.of("tankId", cmd.tankId(), "pumpCode", cmd.pumpCode(), "authorized", true);
    }
}
