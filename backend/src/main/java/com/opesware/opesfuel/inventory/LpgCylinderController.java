package com.opesware.opesfuel.inventory;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

record CreateLpgSkuCommand(
    @NotBlank String brand,
    @Positive double sizeKg,
    @NotBlank String skuCode,
    @Min(100) long gasRefillPriceFcfa,
    @Min(0) long depositFcfa,
    @Min(0) long crossBrandSwapFeeFcfa
) {}

record RecordLpgTransactionCommand(
    @NotBlank String stationId,
    @NotBlank String skuId,
    String swapFromSkuId,
    @NotBlank String txType,
    @Min(1) int quantity,
    String customerName,
    String customerPhone,
    String paymentMethod,
    String notes
) {}

@RestController
@RequestMapping("/api/v1/lpg")
public class LpgCylinderController {

    private static final Set<String> MANAGER_ONLY_TYPES = Set.of("SUPPLIER_DELIVERY", "EMPTY_PICKUP", "DAMAGE_WRITEOFF");
    private static final Set<String> ALL_TYPES = Set.of(
        "REFILL_EXCHANGE", "NEW_SALE_WITH_DEPOSIT", "DEPOSIT_REFUND",
        "CROSS_BRAND_SWAP", "SUPPLIER_DELIVERY", "EMPTY_PICKUP", "DAMAGE_WRITEOFF"
    );

    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;

    public LpgCylinderController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping("/skus")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<Map<String, Object>> listSkus() {
        return jdbcTemplate.queryForList(
            "SELECT * FROM lpg_cylinder_skus WHERE tenant_id = ? ORDER BY brand ASC, size_kg ASC",
            accessGuard.currentTenantId()
        );
    }

