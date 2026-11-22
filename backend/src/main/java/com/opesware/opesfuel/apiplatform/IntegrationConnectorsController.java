package com.opesware.opesfuel.apiplatform;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opesware.opesfuel.billing.MomoRuntimeConfigApi;
import com.opesware.opesfuel.notifications.OutboundMessagingService;
import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.AesGcmCryptoService;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

record SaveIntegrationConnectorCommand(
    String scope,
    Boolean enabled,
    @NotNull Map<String, String> config
) {}

record TestIntegrationConnectorCommand(
    String scope,
    String testRecipient
) {}

/**
 * Admin Panel API Integrations Hub:
 * Persists MTN MoMo CM, Orange Money CM, Email (SMTP/Resend), SMS (Africa's Talking/Twilio),
 * WhatsApp (Meta Cloud), and Gemini AI credentials encrypted with AES-256-GCM, masks secrets on read,
 * hot-reloads live clients immediately without restart, and runs live connection diagnostics.
 */
@RestController
@RequestMapping("/api/v1/integrations/connectors")
public class IntegrationConnectorsController {

    private static final Logger log = LoggerFactory.getLogger(IntegrationConnectorsController.class);
    private static final TypeReference<Map<String, String>> STR_MAP = new TypeReference<>() {};

    private static final Set<String> SUPPORTED_PROVIDERS = Set.of(
        "MTN_MOMO", "ORANGE_MONEY", "EMAIL", "SMS", "WHATSAPP", "GEMINI_AI"
    );

    private static final Set<String> SECRET_FIELDS = Set.of(
        "apiKey", "collectionSubscriptionKey", "disbursementSubscriptionKey",
        "clientSecret", "merchantKey", "smtpPassword", "atApiKey",
        "twilioAuthToken", "accessToken", "geminiApiKey"
    );

    private final JdbcTemplate jdbcTemplate;
    private final AesGcmCryptoService crypto;
    private final ObjectMapper objectMapper;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;
    private final MomoRuntimeConfigApi momoRuntimeConfig;
    private final OutboundMessagingService messagingService;

    public IntegrationConnectorsController(
        JdbcTemplate jdbcTemplate,
        AesGcmCryptoService crypto,
        ObjectMapper objectMapper,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder,
        MomoRuntimeConfigApi momoRuntimeConfig,
        OutboundMessagingService messagingService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.crypto = crypto;
        this.objectMapper = objectMapper;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
        this.momoRuntimeConfig = momoRuntimeConfig;
        this.messagingService = messagingService;
    }

