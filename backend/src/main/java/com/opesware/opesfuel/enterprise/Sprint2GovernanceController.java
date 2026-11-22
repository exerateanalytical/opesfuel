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
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

record CreateCouponCmd(
    @NotBlank String code,
    @NotBlank String discountType,
    @Min(1) long discountValue,
    @Min(1) int maxRedemptions,
    @NotBlank String expiresAt
) {}

record ValidateCouponCmd(@NotBlank String code, @Min(1) long grossAmountFcfa) {}

record CreateCreditNoteCmd(
    @NotBlank String invoiceId,
    @Min(1) long amountFcfa,
    @NotBlank String reason
) {}

record DunningTransitionCmd(
    @NotBlank String previousState,
    @NotBlank String newState,
    @NotBlank String channel,
    @NotBlank String note
) {}

record ProrationPreviewCmd(
    @Min(0) long currentMonthlyFeeFcfa,
    @Min(0) long targetMonthlyFeeFcfa,
    @Min(1) int daysRemainingInCycle,
    @Min(1) int totalDaysInCycle
) {}

record CreateShopBatchCmd(
    @NotBlank String stationId,
    @NotBlank String sku,
    @NotBlank String barcode,
    @NotBlank String itemName,
    @NotBlank String batchCode,
    @NotBlank String expiryDate,
    @Min(1) int quantityRemaining,
    @Min(1) long unitPriceFcfa
) {}

record CartLineItem(@NotBlank String skuOrBarcode, @Min(1) int quantity) {}

record CartCheckoutCmd(
    @NotBlank String stationId,
    @NotBlank String paymentMethod,
    @NotEmpty List<@Valid CartLineItem> items
) {}

record CreateStockAdjustmentCmd(
    @NotBlank String stationId,
    @NotBlank String sku,
    @NotBlank String itemName,
    int qtyDelta,
    @Min(0) long unitCostFcfa,
    @NotBlank String reason
) {}

record TransitionAdjustmentCmd(@NotBlank String nextStatus) {}

record CreateDelegationCmd(
    @NotBlank String granteeEmail,
    @NotBlank String permissionScope,
    @NotBlank String reason,
    @NotBlank String expiresAt
) {}

record CreateBreakGlassCmd(
    @NotBlank String elevatedRole,
    @NotBlank String incidentTicket,
    @NotBlank String justification
) {}

record CreateAccessReviewCmd(
    @NotBlank String cycleLabel,
    @NotBlank String targetUserEmail,
    @NotBlank String assignedRole,
    @NotBlank String decision,
    String notes
) {}

@RestController
@RequestMapping("/api/v1/enterprise")
public class Sprint2GovernanceController {
    private static final Set<String> VALID_SUBSCRIPTION_STATES = Set.of(
        "TRIAL", "ACTIVE", "PAST_DUE", "GRACE", "RESTRICTED", "CANCELLED", "EXPIRED"
    );
    private static final Map<String, Set<String>> ADJUSTMENT_TRANSITIONS = Map.of(
        "DRAFT", Set.of("PENDING_APPROVAL", "REJECTED"),
        "PENDING_APPROVAL", Set.of("APPROVED", "REJECTED"),
        "APPROVED", Set.of("POSTED", "REJECTED"),
        "POSTED", Set.of(),
        "REJECTED", Set.of()
    );

    private final JdbcTemplate jdbc;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder audit;

    public Sprint2GovernanceController(JdbcTemplate jdbc, TenantAccessGuard accessGuard, AuditTrailRecorder audit) {
        this.jdbc = jdbc;
        this.accessGuard = accessGuard;
        this.audit = audit;
    }

    // =========================================================================
    // M03: Billing Coupons, Credit Notes, Proration & Subscription Dunning
    // =========================================================================
    @GetMapping("/billing/coupons")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listCoupons() {
        return jdbc.queryForList("SELECT * FROM billing_coupons WHERE tenant_id = ? ORDER BY created_at DESC", accessGuard.currentTenantId());
    }