    @PostMapping("/skus")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> createSku(@Valid @RequestBody CreateLpgSkuCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String id = "lpgsku_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO lpg_cylinder_skus (
                id, tenant_id, brand, size_kg, sku_code, gas_refill_price_fcfa,
                deposit_fcfa, cross_brand_swap_fee_fcfa, active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
            """,
            id, principal.tenantId(), cmd.brand().trim().toUpperCase(), cmd.sizeKg(),
            cmd.skuCode().trim().toUpperCase(), cmd.gasRefillPriceFcfa(),
            cmd.depositFcfa(), cmd.crossBrandSwapFeeFcfa(), Timestamp.from(Instant.now())
        );
        return jdbcTemplate.queryForMap("SELECT * FROM lpg_cylinder_skus WHERE id = ?", id);
    }

    @GetMapping("/stock")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<Map<String, Object>> listStock(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        if (stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId)) {
            return jdbcTemplate.queryForList(
                """
                SELECT s.*, k.brand, k.size_kg, k.sku_code, k.gas_refill_price_fcfa, k.deposit_fcfa, k.cross_brand_swap_fee_fcfa
                FROM lpg_station_stock s
                JOIN lpg_cylinder_skus k ON k.id = s.sku_id
                WHERE s.tenant_id = ? AND s.station_id = ?
                ORDER BY k.brand, k.size_kg
                """,
                tenantId, stationId
            );
        }
        return jdbcTemplate.queryForList(
            """
            SELECT s.*, k.brand, k.size_kg, k.sku_code, k.gas_refill_price_fcfa, k.deposit_fcfa, k.cross_brand_swap_fee_fcfa
            FROM lpg_station_stock s
            JOIN lpg_cylinder_skus k ON k.id = s.sku_id
            WHERE s.tenant_id = ?
            ORDER BY s.station_id, k.brand, k.size_kg
            """,
            tenantId
        );
    }

    @PostMapping("/transactions")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    public Map<String, Object> recordTransaction(@Valid @RequestBody RecordLpgTransactionCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String tenantId = principal.tenantId();
        String type = cmd.txType().trim().toUpperCase();
        if (!ALL_TYPES.contains(type)) {
            throw new IllegalArgumentException("Unsupported LPG cylinder transaction type: " + type);
        }
        if (MANAGER_ONLY_TYPES.contains(type)
            && !principal.hasRole("PLATFORM_ADMIN") && !principal.hasRole("OWNER") && !principal.hasRole("MANAGER")) {
            throw new org.springframework.security.access.AccessDeniedException(
                "Only MANAGER or OWNER may record " + type + " stock movements."
            );
        }

        Map<String, Object> sku = jdbcTemplate.queryForMap(
            "SELECT * FROM lpg_cylinder_skus WHERE id = ? AND tenant_id = ?", cmd.skuId(), tenantId
        );
        long refillPrice = ((Number) sku.get("gas_refill_price_fcfa")).longValue();
        long depositPrice = ((Number) sku.get("deposit_fcfa")).longValue();
        long swapFeeUnit = ((Number) sku.get("cross_brand_swap_fee_fcfa")).longValue();
        int qty = cmd.quantity();

        Map<String, Object> stock = getOrCreateStockRow(tenantId, cmd.stationId(), cmd.skuId());
        int fullQty = ((Number) stock.get("full_qty")).intValue();
        int emptyQty = ((Number) stock.get("empty_qty")).intValue();
        int damagedQty = ((Number) stock.get("damaged_qty")).intValue();

        long gasAmount = 0;
        long depositDelta = 0;
        long swapFee = 0;

        switch (type) {
            case "REFILL_EXCHANGE" -> {
                requireStock(fullQty, qty, "FULL cylinders");
                fullQty -= qty;
                emptyQty += qty;
                gasAmount = refillPrice * qty;
            }
            case "NEW_SALE_WITH_DEPOSIT" -> {
                requireStock(fullQty, qty, "FULL cylinders");
                fullQty -= qty;
                gasAmount = refillPrice * qty;
                depositDelta = depositPrice * qty; // liability increases (collected from customer)
            }
            case "DEPOSIT_REFUND" -> {
                emptyQty += qty;
                depositDelta = -(depositPrice * qty); // liability decreases (refunded to customer)
            }
            case "CROSS_BRAND_SWAP" -> {
                if (cmd.swapFromSkuId() == null || cmd.swapFromSkuId().isBlank()) {
                    throw new IllegalArgumentException("swapFromSkuId is required for CROSS_BRAND_SWAP.");
                }
                requireStock(fullQty, qty, "FULL cylinders of target brand");
                fullQty -= qty;
                // Incoming empty cylinder belongs to swapFromSkuId
                Map<String, Object> fromStock = getOrCreateStockRow(tenantId, cmd.stationId(), cmd.swapFromSkuId());
                int fromEmpty = ((Number) fromStock.get("empty_qty")).intValue();
                jdbcTemplate.update(
                    "UPDATE lpg_station_stock SET empty_qty = ?, updated_at = ? WHERE id = ?",
                    fromEmpty + qty, Timestamp.from(Instant.now()), fromStock.get("id")
                );
                gasAmount = refillPrice * qty;
                swapFee = swapFeeUnit * qty;
            }
            case "SUPPLIER_DELIVERY" -> {
                fullQty += qty;
            }
            case "EMPTY_PICKUP" -> {
                requireStock(emptyQty, qty, "EMPTY cylinders");
                emptyQty -= qty;
            }
            case "DAMAGE_WRITEOFF" -> {
                requireStock(emptyQty, qty, "EMPTY cylinders for damage write-off");
                emptyQty -= qty;
                damagedQty += qty;
            }
        }

        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
            "UPDATE lpg_station_stock SET full_qty = ?, empty_qty = ?, damaged_qty = ?, updated_at = ? WHERE id = ?",
            fullQty, emptyQty, damagedQty, now, stock.get("id")
        );

        long totalFcfa = gasAmount + depositDelta + swapFee;
        String txId = "lpgtx_" + UUID.randomUUID().toString().substring(0, 10);
        String receiptNo = "LPG-" + LocalDate.now(ZoneOffset.UTC).toString().replace("-", "")
            + "-" + UUID.randomUUID().toString().substring(0, 5).toUpperCase();

        jdbcTemplate.update(
            """
            INSERT INTO lpg_cylinder_transactions (
                id, tenant_id, station_id, sku_id, swap_from_sku_id, tx_type, quantity,
                customer_name, customer_phone, gas_amount_fcfa, deposit_delta_fcfa,
                swap_fee_fcfa, total_fcfa, payment_method, receipt_no, notes, actor, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            txId, tenantId, cmd.stationId(), cmd.skuId(), cmd.swapFromSkuId(), type, qty,
            cmd.customerName(), cmd.customerPhone(), gasAmount, depositDelta, swapFee, totalFcfa,
            cmd.paymentMethod() != null ? cmd.paymentMethod().trim().toUpperCase() : "CASH",
            receiptNo, cmd.notes(), principal.subject(), now
        );

        auditRecorder.record(
            tenantId, cmd.stationId(), principal.subject(),
            principal.roles().stream().findFirst().orElse("ATTENDANT"),
            "LPG_" + type, "LPG_SKU", cmd.skuId(),
            type + " x" + qty + " (" + sku.get("sku_code") + ") total=" + totalFcfa + " FCFA receipt=" + receiptNo
        );

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", txId);
        out.put("receiptNo", receiptNo);
        out.put("txType", type);
        out.put("skuCode", sku.get("sku_code"));
        out.put("quantity", qty);
        out.put("gasAmountFcfa", gasAmount);
        out.put("depositDeltaFcfa", depositDelta);
        out.put("swapFeeFcfa", swapFee);
        out.put("totalFcfa", totalFcfa);
        out.put("remainingFullQty", fullQty);
        out.put("remainingEmptyQty", emptyQty);
        out.put("damagedQty", damagedQty);
        out.put("createdAt", now.toInstant().toString());
        return out;
    }