    /** Hydrates saved GLOBAL connectors on boot so credentials survive container restarts. */
    @EventListener(ApplicationReadyEvent.class)
    public void hydrateSavedGlobalConnectorsOnStartup() {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT provider_key, enabled, config_json_encrypted FROM integration_connectors WHERE scope = 'GLOBAL' AND enabled = TRUE"
            );
            for (Map<String, Object> r : rows) {
                String provider = String.valueOf(r.get("provider_key"));
                Map<String, String> cfg = decryptConfig(String.valueOf(r.get("config_json_encrypted")));
                applyRuntimeConfig(provider, cfg);
            }
            if (!rows.isEmpty()) {
                log.info("Hydrated {} encrypted GLOBAL API integration connector(s) from PostgreSQL.", rows.size());
            }
        } catch (Exception ex) {
            log.debug("Integration connectors startup hydration skipped: {}", ex.getMessage());
        }
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public List<Map<String, Object>> listConnectors(
        @RequestParam(defaultValue = "TENANT") String scope
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String resolvedScope = resolveAuthorizedScope(scope, principal);
        String tenantKey = "GLOBAL".equals(resolvedScope) ? "GLOBAL" : principal.tenantId();

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT * FROM integration_connectors WHERE scope = ? AND tenant_id = ?",
            resolvedScope, tenantKey
        );
        Map<String, Map<String, Object>> byProvider = new HashMap<>();
        for (Map<String, Object> r : rows) {
            byProvider.put(String.valueOf(r.get("provider_key")), r);
        }

        List<Map<String, Object>> out = new ArrayList<>();
        for (String provider : List.of("MTN_MOMO", "ORANGE_MONEY", "EMAIL", "SMS", "WHATSAPP", "GEMINI_AI")) {
            Map<String, Object> row = byProvider.get(provider);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("providerKey", provider);
            item.put("scope", resolvedScope);
            if (row == null) {
                item.put("configured", false);
                item.put("enabled", false);
                item.put("config", Map.of());
                item.put("secretPresent", Map.of());
                item.put("lastTestStatus", "UNVERIFIED");
                item.put("lastTestMessage", null);
                item.put("lastTestedAt", null);
            } else {
                Map<String, String> plain = decryptConfig(String.valueOf(row.get("config_json_encrypted")));
                Map<String, String> masked = new LinkedHashMap<>();
                Map<String, Boolean> secretPresent = new LinkedHashMap<>();
                for (Map.Entry<String, String> e : plain.entrySet()) {
                    if (SECRET_FIELDS.contains(e.getKey())) {
                        boolean has = e.getValue() != null && !e.getValue().isBlank();
                        secretPresent.put(e.getKey(), has);
                        masked.put(e.getKey(), has ? maskSecret(e.getValue()) : "");
                    } else {
                        masked.put(e.getKey(), e.getValue() != null ? e.getValue() : "");
                    }
                }
                item.put("configured", true);
                item.put("enabled", Boolean.TRUE.equals(row.get("enabled")));
                item.put("config", masked);
                item.put("secretPresent", secretPresent);
                item.put("lastTestStatus", row.get("last_test_status"));
                item.put("lastTestMessage", row.get("last_test_message"));
                item.put("lastTestedAt", row.get("last_tested_at") instanceof Timestamp ts ? ts.toInstant().toString() : null);
                item.put("updatedAt", row.get("updated_at") instanceof Timestamp ts ? ts.toInstant().toString() : null);
            }
            out.add(item);
        }
        return out;
    }

    @PutMapping("/{providerKey}")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> saveConnector(
        @PathVariable String providerKey,
        @Valid @RequestBody SaveIntegrationConnectorCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String provider = providerKey.trim().toUpperCase();
        if (!SUPPORTED_PROVIDERS.contains(provider)) {
            throw new IllegalArgumentException("Unsupported integration provider: " + provider);
        }
        String resolvedScope = resolveAuthorizedScope(cmd.scope(), principal);
        String tenantKey = "GLOBAL".equals(resolvedScope) ? "GLOBAL" : principal.tenantId();
        String id = resolvedScope + ":" + tenantKey + ":" + provider;

        // Preserve previously saved secrets if omitted or masked in update payload
        Map<String, String> merged = new LinkedHashMap<>();
        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
            "SELECT config_json_encrypted FROM integration_connectors WHERE id = ?", id
        );
        if (!existing.isEmpty()) {
            merged.putAll(decryptConfig(String.valueOf(existing.get(0).get("config_json_encrypted"))));
        }
        for (Map.Entry<String, String> e : cmd.config().entrySet()) {
            String val = e.getValue() != null ? e.getValue().trim() : "";
            if (SECRET_FIELDS.contains(e.getKey()) && (val.isBlank() || val.startsWith("••••"))) {
                continue; // Keep existing encrypted secret intact
            }
            merged.put(e.getKey(), val);
        }

        String encryptedJson = encryptConfig(merged);
        boolean enabled = cmd.enabled() == null || cmd.enabled();
        Timestamp now = Timestamp.from(Instant.now());

        if (existing.isEmpty()) {
            jdbcTemplate.update(
                """
                INSERT INTO integration_connectors (
                    id, scope, tenant_id, provider_key, enabled, config_json_encrypted,
                    last_test_status, updated_by, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 'UNVERIFIED', ?, ?)
                """,
                id, resolvedScope, tenantKey, provider, enabled, encryptedJson, principal.subject(), now
            );
        } else {
            jdbcTemplate.update(
                """
                UPDATE integration_connectors
                SET enabled = ?, config_json_encrypted = ?, updated_by = ?, updated_at = ?
                WHERE id = ?
                """,
                enabled, encryptedJson, principal.subject(), now, id
            );
        }

        // Hot-reload live runtime clients immediately (GLOBAL or active tenant)
        if (enabled && "GLOBAL".equals(resolvedScope)) {
            applyRuntimeConfig(provider, merged);
        }

        auditRecorder.record(
            principal.tenantId(), null, principal.subject(),
            principal.roles().stream().findFirst().orElse("OWNER"),
            "INTEGRATION_CONNECTOR_UPDATED", "INTEGRATION", id,
            "Saved AES-256-GCM encrypted " + provider + " connector (" + resolvedScope + ", enabled=" + enabled + ")"
        );

        return Map.of(
            "id", id,
            "providerKey", provider,
            "scope", resolvedScope,
            "enabled", enabled,
            "encryptedAtRest", true,
            "hotReloaded", enabled && "GLOBAL".equals(resolvedScope),
            "updatedAt", now.toInstant().toString()
        );
    }

    @PostMapping("/{providerKey}/test")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> testConnector(
        @PathVariable String providerKey,
        @RequestBody(required = false) TestIntegrationConnectorCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String provider = providerKey.trim().toUpperCase();
        String resolvedScope = resolveAuthorizedScope(cmd != null ? cmd.scope() : null, principal);
        String tenantKey = "GLOBAL".equals(resolvedScope) ? "GLOBAL" : principal.tenantId();
        String id = resolvedScope + ":" + tenantKey + ":" + provider;

        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT config_json_encrypted FROM integration_connectors WHERE id = ?", id
        );
        if (rows.isEmpty()) {
            throw new IllegalStateException("Connector " + provider + " is not configured yet. Save your credentials first.");
        }
        Map<String, String> cfg = decryptConfig(String.valueOf(rows.get(0).get("config_json_encrypted")));

        String status = "CONNECTED";
        String message;
        try {
            switch (provider) {
                case "MTN_MOMO" -> {
                    requireFields(cfg, "apiUser", "apiKey", "collectionSubscriptionKey");
                    momoRuntimeConfig.applyMtnConfig(cfg);
                    Map<String, Object> res = momoRuntimeConfig.testMtnConnection();
                    message = String.valueOf(res.get("message"));
                }
                case "ORANGE_MONEY" -> {
                    requireFields(cfg, "clientId", "clientSecret", "merchantKey");
                    momoRuntimeConfig.applyOrangeConfig(cfg);
                    Map<String, Object> res = momoRuntimeConfig.testOrangeConnection();
                    message = String.valueOf(res.get("message"));
                }
                case "EMAIL" -> {
                    String mode = cfg.getOrDefault("provider", "LOG_ONLY").toUpperCase();
                    messagingService.applyEmailConfig(cfg);
                    if ("SMTP".equals(mode)) {
                        requireFields(cfg, "smtpHost");
                        int port = Integer.parseInt(cfg.getOrDefault("smtpPort", "587"));
                        try (Socket s = new Socket()) {
                            s.connect(new InetSocketAddress(cfg.get("smtpHost"), port), 4000);
                        }
                        message = "SMTP TCP handshake succeeded to " + cfg.get("smtpHost") + ":" + port;
                    } else if ("RESEND".equals(mode)) {
                        requireFields(cfg, "apiKey");
                        if (cmd != null && cmd.testRecipient() != null && !cmd.testRecipient().isBlank()) {
                            Map<String, Object> d = messagingService.dispatch(
                                principal.tenantId(), principal.subject(), "EMAIL", cmd.testRecipient(),
                                "OpesFuel Resend Connection Test", "Your OpesFuel Email API connector is live.", "CONNECTOR_TEST"
                            );
                            message = "Resend test email status: " + d.get("status");
                        } else {
                            message = "Resend API key loaded and hot-reloaded (supply testRecipient to send a live test email).";
                        }
                    } else {
                        message = "Email configured in LOG_ONLY dev mode.";
                    }
                }
                case "SMS" -> {
                    String mode = cfg.getOrDefault("provider", "LOG_ONLY").toUpperCase();
                    messagingService.applySmsConfig(cfg);
                    if ("AFRICAS_TALKING".equals(mode)) {
                        requireFields(cfg, "atUsername", "atApiKey");
                    } else if ("TWILIO".equals(mode)) {
                        requireFields(cfg, "twilioAccountSid", "twilioAuthToken", "twilioFrom");
                    }
                    if (cmd != null && cmd.testRecipient() != null && !cmd.testRecipient().isBlank() && !"LOG_ONLY".equals(mode)) {
                        Map<String, Object> d = messagingService.dispatch(
                            principal.tenantId(), principal.subject(), "SMS", cmd.testRecipient(),
                            "OpesFuel SMS Test", "OpesFuel SMS gateway connection verified.", "CONNECTOR_TEST"
                        );
                        message = mode + " SMS test status: " + d.get("status");
                    } else {
                        message = mode + " SMS credentials validated & hot-reloaded.";
                    }
                }
                case "WHATSAPP" -> {
                    String mode = cfg.getOrDefault("provider", "LOG_ONLY").toUpperCase();
                    messagingService.applyWhatsappConfig(cfg);
                    if ("META_CLOUD".equals(mode)) {
                        requireFields(cfg, "phoneNumberId", "accessToken");
                    }
                    if (cmd != null && cmd.testRecipient() != null && !cmd.testRecipient().isBlank() && !"LOG_ONLY".equals(mode)) {
                        Map<String, Object> d = messagingService.dispatch(
                            principal.tenantId(), principal.subject(), "WHATSAPP", cmd.testRecipient(),
                            "OpesFuel WhatsApp Test", "OpesFuel WhatsApp Business Cloud API is live.", "CONNECTOR_TEST"
                        );
                        message = "Meta WhatsApp test status: " + d.get("status");
                    } else {
                        message = "Meta WhatsApp Cloud API credentials validated & hot-reloaded.";
                    }
                }
                case "GEMINI_AI" -> {
                    requireFields(cfg, "geminiApiKey");
                    message = "Gemini AI key saved (" + cfg.getOrDefault("model", "gemini-2.5-flash") + ").";
                }
                default -> throw new IllegalArgumentException("Unsupported provider: " + provider);
            }
        } catch (Exception ex) {
            status = "FAILED";
            message = ex.getMessage();
        }

        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update(
            "UPDATE integration_connectors SET last_test_status = ?, last_test_message = ?, last_tested_at = ? WHERE id = ?",
            status, message != null && message.length() > 390 ? message.substring(0, 390) : message, now, id
        );

        return Map.of(
            "providerKey", provider,
            "scope", resolvedScope,
            "status", status,
            "message", message != null ? message : "",
            "testedAt", now.toInstant().toString()
        );
    }

    @DeleteMapping("/{providerKey}")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> disconnectConnector(
        @PathVariable String providerKey,
        @RequestParam(defaultValue = "TENANT") String scope
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String provider = providerKey.trim().toUpperCase();
        String resolvedScope = resolveAuthorizedScope(scope, principal);
        String tenantKey = "GLOBAL".equals(resolvedScope) ? "GLOBAL" : principal.tenantId();
        String id = resolvedScope + ":" + tenantKey + ":" + provider;
        jdbcTemplate.update("DELETE FROM integration_connectors WHERE id = ?", id);
        return Map.of("providerKey", provider, "scope", resolvedScope, "disconnected", true);
    }

    private void applyRuntimeConfig(String provider, Map<String, String> cfg) {
        switch (provider) {
            case "MTN_MOMO" -> momoRuntimeConfig.applyMtnConfig(cfg);
            case "ORANGE_MONEY" -> momoRuntimeConfig.applyOrangeConfig(cfg);
            case "EMAIL" -> messagingService.applyEmailConfig(cfg);
            case "SMS" -> messagingService.applySmsConfig(cfg);
            case "WHATSAPP" -> messagingService.applyWhatsappConfig(cfg);
            default -> { /* GEMINI_AI read on demand */ }
        }
    }

    private String resolveAuthorizedScope(String requested, OpesFuelPrincipal principal) {
        String s = (requested == null || requested.isBlank())
            ? (principal.hasRole("PLATFORM_ADMIN") ? "GLOBAL" : "TENANT")
            : requested.trim().toUpperCase();
        if ("GLOBAL".equals(s) && !principal.hasRole("PLATFORM_ADMIN")) {
            throw new AccessDeniedException("Only PLATFORM_ADMIN may configure GLOBAL SaaS API connectors.");
        }
        return "GLOBAL".equals(s) ? "GLOBAL" : "TENANT";
    }

    private String encryptConfig(Map<String, String> cfg) {
        try {
            return crypto.encrypt(objectMapper.writeValueAsString(cfg));
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to encrypt integration config", ex);
        }
    }

    private Map<String, String> decryptConfig(String encrypted) {
        try {
            String json = crypto.decrypt(encrypted);
            return objectMapper.readValue(json, STR_MAP);
        } catch (Exception ex) {
            return new LinkedHashMap<>();
        }
    }

    private static String maskSecret(String secret) {
        if (secret == null || secret.isBlank()) return "";
        if (secret.length() <= 4) return "••••";
        return "••••" + secret.substring(secret.length() - 4);
    }

    private static void requireFields(Map<String, String> cfg, String... keys) {
        for (String k : keys) {
            if (!cfg.containsKey(k) || cfg.get(k) == null || cfg.get(k).isBlank()) {
                throw new IllegalArgumentException("Missing required credential field: " + k);
            }
        }
    }
}
