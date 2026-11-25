package com.opesware.opesfuel.billing;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

record InitiateCheckoutCommand(
    @NotBlank String provider,
    String phoneNumber
) {}

record PaymentWebhookPayload(
    @NotBlank String externalRef,
    @NotBlank String status,
    String transactionId
) {}

@RestController
public class PaymentGatewayController {
    private static final Set<String> PROVIDERS = Set.of("ORANGE_MONEY", "MTN_MOMO", "CINETPAY", "STRIPE");

    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;

    @Value("${opesfuel.payment.checkout-base-url:https://pay.opesfuel.com/checkout}")
    private String checkoutBaseUrl;

    @Value("${opesfuel.payment.webhook-secret:opesfuel-dev-webhook-secret}")
    private String webhookSecret;

    public PaymentGatewayController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping("/api/v1/billing/subscription-status")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT') or hasAuthority('SCOPE_billing:read')")
    public Map<String, Object> subscriptionStatus() {
        String tenantId = accessGuard.currentTenantId();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT * FROM tenants WHERE id = ?", tenantId
        );
        String tenantStatus = rows.isEmpty() ? "ACTIVE" : String.valueOf(rows.get(0).getOrDefault("status", "ACTIVE"));
        String billingStatus = rows.isEmpty() || rows.get(0).get("billing_status") == null ? "CURRENT" : String.valueOf(rows.get(0).get("billing_status"));
        Instant createdAt = Instant.now();
        if (!rows.isEmpty() && rows.get(0).get("created_at") instanceof Timestamp ts) {
            createdAt = ts.toInstant();
        }
        // The trial end recorded on the company wins (admins can extend it); 14 days from creation is only a fallback.
        Instant trialEndsAt = createdAt.plusSeconds(14L * 86400L);
        if (!rows.isEmpty()) {
            Object raw = rows.get(0).get("trial_ends_at");
            if (raw instanceof java.util.Date d) trialEndsAt = d.toInstant();                       // Postgres timestamp / timestamptz
            else if (raw instanceof java.time.OffsetDateTime o) trialEndsAt = o.toInstant();
            else if (raw instanceof java.time.LocalDateTime l) trialEndsAt = l.toInstant(java.time.ZoneOffset.UTC);
        }
        long daysRemaining = Math.max(0L, (trialEndsAt.getEpochSecond() - Instant.now().getEpochSecond()) / 86400L);
        boolean inTrial = "TRIAL".equalsIgnoreCase(billingStatus) && trialEndsAt.isAfter(Instant.now());
        boolean readOnly = com.opesware.opesfuel.shared.security.TenantPolicyFilter.isWriteLocked(billingStatus, trialEndsAt, Instant.now());
        Integer overdueCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM billing_invoices WHERE tenant_id = ? AND status IN ('ISSUED', 'OVERDUE') AND due_at < ?",
            Integer.class, tenantId, Timestamp.from(Instant.now().minusSeconds(7L * 86400L))
        );
        int overdue = overdueCount != null ? overdueCount : 0;
        boolean graceLocked = "SUSPENDED".equalsIgnoreCase(tenantStatus) || overdue >= 2;
        return Map.of(
            "tenantId", tenantId,
            "tenantStatus", tenantStatus,
            "trialActive", inTrial,
            "billingStatus", billingStatus,
            "readOnly", readOnly,
            "trialEndsAt", trialEndsAt.toString(),
            "trialDaysRemaining", daysRemaining,
            "overdueInvoicesCount", overdue,
            "gracePeriodLocked", graceLocked
        );
    }

    @GetMapping("/api/v1/billing/payments")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT') or hasAuthority('SCOPE_billing:read')")
    public List<Map<String, Object>> listPayments() {
        String tenantId = accessGuard.currentTenantId();
        return jdbcTemplate.query(
            "SELECT * FROM payment_transactions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100",
            (rs, idx) -> Map.<String, Object>of(
                "id", rs.getString("id"),
                "invoiceId", rs.getString("invoice_id"),
                "provider", rs.getString("provider"),
                "externalRef", rs.getString("external_ref"),
                "amountFcfa", rs.getLong("amount_fcfa"),
                "currency", rs.getString("currency"),
                "status", rs.getString("status"),
                "checkoutUrl", rs.getString("checkout_url"),
                "createdAt", rs.getTimestamp("created_at").toInstant().toString()
            ),
            tenantId
        );
    }

    @PostMapping("/api/v1/billing/invoices/{invoiceId}/checkout")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT') or hasAuthority('SCOPE_billing:write')")
    public Map<String, Object> initiateCheckout(
        @PathVariable String invoiceId,
        @Valid @RequestBody InitiateCheckoutCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String provider = cmd.provider().trim().toUpperCase();
        if (!PROVIDERS.contains(provider)) {
            throw new IllegalArgumentException("Unsupported payment provider: " + provider);
        }

        Map<String, Object> inv = jdbcTemplate.queryForMap(
            "SELECT id, tenant_id, total_fcfa, status FROM billing_invoices WHERE id = ?",
            invoiceId
        );
        accessGuard.assertTenantMatch(String.valueOf(inv.get("tenant_id")));
        if ("PAID".equalsIgnoreCase(String.valueOf(inv.get("status")))) {
            throw new IllegalStateException("Invoice " + invoiceId + " is already PAID.");
        }

        long amount = ((Number) inv.get("total_fcfa")).longValue();
        String txId = "pay_" + UUID.randomUUID().toString().substring(0, 10);
        String extRef = provider.substring(0, 3) + "-" + UUID.randomUUID().toString().substring(0, 10).toUpperCase();
        String checkoutUrl = checkoutBaseUrl + "/" + provider.toLowerCase() + "?ref=" + extRef + "&amount=" + amount + "&currency=XAF";

        jdbcTemplate.update(
            """
            INSERT INTO payment_transactions (id, tenant_id, invoice_id, provider, external_ref, amount_fcfa, currency, status, checkout_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'XAF', 'PENDING', ?, ?)
            """,
            txId, principal.tenantId(), invoiceId, provider, extRef, amount, checkoutUrl, Timestamp.from(Instant.now())
        );

        auditRecorder.record(
            principal.tenantId(), null, principal.subject(),
            principal.roles().stream().findFirst().orElse("OWNER"),
            "PAYMENT_CHECKOUT_INITIATED", "BILLING_INVOICE", invoiceId,
            "Initiated " + provider + " checkout for " + amount + " FCFA (ref " + extRef + ")"
        );

        return Map.of(
            "id", txId,
            "invoiceId", invoiceId,
            "provider", provider,
            "externalRef", extRef,
            "amountFcfa", amount,
            "status", "PENDING",
            "checkoutUrl", checkoutUrl
        );
    }

    @PostMapping("/api/v1/public/webhooks/payments/{provider}")
    @Transactional
    public Map<String, Object> handlePaymentWebhook(
        @PathVariable String provider,
        @RequestHeader(value = "X-OpesFuel-Signature", required = false) String signature,
        @Valid @RequestBody PaymentWebhookPayload payload
    ) {
        if (webhookSecret != null && !webhookSecret.isBlank() && signature != null && !signature.isBlank()) {
            String expected = hmacSha256(payload.externalRef() + ":" + payload.status(), webhookSecret);
            if (!expected.equalsIgnoreCase(signature.trim())) {
                throw new IllegalArgumentException("Invalid payment webhook HMAC signature.");
            }
        }

        Map<String, Object> tx = jdbcTemplate.queryForMap(
            "SELECT id, tenant_id, invoice_id, amount_fcfa, status FROM payment_transactions WHERE external_ref = ?",
            payload.externalRef()
        );
        String txId = String.valueOf(tx.get("id"));
        String tenantId = String.valueOf(tx.get("tenant_id"));
        String invoiceId = String.valueOf(tx.get("invoice_id"));
        String currentStatus = String.valueOf(tx.get("status"));
        long amount = ((Number) tx.get("amount_fcfa")).longValue();

        // T017: Idempotency & state-machine protection against duplicate or out-of-order webhooks after settlement
        if ("PAID".equalsIgnoreCase(currentStatus)) {
            return Map.of(
                "acknowledged", true,
                "idempotentReplay", true,
                "externalRef", payload.externalRef(),
                "status", "PAID",
                "invoiceId", invoiceId
            );
        }

        // T016: Pending/processing provider callbacks must never mark an invoice PAID
        if ("PENDING".equalsIgnoreCase(payload.status()) || "PROCESSING".equalsIgnoreCase(payload.status())) {
            return Map.of(
                "acknowledged", true,
                "idempotentReplay", false,
                "externalRef", payload.externalRef(),
                "status", "PENDING",
                "invoiceId", invoiceId
            );
        }

        String newStatus = "PAID".equalsIgnoreCase(payload.status()) || "SUCCESS".equalsIgnoreCase(payload.status())
            ? "PAID" : "FAILED";

        jdbcTemplate.update(
            "UPDATE payment_transactions SET status = ?, completed_at = ? WHERE id = ?",
            newStatus, Timestamp.from(Instant.now()), txId
        );

        if ("PAID".equals(newStatus)) {
            jdbcTemplate.update(
                "UPDATE billing_invoices SET status = 'PAID', paid_at = ? WHERE id = ?",
                Timestamp.from(Instant.now()), invoiceId
            );
            jdbcTemplate.update("UPDATE tenants SET status = 'ACTIVE' WHERE id = ?", tenantId);
            auditRecorder.record(
                tenantId, null, "webhook@" + provider.toLowerCase(), "PAYMENT_GATEWAY",
                "INVOICE_AUTO_SETTLED", "BILLING_INVOICE", invoiceId,
                "Auto-settled invoice " + invoiceId + " (" + amount + " FCFA) via " + provider.toUpperCase()
            );
        }

        return Map.of("acknowledged", true, "idempotentReplay", false, "externalRef", payload.externalRef(), "status", newStatus, "invoiceId", invoiceId);
    }

    private String hmacSha256(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("HMAC calculation failed", e);
        }
    }
}