    @PostMapping("/billing/coupons")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> createCoupon(@Valid @RequestBody CreateCouponCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "cpn_" + UUID.randomUUID().toString().substring(0, 8);
        String code = cmd.code().trim().toUpperCase();
        jdbc.update(
            "INSERT INTO billing_coupons (id, tenant_id, code, discount_type, discount_value, max_redemptions, redemptions_used, expires_at, active, created_at) VALUES (?,?,?,?,?,?,0,?,TRUE,?)",
            id, tenantId, code, cmd.discountType().toUpperCase(), cmd.discountValue(),
            cmd.maxRedemptions(), cmd.expiresAt(), Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "code", code, "active", true);
    }

    @PostMapping("/billing/coupons/validate")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    @Transactional
    public Map<String, Object> validateAndApplyCoupon(@Valid @RequestBody ValidateCouponCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM billing_coupons WHERE tenant_id = ? AND UPPER(code) = ? AND active = TRUE",
            tenantId, cmd.code().trim().toUpperCase()
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Coupon code not found or inactive: " + cmd.code());
        }
        Map<String, Object> cpn = rows.get(0);
        int used = ((Number) cpn.get("redemptions_used")).intValue();
        int max = ((Number) cpn.get("max_redemptions")).intValue();
        if (used >= max) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Coupon redemption limit reached (" + max + ").");
        }
        String expiresAt = String.valueOf(cpn.get("expires_at"));
        if (LocalDate.parse(expiresAt).isBefore(LocalDate.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Coupon expired on " + expiresAt);
        }
        String type = String.valueOf(cpn.get("discount_type"));
        long val = ((Number) cpn.get("discount_value")).longValue();
        long discountFcfa = "PERCENT".equalsIgnoreCase(type)
            ? Math.round(cmd.grossAmountFcfa() * (Math.min(100L, val) / 100.0))
            : Math.min(cmd.grossAmountFcfa(), val);
        long netFcfa = Math.max(0L, cmd.grossAmountFcfa() - discountFcfa);
        jdbc.update("UPDATE billing_coupons SET redemptions_used = redemptions_used + 1 WHERE id = ?", cpn.get("id"));
        return Map.of(
            "code", cpn.get("code"),
            "grossAmountFcfa", cmd.grossAmountFcfa(),
            "discountFcfa", discountFcfa,
            "netAmountFcfa", netFcfa,
            "redemptionsUsed", used + 1
        );
    }

    @GetMapping("/billing/credit-notes")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listCreditNotes() {
        return jdbc.queryForList("SELECT * FROM billing_credit_notes WHERE tenant_id = ? ORDER BY issued_at DESC", accessGuard.currentTenantId());
    }

    @PostMapping("/billing/credit-notes")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public Map<String, Object> issueCreditNote(@Valid @RequestBody CreateCreditNoteCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String id = "cn_" + UUID.randomUUID().toString().substring(0, 8);
        String num = "CN-" + LocalDate.now().getYear() + "-" + UUID.randomUUID().toString().substring(0, 5).toUpperCase();
        jdbc.update(
            "INSERT INTO billing_credit_notes (id, tenant_id, credit_note_number, invoice_id, amount_fcfa, reason, issued_by, status, issued_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id, tenantId, num, cmd.invoiceId(), cmd.amountFcfa(), cmd.reason(), actor.subject(), "ISSUED", Timestamp.from(Instant.now())
        );
        audit.record(tenantId, null, actor.subject(), actor.roles().toString(), "CREDIT_NOTE_ISSUED", "BILLING", id, num + " (" + cmd.amountFcfa() + " FCFA)");
        return Map.of("id", id, "creditNoteNumber", num, "amountFcfa", cmd.amountFcfa(), "status", "ISSUED");
    }

    @GetMapping("/billing/dunning")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listDunning() {
        return jdbc.queryForList("SELECT * FROM billing_dunning_events WHERE tenant_id = ? ORDER BY recorded_at DESC", accessGuard.currentTenantId());
    }

    @PostMapping("/billing/dunning")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> recordDunningTransition(@Valid @RequestBody DunningTransitionCmd cmd) {
        String prev = cmd.previousState().trim().toUpperCase();
        String next = cmd.newState().trim().toUpperCase();
        if (!VALID_SUBSCRIPTION_STATES.contains(prev) || !VALID_SUBSCRIPTION_STATES.contains(next)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid subscription lifecycle state.");
        }
        String tenantId = accessGuard.currentTenantId();
        String id = "dun_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO billing_dunning_events (id, tenant_id, previous_state, new_state, channel, note, recorded_at) VALUES (?,?,?,?,?,?,?)",
            id, tenantId, prev, next, cmd.channel().toUpperCase(), cmd.note(), Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "previousState", prev, "newState", next);
    }

    @PostMapping("/billing/proration-preview")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public Map<String, Object> previewProration(@Valid @RequestBody ProrationPreviewCmd cmd) {
        double ratio = Math.min(1.0, (double) cmd.daysRemainingInCycle() / Math.max(1, cmd.totalDaysInCycle()));
        long unusedCredit = Math.round(cmd.currentMonthlyFeeFcfa() * ratio);
        long proratedNew = Math.round(cmd.targetMonthlyFeeFcfa() * ratio);
        long netDueFcfa = proratedNew - unusedCredit;
        return Map.of(
            "unusedCreditFcfa", unusedCredit,
            "proratedTargetFcfa", proratedNew,
            "netProratedDeltaFcfa", netDueFcfa,
            "action", netDueFcfa >= 0 ? "INVOICE_UPGRADE_DELTA" : "ISSUE_CREDIT_NOTE"
        );
    }

    // =========================================================================
    // M16 & M17: Shop FEFO Batches, Multi-Item Barcode Cart & Stock Adjustments
    // =========================================================================
    @GetMapping("/shop/batches")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT')")
    public List<Map<String, Object>> listShopBatches() {
        return jdbc.queryForList(
            "SELECT * FROM shop_sku_batches WHERE tenant_id = ? ORDER BY expiry_date ASC",
            accessGuard.currentTenantId()
        );
    }

    @PostMapping("/shop/batches")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> createShopBatch(@Valid @RequestBody CreateShopBatchCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        String id = "bch_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO shop_sku_batches (id, tenant_id, station_id, sku, barcode, item_name, batch_code, expiry_date, quantity_remaining, unit_price_fcfa, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.sku().toUpperCase(), cmd.barcode().trim(), cmd.itemName(),
            cmd.batchCode().toUpperCase(), cmd.expiryDate(), cmd.quantityRemaining(), cmd.unitPriceFcfa(),
            Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "batchCode", cmd.batchCode().toUpperCase(), "quantityRemaining", cmd.quantityRemaining());
    }

    @PostMapping("/shop/cart-checkout")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    @Transactional
    public Map<String, Object> checkoutCartFefo(@Valid @RequestBody CartCheckoutCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        long grandTotal = 0L;
        List<Map<String, Object>> deductions = new ArrayList<>();

        for (CartLineItem line : cmd.items()) {
            String key = line.skuOrBarcode().trim();
            List<Map<String, Object>> batches = jdbc.queryForList(
                "SELECT * FROM shop_sku_batches WHERE tenant_id = ? AND station_id = ? AND (UPPER(sku) = ? OR barcode = ?) AND quantity_remaining > 0 ORDER BY expiry_date ASC",
                tenantId, cmd.stationId(), key.toUpperCase(), key
            );
            int remainingToPick = line.quantity();
            for (Map<String, Object> b : batches) {
                if (remainingToPick <= 0) break;
                int avail = ((Number) b.get("quantity_remaining")).intValue();
                int take = Math.min(avail, remainingToPick);
                long unitPrice = ((Number) b.get("unit_price_fcfa")).longValue();
                jdbc.update(
                    "UPDATE shop_sku_batches SET quantity_remaining = quantity_remaining - ? WHERE id = ?",
                    take, b.get("id")
                );
                grandTotal += take * unitPrice;
                remainingToPick -= take;
                deductions.add(Map.of(
                    "batchId", b.get("id"),
                    "batchCode", b.get("batch_code"),
                    "expiryDate", b.get("expiry_date"),
                    "sku", b.get("sku"),
                    "quantityPicked", take,
                    "lineTotalFcfa", take * unitPrice
                ));
            }
            if (remainingToPick > 0) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Insufficient FEFO batch stock for " + key);
            }
        }
        String receiptNo = "POS-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return Map.of(
            "receiptNumber", receiptNo,
            "paymentMethod", cmd.paymentMethod().toUpperCase(),
            "grandTotalFcfa", grandTotal,
            "fefoDeductions", deductions
        );
    }

    @GetMapping("/stock-adjustments")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listStockAdjustments() {
        return jdbc.queryForList("SELECT * FROM stock_adjustments WHERE tenant_id = ? ORDER BY created_at DESC", accessGuard.currentTenantId());
    }

    @PostMapping("/stock-adjustments")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> createStockAdjustment(@Valid @RequestBody CreateStockAdjustmentCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String id = "adj_" + UUID.randomUUID().toString().substring(0, 8);
        Timestamp now = Timestamp.from(Instant.now());
        jdbc.update(
            "INSERT INTO stock_adjustments (id, tenant_id, station_id, sku, item_name, qty_delta, unit_cost_fcfa, reason, status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.stationId(), cmd.sku().toUpperCase(), cmd.itemName(), cmd.qtyDelta(),
            cmd.unitCostFcfa(), cmd.reason(), "DRAFT", actor.subject(), now, now
        );
        return Map.of("id", id, "status", "DRAFT");
    }

    @PatchMapping("/stock-adjustments/{adjId}/transition")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> transitionStockAdjustment(@PathVariable String adjId, @Valid @RequestBody TransitionAdjustmentCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        Map<String, Object> row = jdbc.queryForMap(
            "SELECT status, created_by FROM stock_adjustments WHERE id = ? AND tenant_id = ?",
            adjId, tenantId
        );
        String current = String.valueOf(row.get("status"));
        String createdBy = String.valueOf(row.get("created_by"));
        String next = cmd.nextStatus().trim().toUpperCase();

        if (!ADJUSTMENT_TRANSITIONS.getOrDefault(current, Set.of()).contains(next)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Invalid stock adjustment transition: " + current + " -> " + next);
        }
        if ("APPROVED".equals(next) && createdBy.equalsIgnoreCase(actor.subject())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Maker-checker violation: creator cannot approve own stock adjustment.");
        }
        jdbc.update(
            "UPDATE stock_adjustments SET status = ?, approved_by = CASE WHEN ? = 'APPROVED' THEN ? ELSE approved_by END, updated_at = ? WHERE id = ? AND tenant_id = ?",
            next, next, actor.subject(), Timestamp.from(Instant.now()), adjId, tenantId
        );
        audit.record(tenantId, null, actor.subject(), actor.roles().toString(), "STOCK_ADJUSTMENT_" + next, "STOCK_ADJUSTMENT", adjId, current + " -> " + next);
        return Map.of("id", adjId, "previousStatus", current, "status", next);
    }

    // =========================================================================
    // M05: IAM Delegated Grants, Break-Glass Emergency Elevation & Access Reviews
    // =========================================================================
    @GetMapping("/iam/delegations")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public List<Map<String, Object>> listDelegations() {
        return jdbc.queryForList("SELECT * FROM iam_delegated_grants WHERE tenant_id = ? ORDER BY created_at DESC", accessGuard.currentTenantId());
    }

    @PostMapping("/iam/delegations")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> createDelegation(@Valid @RequestBody CreateDelegationCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String id = "dlg_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO iam_delegated_grants (id, tenant_id, grantor_sub, grantee_email, permission_scope, reason, expires_at, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id, tenantId, actor.subject(), cmd.granteeEmail().trim(), cmd.permissionScope().toUpperCase(),
            cmd.reason(), cmd.expiresAt(), "ACTIVE", Timestamp.from(Instant.now())
        );
        audit.record(tenantId, null, actor.subject(), actor.roles().toString(), "IAM_DELEGATION_GRANTED", "IAM", id, cmd.permissionScope() + " -> " + cmd.granteeEmail());
        return Map.of("id", id, "status", "ACTIVE");
    }

    @PatchMapping("/iam/delegations/{delegationId}/revoke")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> revokeDelegation(@PathVariable String delegationId) {
        String tenantId = accessGuard.currentTenantId();
        jdbc.update("UPDATE iam_delegated_grants SET status = 'REVOKED' WHERE id = ? AND tenant_id = ?", delegationId, tenantId);
        return Map.of("id", delegationId, "status", "REVOKED");
    }

    @GetMapping("/iam/break-glass")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listBreakGlass() {
        return jdbc.queryForList("SELECT * FROM iam_break_glass_sessions WHERE tenant_id = ? ORDER BY created_at DESC", accessGuard.currentTenantId());
    }

    @PostMapping("/iam/break-glass")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> triggerBreakGlass(@Valid @RequestBody CreateBreakGlassCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String id = "bg_" + UUID.randomUUID().toString().substring(0, 8);
        Instant now = Instant.now();
        Instant expires = now.plusSeconds(7200);
        jdbc.update(
            "INSERT INTO iam_break_glass_sessions (id, tenant_id, actor_sub, elevated_role, incident_ticket, justification, expires_at, review_status, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id, tenantId, actor.subject(), cmd.elevatedRole().toUpperCase(), cmd.incidentTicket().trim(),
            cmd.justification().trim(), Timestamp.from(expires), "PENDING_AUDIT", Timestamp.from(now)
        );
        audit.record(tenantId, null, actor.subject(), actor.roles().toString(), "IAM_BREAK_GLASS_TRIGGERED", "SECURITY", id, "Ticket " + cmd.incidentTicket() + ": " + cmd.justification());
        return Map.of("id", id, "elevatedRole", cmd.elevatedRole().toUpperCase(), "expiresAt", expires.toString(), "reviewStatus", "PENDING_AUDIT");
    }

    @GetMapping("/iam/access-reviews")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listAccessReviews() {
        return jdbc.queryForList("SELECT * FROM iam_access_reviews WHERE tenant_id = ? ORDER BY reviewed_at DESC", accessGuard.currentTenantId());
    }

    @PostMapping("/iam/access-reviews")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> recordAccessReview(@Valid @RequestBody CreateAccessReviewCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String id = "rev_" + UUID.randomUUID().toString().substring(0, 8);
        jdbc.update(
            "INSERT INTO iam_access_reviews (id, tenant_id, cycle_label, target_user_email, assigned_role, decision, reviewer_sub, notes, reviewed_at) VALUES (?,?,?,?,?,?,?,?,?)",
            id, tenantId, cmd.cycleLabel(), cmd.targetUserEmail().trim(), cmd.assignedRole().toUpperCase(),
            cmd.decision().toUpperCase(), actor.subject(), cmd.notes(), Timestamp.from(Instant.now())
        );
        audit.record(tenantId, null, actor.subject(), actor.roles().toString(), "IAM_ACCESS_RECERTIFIED", "IAM", id, cmd.targetUserEmail() + " -> " + cmd.decision().toUpperCase());
        return Map.of("id", id, "decision", cmd.decision().toUpperCase());
    }
}
