package com.opesware.opesfuel.billing.momo;

import com.opesware.opesfuel.billing.MomoPaymentApi;
import com.opesware.opesfuel.billing.MomoRuntimeConfigApi;
import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MomoGatewayService implements MomoPaymentApi, MomoRuntimeConfigApi {

    private static final Logger log = LoggerFactory.getLogger(MomoGatewayService.class);

    private final JdbcTemplate jdbcTemplate;
    private final MomoProperties props;
    private final MtnMomoClient mtnClient;
    private final OrangeMoneyClient orangeClient;
    private final AuditTrailRecorder auditRecorder;

    public MomoGatewayService(
        JdbcTemplate jdbcTemplate,
        MomoProperties props,
        MtnMomoClient mtnClient,
        OrangeMoneyClient orangeClient,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.props = props;
        this.mtnClient = mtnClient;
        this.orangeClient = orangeClient;
        this.auditRecorder = auditRecorder;
    }

    public Map<String, Object> providerStatus() {
        return Map.of(
            "mtnMomo", Map.of(
                "configured", props.getMtn().isConfigured(),
                "disbursementConfigured", props.getMtn().isDisbursementConfigured(),
                "environment", props.getMtn().getTargetEnvironment(),
                "currency", props.getMtn().resolveCurrency()
            ),
            "orangeMoney", Map.of(
                "configured", props.getOrange().isConfigured(),
                "environment", props.getOrange().getEnvironment(),
                "currency", props.getOrange().resolveCurrency()
            )
        );
    }

    @Override
    public synchronized void applyMtnConfig(Map<String, String> cfg) {
        if (cfg == null) return;
        MomoProperties.Mtn m = props.getMtn();
        if (cfg.containsKey("baseUrl")) m.setBaseUrl(cfg.getOrDefault("baseUrl", ""));
        if (cfg.containsKey("targetEnvironment")) m.setTargetEnvironment(cfg.getOrDefault("targetEnvironment", "sandbox"));
        if (cfg.containsKey("apiUser")) m.setApiUser(cfg.getOrDefault("apiUser", ""));
        if (cfg.containsKey("apiKey")) m.setApiKey(cfg.getOrDefault("apiKey", ""));
        if (cfg.containsKey("collectionSubscriptionKey")) m.setCollectionSubscriptionKey(cfg.getOrDefault("collectionSubscriptionKey", ""));
        if (cfg.containsKey("disbursementSubscriptionKey")) m.setDisbursementSubscriptionKey(cfg.getOrDefault("disbursementSubscriptionKey", ""));
        if (cfg.containsKey("callbackUrl")) m.setCallbackUrl(cfg.getOrDefault("callbackUrl", ""));
        mtnClient.clearTokenCache();
    }

    @Override
    public synchronized void applyOrangeConfig(Map<String, String> cfg) {
        if (cfg == null) return;
        MomoProperties.Orange o = props.getOrange();
        if (cfg.containsKey("baseUrl")) o.setBaseUrl(cfg.getOrDefault("baseUrl", "https://api.orange.com"));
        if (cfg.containsKey("environment")) o.setEnvironment(cfg.getOrDefault("environment", "dev"));
        if (cfg.containsKey("clientId")) o.setClientId(cfg.getOrDefault("clientId", ""));
        if (cfg.containsKey("clientSecret")) o.setClientSecret(cfg.getOrDefault("clientSecret", ""));
        if (cfg.containsKey("merchantKey")) o.setMerchantKey(cfg.getOrDefault("merchantKey", ""));
        if (cfg.containsKey("returnUrl")) o.setReturnUrl(cfg.getOrDefault("returnUrl", ""));
        if (cfg.containsKey("cancelUrl")) o.setCancelUrl(cfg.getOrDefault("cancelUrl", ""));
        if (cfg.containsKey("notifUrl")) o.setNotifUrl(cfg.getOrDefault("notifUrl", ""));
        if (cfg.containsKey("lang")) o.setLang(cfg.getOrDefault("lang", "fr"));
        orangeClient.clearTokenCache();
    }

    @Override
    public Map<String, Object> testMtnConnection() {
        String msg = mtnClient.verifyCollectionAuth();
        return Map.of("ok", true, "message", msg);
    }

    @Override
    public Map<String, Object> testOrangeConnection() {
        String msg = orangeClient.verifyOAuthHandshake();
        return Map.of("ok", true, "message", msg);
    }

    @Transactional
    public Map<String, Object> initiatePayment(
        String tenantId,
        String actor,
        String targetType,
        String targetId,
        long amountFcfa,
        String rawPhone,
        String requestedProvider,
        String description,
        String idempotencyKey
    ) {
        if (amountFcfa < 100) {
            throw new IllegalArgumentException("Mobile Money amount must be at least 100 FCFA.");
        }
        String normalizedMsisdn = CameroonMsisdn.normalize(rawPhone);
        CameroonMsisdn.Operator detected = CameroonMsisdn.detect(normalizedMsisdn);
        String provider = resolveProvider(requestedProvider, detected);

        if (idempotencyKey != null && !idempotencyKey.isBlank()) {
            List<Map<String, Object>> existing = jdbcTemplate.queryForList(
                "SELECT * FROM momo_transactions WHERE tenant_id = ? AND idempotency_key = ?",
                tenantId, idempotencyKey.trim()
            );
            if (!existing.isEmpty()) {
                return toDto(existing.get(0), true);
            }
        }

        String resolvedTargetType = (targetType == null || targetType.isBlank()) ? "SAAS_INVOICE" : targetType.trim().toUpperCase();
        String txId = "momo_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
        String referenceId = UUID.randomUUID().toString();
        String externalId = "OPF-" + resolvedTargetType.substring(0, Math.min(3, resolvedTargetType.length()))
            + "-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();

        String environment;
        String apiCurrency;
        String payToken = null;
        String notifToken = null;
        String paymentUrl = null;

        if ("MTN_MOMO".equals(provider)) {
            environment = props.getMtn().getTargetEnvironment();
            apiCurrency = props.getMtn().resolveCurrency();
            mtnClient.requestToPay(
                referenceId,
                externalId,
                amountFcfa,
                normalizedMsisdn,
                description != null ? description : "OpesFuel payment " + targetId,
                externalId
            );
        } else {
            environment = props.getOrange().getEnvironment();
            apiCurrency = props.getOrange().resolveCurrency();
            OrangeMoneyClient.OrangeInitResponse init = orangeClient.initiateWebPayment(
                externalId,
                amountFcfa,
                description != null ? description : "OpesFuel " + targetId
            );
            payToken = init.payToken();
            notifToken = init.notifToken();
            paymentUrl = init.paymentUrl();
        }

        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(Math.max(300L, props.getTxExpiryMinutes() * 60L));

        jdbcTemplate.update(
            """
            INSERT INTO momo_transactions (
                id, tenant_id, target_type, target_id, provider, environment, msisdn, amount_fcfa,
                api_currency, external_id, reference_id, pay_token, notif_token, payment_url,
                status, idempotency_key, created_by, created_at, updated_at, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)
            """,
            txId, tenantId, resolvedTargetType, targetId, provider, environment, normalizedMsisdn, amountFcfa,
            apiCurrency, externalId, referenceId, payToken, notifToken, paymentUrl,
            (idempotencyKey != null && !idempotencyKey.isBlank()) ? idempotencyKey.trim() : null,
            actor, Timestamp.from(now), Timestamp.from(now), Timestamp.from(expiresAt)
        );

        auditRecorder.record(
            tenantId, null, actor, "PAYMENT_INITIATOR",
            "MOMO_PAYMENT_INITIATED", resolvedTargetType, targetId,
            "Initiated " + provider + " (" + amountFcfa + " FCFA) for +" + normalizedMsisdn + " ref=" + referenceId
        );

        Map<String, Object> row = jdbcTemplate.queryForMap("SELECT * FROM momo_transactions WHERE id = ?", txId);
        return toDto(row, false);
    }

    @Transactional
    public Map<String, Object> pollAndRefreshStatus(String txId, String tenantId, boolean isPlatformAdmin) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT * FROM momo_transactions WHERE id = ?", txId);
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Mobile Money transaction not found: " + txId);
        }
        Map<String, Object> row = rows.get(0);
        if (!isPlatformAdmin && !tenantId.equals(String.valueOf(row.get("tenant_id")))) {
            throw new org.springframework.security.access.AccessDeniedException("Transaction belongs to another tenant.");
        }
        String status = String.valueOf(row.get("status"));
        if (!"PENDING".equals(status)) {
            return toDto(row, false);
        }

        String provider = String.valueOf(row.get("provider"));
        if ("MTN_MOMO".equals(provider) && props.getMtn().isConfigured()) {
            MtnMomoClient.MtnTxStatus st = mtnClient.getRequestToPayStatus(String.valueOf(row.get("reference_id")));
            String mapped = normalizeProviderStatus(st.status());
            if (!"PENDING".equals(mapped)) {
                transitionAndSettle(row, mapped, st.financialTransactionId(), st.reason());
            }
        } else if ("ORANGE_MONEY".equals(provider) && props.getOrange().isConfigured() && row.get("pay_token") != null) {
            OrangeMoneyClient.OrangeTxStatus st = orangeClient.checkTransactionStatus(
                String.valueOf(row.get("external_id")),
                ((Number) row.get("amount_fcfa")).longValue(),
                String.valueOf(row.get("pay_token"))
            );
            String mapped = normalizeProviderStatus(st.status());
            if (!"PENDING".equals(mapped)) {
                transitionAndSettle(row, mapped, st.txnid(), "FAILED".equals(mapped) ? st.status() : null);
            }
        }

        // Check expiration if still pending
        Map<String, Object> refreshed = jdbcTemplate.queryForMap("SELECT * FROM momo_transactions WHERE id = ?", txId);
        if ("PENDING".equals(String.valueOf(refreshed.get("status")))
            && refreshed.get("expires_at") instanceof Timestamp exp
            && Instant.now().isAfter(exp.toInstant())) {
            transitionAndSettle(refreshed, "EXPIRED", null, "Customer approval window timed out");
            refreshed = jdbcTemplate.queryForMap("SELECT * FROM momo_transactions WHERE id = ?", txId);
        }
        return toDto(refreshed, false);
    }

    @Transactional
    public Map<String, Object> handleMtnCallback(Map<String, Object> payload) {
        String refId = firstNonBlank(payload, "referenceId", "X-Reference-Id", "externalId");
        if (refId == null) {
            throw new IllegalArgumentException("MTN callback missing referenceId or externalId.");
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT * FROM momo_transactions WHERE reference_id = ? OR external_id = ?",
            refId, refId
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Unknown MTN MoMo transaction reference: " + refId);
        }
        Map<String, Object> row = rows.get(0);
        if (!"PENDING".equals(String.valueOf(row.get("status")))) {
            return Map.of("acknowledged", true, "idempotentReplay", true, "status", row.get("status"));
        }

        // Production hardening: when MTN credentials are configured, re-verify status server-to-server!
        String resolvedStatus;
        String finTxId = firstNonBlank(payload, "financialTransactionId");
        String reason = firstNonBlank(payload, "reason");
        if (props.getMtn().isConfigured()) {
            MtnMomoClient.MtnTxStatus verified = mtnClient.getRequestToPayStatus(String.valueOf(row.get("reference_id")));
            resolvedStatus = normalizeProviderStatus(verified.status());
            if (verified.financialTransactionId() != null) finTxId = verified.financialTransactionId();
            if (verified.reason() != null) reason = verified.reason();
        } else {
            resolvedStatus = normalizeProviderStatus(firstNonBlank(payload, "status"));
        }

        if (!"PENDING".equals(resolvedStatus)) {
            transitionAndSettle(row, resolvedStatus, finTxId, reason);
        }
        return Map.of("acknowledged", true, "idempotentReplay", false, "txId", row.get("id"), "status", resolvedStatus);
    }

    @Transactional
    public Map<String, Object> handleOrangeCallback(Map<String, Object> payload) {
        String notifToken = firstNonBlank(payload, "notif_token");
        String rawStatus = firstNonBlank(payload, "status");
        String txnid = firstNonBlank(payload, "txnid");
        if (notifToken == null) {
            throw new IllegalArgumentException("Orange Money callback missing notif_token.");
        }
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT * FROM momo_transactions WHERE notif_token = ?",
            notifToken
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Orange Money notif_token.");
        }
        Map<String, Object> row = rows.get(0);
        if (!"PENDING".equals(String.valueOf(row.get("status")))) {
            return Map.of("acknowledged", true, "idempotentReplay", true, "status", row.get("status"));
        }

        String mapped = normalizeProviderStatus(rawStatus);
        // Double-check against Orange transactionstatus API when configured
        if (props.getOrange().isConfigured() && row.get("pay_token") != null && "SUCCESSFUL".equals(mapped)) {
            OrangeMoneyClient.OrangeTxStatus verified = orangeClient.checkTransactionStatus(
                String.valueOf(row.get("external_id")),
                ((Number) row.get("amount_fcfa")).longValue(),
                String.valueOf(row.get("pay_token"))
            );
            mapped = normalizeProviderStatus(verified.status());
            if (verified.txnid() != null) txnid = verified.txnid();
        }

        if (!"PENDING".equals(mapped)) {
            transitionAndSettle(row, mapped, txnid, "FAILED".equals(mapped) ? rawStatus : null);
        }
        return Map.of("acknowledged", true, "idempotentReplay", false, "txId", row.get("id"), "status", mapped);
    }

    @Transactional
    public Map<String, Object> refundMtnTransaction(String txId, String tenantId, String actor) {
        Map<String, Object> row = jdbcTemplate.queryForMap("SELECT * FROM momo_transactions WHERE id = ?", txId);
        if (!tenantId.equals(String.valueOf(row.get("tenant_id")))) {
            throw new org.springframework.security.access.AccessDeniedException("Transaction belongs to another tenant.");
        }
        if (!"MTN_MOMO".equals(String.valueOf(row.get("provider")))) {
            throw new IllegalArgumentException("Automated refund disbursement is supported for MTN_MOMO transactions.");
        }
        if (!"SUCCESSFUL".equals(String.valueOf(row.get("status")))) {
            throw new IllegalStateException("Only SUCCESSFUL transactions can be refunded.");
        }
        String refundRef = UUID.randomUUID().toString();
        long amount = ((Number) row.get("amount_fcfa")).longValue();
        String msisdn = String.valueOf(row.get("msisdn"));
        mtnClient.disburseTransfer(refundRef, "REF-" + row.get("external_id"), amount, msisdn, "Refund " + txId);
        auditRecorder.record(tenantId, null, actor, "OWNER", "MOMO_REFUND_DISBURSED", "MOMO_TX", txId,
            "Disbursed MTN MoMo refund of " + amount + " FCFA to +" + msisdn + " ref=" + refundRef);
        return Map.of("txId", txId, "refundReferenceId", refundRef, "amountFcfa", amount, "status", "REFUND_INITIATED");
    }

    public List<Map<String, Object>> listTransactions(String tenantId, boolean allTenants) {
        List<Map<String, Object>> rows = allTenants
            ? jdbcTemplate.queryForList("SELECT * FROM momo_transactions ORDER BY created_at DESC LIMIT 200")
            : jdbcTemplate.queryForList("SELECT * FROM momo_transactions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100", tenantId);
        return rows.stream().map(r -> toDto(r, false)).toList();
    }

    @Scheduled(fixedDelayString = "${opesfuel.momo.reconcile-interval-ms:60000}")
    public void reconcileStalePendingTransactions() {
        if (!props.isReconcileEnabled()) return;
        try {
            List<Map<String, Object>> pending = jdbcTemplate.queryForList(
                "SELECT id, tenant_id FROM momo_transactions WHERE status = 'PENDING' LIMIT 50"
            );
            for (Map<String, Object> row : pending) {
                try {
                    pollAndRefreshStatus(String.valueOf(row.get("id")), String.valueOf(row.get("tenant_id")), true);
                } catch (Exception ex) {
                    log.debug("MoMo reconciliation skipped for {}: {}", row.get("id"), ex.getMessage());
                }
            }
        } catch (Exception ex) {
            log.debug("MoMo reconciliation query skipped: {}", ex.getMessage());
        }
    }

    private void transitionAndSettle(Map<String, Object> row, String nextStatus, String providerTxId, String reason) {
        String txId = String.valueOf(row.get("id"));
        Timestamp now = Timestamp.from(Instant.now());
        int updated = jdbcTemplate.update(
            """
            UPDATE momo_transactions
            SET status = ?, provider_tx_id = COALESCE(?, provider_tx_id),
                failure_reason = COALESCE(?, failure_reason),
                updated_at = ?, settled_at = CASE WHEN ? = 'SUCCESSFUL' THEN ? ELSE settled_at END
            WHERE id = ? AND status = 'PENDING'
            """,
            nextStatus, providerTxId, reason, now, nextStatus, now, txId
        );
        if (updated == 0) return; // Already transitioned by concurrent callback/poll

        if (!"SUCCESSFUL".equals(nextStatus)) return;

        String tenantId = String.valueOf(row.get("tenant_id"));
        String targetType = String.valueOf(row.get("target_type"));
        String targetId = String.valueOf(row.get("target_id"));
        long amount = ((Number) row.get("amount_fcfa")).longValue();
        String provider = String.valueOf(row.get("provider"));

        if ("SAAS_INVOICE".equals(targetType)) {
            jdbcTemplate.update(
                "UPDATE billing_invoices SET status = 'PAID', paid_at = ? WHERE id = ? AND tenant_id = ?",
                now, targetId, tenantId
            );
            jdbcTemplate.update("UPDATE tenants SET status = 'ACTIVE' WHERE id = ?", tenantId);
        } else if ("FLEET_BALANCE".equals(targetType)) {
            jdbcTemplate.update(
                """
                UPDATE fleet_accounts
                SET balance_owed_fcfa = CASE WHEN balance_owed_fcfa >= ? THEN balance_owed_fcfa - ? ELSE 0 END
                WHERE id = ? AND tenant_id = ?
                """,
                amount, amount, targetId, tenantId
            );
        }

        auditRecorder.record(
            tenantId, null, "momo-gateway@" + provider.toLowerCase(), "PAYMENT_GATEWAY",
            "MOMO_PAYMENT_SETTLED", targetType, targetId,
            "Settled " + amount + " FCFA via " + provider + " (providerTxId=" + providerTxId + ")"
        );
    }

    private static String resolveProvider(String requested, CameroonMsisdn.Operator detected) {
        if (requested != null && !requested.isBlank() && !"AUTO".equalsIgnoreCase(requested.trim())) {
            String p = requested.trim().toUpperCase();
            if ("MTN".equals(p) || "MTN_MOMO".equals(p)) return "MTN_MOMO";
            if ("ORANGE".equals(p) || "ORANGE_MONEY".equals(p)) return "ORANGE_MONEY";
            throw new IllegalArgumentException("Unsupported Mobile Money provider: " + requested);
        }
        return switch (detected) {
            case MTN -> "MTN_MOMO";
            case ORANGE -> "ORANGE_MONEY";
            case UNKNOWN -> throw new IllegalArgumentException(
                "Unable to auto-detect Cameroon Mobile Money operator from phone prefix. Specify provider MTN_MOMO or ORANGE_MONEY."
            );
        };
    }

    private static String normalizeProviderStatus(String raw) {
        if (raw == null) return "PENDING";
        return switch (raw.trim().toUpperCase()) {
            case "SUCCESSFUL", "SUCCESS", "PAID" -> "SUCCESSFUL";
            case "FAILED", "REJECTED", "CANCELLED", "CANCELED" -> "FAILED";
            case "EXPIRED", "TIMEOUT" -> "EXPIRED";
            default -> "PENDING";
        };
    }

    private static String firstNonBlank(Map<String, Object> map, String... keys) {
        if (map == null) return null;
        for (String k : keys) {
            Object v = map.get(k);
            if (v != null && !String.valueOf(v).isBlank()) return String.valueOf(v).trim();
        }
        return null;
    }

    private Map<String, Object> toDto(Map<String, Object> r, boolean replayed) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", r.get("id"));
        out.put("tenantId", r.get("tenant_id"));
        out.put("targetType", r.get("target_type"));
        out.put("targetId", r.get("target_id"));
        out.put("provider", r.get("provider"));
        out.put("environment", r.get("environment"));
        out.put("msisdn", "+" + r.get("msisdn"));
        out.put("amountFcfa", ((Number) r.get("amount_fcfa")).longValue());
        out.put("apiCurrency", r.get("api_currency"));
        out.put("externalId", r.get("external_id"));
        out.put("referenceId", r.get("reference_id"));
        out.put("paymentUrl", r.get("payment_url"));
        out.put("providerTxId", r.get("provider_tx_id"));
        out.put("status", r.get("status"));
        out.put("failureReason", r.get("failure_reason"));
        out.put("ussdPromptSent", "MTN_MOMO".equals(String.valueOf(r.get("provider"))));
        out.put("idempotentReplay", replayed);
        out.put("createdAt", r.get("created_at") instanceof Timestamp ts ? ts.toInstant().toString() : String.valueOf(r.get("created_at")));
        out.put("expiresAt", r.get("expires_at") instanceof Timestamp ts ? ts.toInstant().toString() : String.valueOf(r.get("expires_at")));
        out.put("settledAt", r.get("settled_at") instanceof Timestamp ts ? ts.toInstant().toString() : null);
        return out;
    }
}