    @GetMapping("/transactions")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<Map<String, Object>> listTransactions(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        if (stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId)) {
            return jdbcTemplate.queryForList(
                "SELECT * FROM lpg_cylinder_transactions WHERE tenant_id = ? AND station_id = ? ORDER BY created_at DESC LIMIT 150",
                tenantId, stationId
            );
        }
        return jdbcTemplate.queryForList(
            "SELECT * FROM lpg_cylinder_transactions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 150",
            tenantId
        );
    }

    @GetMapping("/reconciliation")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> dailyReconciliation(@RequestParam String stationId) {
        String tenantId = accessGuard.currentTenantId();
        Instant dayStart = LocalDate.now(ZoneOffset.UTC).atStartOfDay().toInstant(ZoneOffset.UTC);
        Map<String, Object> depositLiability = jdbcTemplate.queryForMap(
            "SELECT COALESCE(SUM(deposit_delta_fcfa), 0) AS liability FROM lpg_cylinder_transactions WHERE tenant_id = ? AND station_id = ?",
            tenantId, stationId
        );
        Map<String, Object> todaySummary = jdbcTemplate.queryForMap(
            """
            SELECT COALESCE(SUM(gas_amount_fcfa), 0) AS gas_rev,
                   COALESCE(SUM(swap_fee_fcfa), 0) AS swap_rev,
                   COALESCE(SUM(deposit_delta_fcfa), 0) AS today_deposit_net,
                   COUNT(*) AS tx_count
            FROM lpg_cylinder_transactions
            WHERE tenant_id = ? AND station_id = ? AND created_at >= ?
            """,
            tenantId, stationId, Timestamp.from(dayStart)
        );
        List<Map<String, Object>> stock = listStock(stationId);
        int totalFull = stock.stream().mapToInt(r -> ((Number) r.get("full_qty")).intValue()).sum();
        int totalEmpty = stock.stream().mapToInt(r -> ((Number) r.get("empty_qty")).intValue()).sum();
        int totalDamaged = stock.stream().mapToInt(r -> ((Number) r.get("damaged_qty")).intValue()).sum();

        return Map.of(
            "stationId", stationId,
            "date", LocalDate.now(ZoneOffset.UTC).toString(),
            "totalFullBottles", totalFull,
            "totalEmptyBottles", totalEmpty,
            "totalDamagedBottles", totalDamaged,
            "cumulativeDepositLiabilityFcfa", ((Number) depositLiability.get("liability")).longValue(),
            "todayGasRevenueFcfa", ((Number) todaySummary.get("gas_rev")).longValue(),
            "todaySwapFeesFcfa", ((Number) todaySummary.get("swap_rev")).longValue(),
            "todayNetDepositFcfa", ((Number) todaySummary.get("today_deposit_net")).longValue(),
            "todayTransactions", ((Number) todaySummary.get("tx_count")).intValue()
        );
    }

    private Map<String, Object> getOrCreateStockRow(String tenantId, String stationId, String skuId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT * FROM lpg_station_stock WHERE station_id = ? AND sku_id = ?", stationId, skuId
        );
        if (!rows.isEmpty()) return rows.get(0);
        String id = "lpgstk_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            "INSERT INTO lpg_station_stock (id, tenant_id, station_id, sku_id, full_qty, empty_qty, damaged_qty, in_transit_qty, updated_at) VALUES (?, ?, ?, ?, 0, 0, 0, 0, ?)",
            id, tenantId, stationId, skuId, Timestamp.from(Instant.now())
        );
        return jdbcTemplate.queryForMap("SELECT * FROM lpg_station_stock WHERE id = ?", id);
    }

    private static void requireStock(int available, int requested, String label) {
        if (available < requested) {
            throw new IllegalStateException(
                "Insufficient LPG stock: requested " + requested + " " + label + " but only " + available + " available."
            );
        }
    }
}
