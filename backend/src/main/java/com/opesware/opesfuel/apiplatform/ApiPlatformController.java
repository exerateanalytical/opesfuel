package com.opesware.opesfuel.apiplatform;

import com.opesware.opesfuel.shared.events.DomainEvent.DemoLeadCapturedEvent;
import com.opesware.opesfuel.shared.events.OutboxQueryApi;
import com.opesware.opesfuel.shared.security.AesGcmCryptoService;
import com.opesware.opesfuel.shared.security.ApiKeyAuthFilter;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.persistence.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.InetAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

@Entity
@Table(name = "api_keys")
class ApiKeyEntity {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    static final Set<String> ALLOWED_SCOPES = Set.of(
        "stations:read", "stations:write",
        "forecourt:read", "forecourt:write",
        "inventory:read", "inventory:write",
        "fleet:read", "fleet:write",
        "shop:read", "shop:write",
        "workforce:read", "workforce:write",
        "accounting:read", "accounting:write",
        "ai:read", "ai:admin",
        "billing:read", "billing:write",
        "reporting:read", "notifications:read", "notifications:write",
        "events:read", "platform:admin"
    );

    @Id
    private String id;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId = TenantAccessGuard.DEFAULT_TENANT_ID;
    @Column(nullable = false)
    private String label;
    @Column(name = "key_prefix", nullable = false)
    private String keyPrefix;
    @Column(name = "key_hash", nullable = false)
    private String keyHash;
    @Column(name = "scopes_csv", nullable = false)
    private String scopesCsv;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static IssuedKey issue(String tenantId, String label, List<String> scopes) {
        List<String> normalized = new ArrayList<>();
        for (String s : scopes) {
            String trimmed = s != null ? s.trim() : "";
            if (!ALLOWED_SCOPES.contains(trimmed)) {
                throw new IllegalArgumentException("Invalid API key scope '" + s + "'. Allowed scopes: " + ALLOWED_SCOPES);
            }
            if (!normalized.contains(trimmed)) {
                normalized.add(trimmed);
            }
        }
        byte[] prefixBytes = new byte[4];
        byte[] secretBytes = new byte[24];
        SECURE_RANDOM.nextBytes(prefixBytes);
        SECURE_RANDOM.nextBytes(secretBytes);

        ApiKeyEntity k = new ApiKeyEntity();
        k.id = "key_" + UUID.randomUUID();
        k.tenantId = tenantId;
        k.label = label.trim();
        k.keyPrefix = "opf_live_" + HexFormat.of().formatHex(prefixBytes);
        String rawSecret = HexFormat.of().formatHex(secretBytes);
        String rawKey = k.keyPrefix + "_" + rawSecret;
        k.keyHash = ApiKeyAuthFilter.sha256(rawKey);
        k.scopesCsv = String.join(",", normalized);
        k.createdAt = Instant.now();
        return new IssuedKey(k, rawKey);
    }

    public record IssuedKey(ApiKeyEntity entity, String rawKey) {}

    public String getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getLabel() { return label; }
    public String getMaskedKey() { return keyPrefix + "_••••••••••••"; }
    public List<String> getScopes() { return List.of(scopesCsv.split(",")); }
    public Instant getCreatedAt() { return createdAt; }
}

@Entity
@Table(name = "webhook_subscriptions")
class WebhookEntity {
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Id
    private String id;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId = TenantAccessGuard.DEFAULT_TENANT_ID;
    @Column(name = "target_url", nullable = false, columnDefinition = "TEXT")
    private String targetUrl;
    @Column(name = "subscribed_events_csv", nullable = false, columnDefinition = "TEXT")
    private String subscribedEventsCsv;
    @Column(name = "hmac_secret_hash", nullable = false)
    private String encryptedSigningSecret;
    @Column(nullable = false)
    private boolean active = true;

    public static RegisteredWebhook register(String tenantId, String targetUrl, List<String> events, AesGcmCryptoService crypto) {
        byte[] secretBytes = new byte[32];
        SECURE_RANDOM.nextBytes(secretBytes);
        String rawSecret = "whsec_" + HexFormat.of().formatHex(secretBytes);

        WebhookEntity w = new WebhookEntity();
        w.id = "wh_" + UUID.randomUUID();
        w.tenantId = tenantId;
        w.targetUrl = targetUrl.trim();
        w.subscribedEventsCsv = String.join(",", events.stream().map(String::trim).filter(s -> !s.isEmpty()).distinct().toList());
        w.encryptedSigningSecret = crypto.encrypt(rawSecret);
        w.active = true;
        return new RegisteredWebhook(w, rawSecret);
    }

    public record RegisteredWebhook(WebhookEntity entity, String rawSigningSecret) {}

    public void toggleActive() { this.active = !this.active; }

    public boolean subscribesTo(String eventType) {
        for (String sub : subscribedEventsCsv.split(",")) {
            String trimmed = sub.trim();
            if ("*".equals(trimmed) || trimmed.equalsIgnoreCase(eventType)) {
                return true;
            }
        }
        return false;
    }

    String decryptSigningSecret(AesGcmCryptoService crypto) {
        return crypto.decrypt(encryptedSigningSecret);
    }

    public String getId() { return id; }
    public String getTargetUrl() { return targetUrl; }
    public List<String> getSubscribedEvents() { return List.of(subscribedEventsCsv.split(",")); }
    public boolean isActive() { return active; }
    public String getTenantId() { return tenantId; }
}

@Entity
@Table(name = "webhook_deliveries")
class WebhookDeliveryEntity {
    @Id
    private String id;
    @Column(name = "webhook_id", nullable = false)
    private String webhookId;
    @Column(name = "event_id", nullable = false)
    private String eventId;
    @Column(name = "event_type", nullable = false)
    private String eventType;
    @Column(name = "http_status")
    private Integer httpStatus;
    @Column(nullable = false)
    private boolean success;
    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;
    @Column(name = "duration_ms", nullable = false)
    private long durationMs;
    @Column(name = "attempted_at", nullable = false)
    private Instant attemptedAt;

    public static WebhookDeliveryEntity record(String webhookId, String eventId, String eventType, Integer status, boolean success, String error, long durationMs) {
        WebhookDeliveryEntity d = new WebhookDeliveryEntity();
        d.id = "whd_" + UUID.randomUUID();
        d.webhookId = webhookId;
        d.eventId = eventId;
        d.eventType = eventType;
        d.httpStatus = status;
        d.success = success;
        d.errorMessage = error != null && error.length() > 1000 ? error.substring(0, 1000) : error;
        d.durationMs = durationMs;
        d.attemptedAt = Instant.now();
        return d;
    }

    public String getId() { return id; }
    public String getWebhookId() { return webhookId; }
    public String getEventId() { return eventId; }
    public String getEventType() { return eventType; }
    public Integer getHttpStatus() { return httpStatus; }
    public boolean isSuccess() { return success; }
    public String getErrorMessage() { return errorMessage; }
    public long getDurationMs() { return durationMs; }
    public Instant getAttemptedAt() { return attemptedAt; }
}

@Entity
@Table(name = "demo_leads")
class DemoLeadEntity {
    @Id
    private String id;
    @Column(name = "reference_id", nullable = false, unique = true)
    private String referenceId;
    @Column(name = "full_name", nullable = false)
    private String fullName;
    @Column(name = "station_name", nullable = false)
    private String stationName;
    @Column(nullable = false)
    private String email;
    @Column(nullable = false)
    private String phone;
    @Column(name = "pump_count", nullable = false)
    private int pumpCount;
    @Column(name = "selected_plan")
    private String selectedPlan;
    @Column(nullable = false)
    private String status;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static DemoLeadEntity create(DemoLeadCommand cmd) {
        DemoLeadEntity lead = new DemoLeadEntity();
        lead.id = "lead_" + UUID.randomUUID();
        lead.referenceId = "LEAD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        lead.fullName = cmd.fullName().trim();
        lead.stationName = cmd.stationName().trim();
        lead.email = cmd.email().trim().toLowerCase();
        lead.phone = cmd.phone().trim();
        lead.pumpCount = cmd.pumpCount();
        lead.selectedPlan = cmd.selectedPlan() != null ? cmd.selectedPlan().trim() : null;
        lead.status = "RECEIVED";
        lead.createdAt = Instant.now();
        return lead;
    }

    public String getId() { return id; }
    public String getReferenceId() { return referenceId; }
    public String getFullName() { return fullName; }
    public String getStationName() { return stationName; }
    public String getEmail() { return email; }
    public int getPumpCount() { return pumpCount; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
}

interface ApiKeyRepository extends JpaRepository<ApiKeyEntity, String> {
    List<ApiKeyEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId);
}

interface WebhookRepository extends JpaRepository<WebhookEntity, String> {
    List<WebhookEntity> findByTenantId(String tenantId);
    List<WebhookEntity> findByTenantIdAndActiveTrue(String tenantId);
}

interface WebhookDeliveryRepository extends JpaRepository<WebhookDeliveryEntity, String> {
    List<WebhookDeliveryEntity> findByWebhookIdOrderByAttemptedAtDesc(String webhookId, PageRequest pageable);
}

interface DemoLeadRepository extends JpaRepository<DemoLeadEntity, String> {}

@Component
class WebhookUrlValidator {
    private final boolean allowPrivateTargets;

    WebhookUrlValidator(@Value("${opesfuel.webhooks.allow-private-targets:false}") boolean allowPrivateTargets) {
        this.allowPrivateTargets = allowPrivateTargets;
    }

    public void validate(String rawUrl) {
        URI uri;
        try {
            uri = URI.create(rawUrl.trim());
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid webhook targetUrl format.");
        }
        String scheme = uri.getScheme();
        if (scheme == null || (!"https".equalsIgnoreCase(scheme) && !(allowPrivateTargets && "http".equalsIgnoreCase(scheme)))) {
            throw new IllegalArgumentException("Webhook targetUrl must use HTTPS.");
        }
        String host = uri.getHost();
        if (host == null || host.isBlank()) {
            throw new IllegalArgumentException("Webhook targetUrl must specify a valid host.");
        }
        if (allowPrivateTargets) return;
        String lowerHost = host.toLowerCase();
        if ("localhost".equals(lowerHost) || lowerHost.endsWith(".local") || lowerHost.endsWith(".internal")) {
            throw new IllegalArgumentException("Webhook targetUrl cannot point to localhost or internal domains.");
        }
        try {
            InetAddress[] addresses = InetAddress.getAllByName(host);
            for (InetAddress addr : addresses) {
                if (addr.isAnyLocalAddress()
                    || addr.isLoopbackAddress()
                    || addr.isLinkLocalAddress()
                    || addr.isSiteLocalAddress()
                    || addr.isMulticastAddress()) {
                    throw new IllegalArgumentException("Webhook targetUrl resolves to a blocked private/internal IP address.");
                }
            }
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ignored) {
            // Re-validated at delivery time
        }
    }
}

@Service
class WebhookOutboxDispatcher {
    private static final Logger log = LoggerFactory.getLogger(WebhookOutboxDispatcher.class);

    private final OutboxQueryApi outboxQueryApi;
    private final WebhookRepository webhookRepository;
    private final WebhookDeliveryRepository deliveryRepository;
    private final WebhookUrlValidator urlValidator;
    private final AesGcmCryptoService cryptoService;
    private final RestClient restClient;
    private final boolean enabled;
    private final int maxRetries;

    WebhookOutboxDispatcher(
        OutboxQueryApi outboxQueryApi,
        WebhookRepository webhookRepository,
        WebhookDeliveryRepository deliveryRepository,
        WebhookUrlValidator urlValidator,
        AesGcmCryptoService cryptoService,
        @Value("${opesfuel.webhooks.enabled:true}") boolean enabled,
        @Value("${opesfuel.webhooks.max-retries:5}") int maxRetries,
        @Value("${opesfuel.webhooks.connect-timeout-ms:3000}") int connectTimeoutMs,
        @Value("${opesfuel.webhooks.read-timeout-ms:5000}") int readTimeoutMs
    ) {
        this.outboxQueryApi = outboxQueryApi;
        this.webhookRepository = webhookRepository;
        this.deliveryRepository = deliveryRepository;
        this.urlValidator = urlValidator;
        this.cryptoService = cryptoService;
        this.enabled = enabled;
        this.maxRetries = maxRetries;

        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(connectTimeoutMs);
        rf.setReadTimeout(readTimeoutMs);
        this.restClient = RestClient.builder().requestFactory(rf).build();
    }

    @Scheduled(fixedDelayString = "${opesfuel.webhooks.poll-interval-ms:5000}")
    public void dispatchPendingOutboxEvents() {
        if (!enabled) return;

        List<OutboxQueryApi.OutboxEventView> pending = outboxQueryApi.findUnpublishedBatch(25);
        for (OutboxQueryApi.OutboxEventView event : pending) {
            List<WebhookEntity> targets = webhookRepository.findByTenantIdAndActiveTrue(event.tenantId()).stream()
                .filter(w -> w.subscribesTo(event.eventType()))
                .toList();

            if (targets.isEmpty()) {
                outboxQueryApi.markPublished(event.eventId());
                continue;
            }

            boolean allSucceeded = true;
            String lastError = null;
            for (WebhookEntity webhook : targets) {
                long started = System.currentTimeMillis();
                try {
                    urlValidator.validate(webhook.getTargetUrl());
                    long timestamp = Instant.now().getEpochSecond();
                    String secret = webhook.decryptSigningSecret(cryptoService);
                    String signature = signHmacSha256(secret, timestamp + "." + event.payloadJson());
                    ResponseEntity<Void> resp = restClient.post()
                        .uri(webhook.getTargetUrl())
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("X-OpesFuel-Event-Id", event.eventId())
                        .header("X-OpesFuel-Event-Type", event.eventType())
                        .header("X-OpesFuel-Timestamp", String.valueOf(timestamp))
                        .header("X-OpesFuel-Signature", "t=" + timestamp + ",v1=" + signature)
                        .body(event.payloadJson())
                        .retrieve()
                        .toBodilessEntity();
                    long elapsed = System.currentTimeMillis() - started;
                    deliveryRepository.save(WebhookDeliveryEntity.record(
                        webhook.getId(), event.eventId(), event.eventType(),
                        resp.getStatusCode().value(), true, null, elapsed
                    ));
                } catch (Exception ex) {
                    long elapsed = System.currentTimeMillis() - started;
                    allSucceeded = false;
                    lastError = ex.getMessage();
                    deliveryRepository.save(WebhookDeliveryEntity.record(
                        webhook.getId(), event.eventId(), event.eventType(),
                        null, false, ex.getMessage(), elapsed
                    ));
                    log.warn("Webhook delivery failed for event {} to {}: {}", event.eventId(), webhook.getTargetUrl(), ex.getMessage());
                }
            }

            if (allSucceeded) {
                outboxQueryApi.markPublished(event.eventId());
            } else {
                outboxQueryApi.recordFailure(event.eventId(), lastError, maxRetries);
            }
        }
    }

    static String signHmacSha256(String secret, String message) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = mac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        return HexFormat.of().formatHex(digest);
    }
}

record DemoLeadCommand(
    @NotBlank String fullName,
    @NotBlank String stationName,
    @Email @NotBlank String email,
    @NotBlank String phone,
    @Min(1) int pumpCount,
    String selectedPlan
) {}

record ApiKeyIssuedDto(
    String id,
    String label,
    String maskedKey,
    String rawKey,
    List<String> scopes,
    Instant createdAt
) {}

record WebhookCreatedDto(
    String id,
    String targetUrl,
    List<String> subscribedEvents,
    boolean active,
    String signingSecret
) {}

record CreateApiKeyCommand(@NotBlank String label, @NotEmpty List<String> scopes) {}
record CreateWebhookCommand(@NotBlank String targetUrl, @NotEmpty List<String> subscribedEvents) {}

@RestController
@RequestMapping("/api/v1")
public class ApiPlatformController {
    private final ApiKeyRepository apiKeyRepo;
    private final WebhookRepository webhookRepo;
    private final WebhookDeliveryRepository deliveryRepo;
    private final DemoLeadRepository demoLeadRepo;
    private final OutboxQueryApi outboxQueryApi;
    private final TenantAccessGuard accessGuard;
    private final WebhookUrlValidator webhookUrlValidator;
    private final AesGcmCryptoService cryptoService;
    private final ApplicationEventPublisher eventPublisher;
    private final int leadsRateLimitPerMinute;
    private final ConcurrentHashMap<String, RateWindow> leadRateLimiter = new ConcurrentHashMap<>();

    public ApiPlatformController(
        ApiKeyRepository apiKeyRepo,
        WebhookRepository webhookRepo,
        WebhookDeliveryRepository deliveryRepo,
        DemoLeadRepository demoLeadRepo,
        OutboxQueryApi outboxQueryApi,
        TenantAccessGuard accessGuard,
        WebhookUrlValidator webhookUrlValidator,
        AesGcmCryptoService cryptoService,
        ApplicationEventPublisher eventPublisher,
        @Value("${opesfuel.leads.rate-limit-per-minute:20}") int leadsRateLimitPerMinute
    ) {
        this.apiKeyRepo = apiKeyRepo;
        this.webhookRepo = webhookRepo;
        this.deliveryRepo = deliveryRepo;
        this.demoLeadRepo = demoLeadRepo;
        this.outboxQueryApi = outboxQueryApi;
        this.accessGuard = accessGuard;
        this.webhookUrlValidator = webhookUrlValidator;
        this.cryptoService = cryptoService;
        this.eventPublisher = eventPublisher;
        this.leadsRateLimitPerMinute = Math.max(1, leadsRateLimitPerMinute);
    }

    @PostMapping("/public/leads")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, String> submitLead(@Valid @RequestBody DemoLeadCommand command, HttpServletRequest request) {
        enforceLeadRateLimit(request);
        DemoLeadEntity saved = demoLeadRepo.save(DemoLeadEntity.create(command));
        eventPublisher.publishEvent(new DemoLeadCapturedEvent(
            UUID.randomUUID().toString(), saved.getId(), TenantAccessGuard.DEFAULT_TENANT_ID, null,
            saved.getFullName(), saved.getStationName(), saved.getEmail(), saved.getPumpCount(), saved.getCreatedAt()
        ));
        return Map.of(
            "referenceId", saved.getReferenceId(),
            "status", saved.getStatus(),
            "submittedAt", saved.getCreatedAt().toString()
        );
    }

    @GetMapping("/platform/events")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_events:read')")
    public List<OutboxQueryApi.OutboxEventView> listEvents(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return outboxQueryApi.listRecentEvents(accessGuard.currentTenantId(), stationId, limit);
    }

    @GetMapping("/platform/api-keys")
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_platform:admin')")
    public List<ApiKeyEntity> listApiKeys() {
        return apiKeyRepo.findByTenantIdOrderByCreatedAtDesc(accessGuard.currentTenantId());
    }

    @PostMapping("/platform/api-keys")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_platform:admin')")
    @Transactional
    public ApiKeyIssuedDto createApiKey(@Valid @RequestBody CreateApiKeyCommand command) {
        ApiKeyEntity.IssuedKey issued = ApiKeyEntity.issue(accessGuard.currentTenantId(), command.label(), command.scopes());
        ApiKeyEntity saved = apiKeyRepo.save(issued.entity());
        return new ApiKeyIssuedDto(
            saved.getId(), saved.getLabel(), saved.getMaskedKey(), issued.rawKey(), saved.getScopes(), saved.getCreatedAt()
        );
    }

    @DeleteMapping("/platform/api-keys/{keyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_platform:admin')")
    @Transactional
    public void revokeApiKey(@PathVariable String keyId) {
        ApiKeyEntity key = apiKeyRepo.findById(keyId)
            .orElseThrow(() -> new IllegalArgumentException("API key not found: " + keyId));
        accessGuard.assertTenantMatch(key.getTenantId());
        apiKeyRepo.deleteById(keyId);
    }

    @GetMapping("/platform/webhooks")
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_platform:admin')")
    public List<WebhookEntity> listWebhooks() {
        return webhookRepo.findByTenantId(accessGuard.currentTenantId());
    }

    @PostMapping("/platform/webhooks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_platform:admin')")
    @Transactional
    public WebhookCreatedDto createWebhook(@Valid @RequestBody CreateWebhookCommand command) {
        webhookUrlValidator.validate(command.targetUrl());
        WebhookEntity.RegisteredWebhook registered = WebhookEntity.register(
            accessGuard.currentTenantId(), command.targetUrl(), command.subscribedEvents(), cryptoService
        );
        WebhookEntity saved = webhookRepo.save(registered.entity());
        return new WebhookCreatedDto(
            saved.getId(), saved.getTargetUrl(), saved.getSubscribedEvents(), saved.isActive(), registered.rawSigningSecret()
        );
    }

    @GetMapping("/platform/webhooks/{webhookId}/deliveries")
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_platform:admin')")
    public List<WebhookDeliveryEntity> listWebhookDeliveries(
        @PathVariable String webhookId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        WebhookEntity webhook = webhookRepo.findById(webhookId)
            .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + webhookId));
        accessGuard.assertTenantMatch(webhook.getTenantId());
        return deliveryRepo.findByWebhookIdOrderByAttemptedAtDesc(webhookId, PageRequest.of(0, Math.max(1, Math.min(limit, 100))));
    }

    @PatchMapping("/platform/webhooks/{webhookId}")
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_platform:admin')")
    @Transactional
    public WebhookEntity toggleWebhook(@PathVariable String webhookId) {
        WebhookEntity webhook = webhookRepo.findById(webhookId)
            .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + webhookId));
        accessGuard.assertTenantMatch(webhook.getTenantId());
        webhook.toggleActive();
        return webhookRepo.save(webhook);
    }

    @DeleteMapping("/platform/webhooks/{webhookId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_platform:admin')")
    @Transactional
    public void deleteWebhook(@PathVariable String webhookId) {
        WebhookEntity webhook = webhookRepo.findById(webhookId)
            .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + webhookId));
        accessGuard.assertTenantMatch(webhook.getTenantId());
        webhookRepo.deleteById(webhookId);
    }

    private void enforceLeadRateLimit(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isBlank()) {
            ip = request.getRemoteAddr() != null ? request.getRemoteAddr() : "unknown";
        } else {
            ip = ip.split(",")[0].trim();
        }
        long currentMinute = Instant.now().getEpochSecond() / 60L;
        RateWindow window = leadRateLimiter.compute(ip, (k, existing) -> {
            if (existing == null || existing.minuteBucket != currentMinute) {
                return new RateWindow(currentMinute, new AtomicInteger(1));
            }
            existing.count.incrementAndGet();
            return existing;
        });
        if (window.count.get() > leadsRateLimitPerMinute) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many demo lead submissions. Please retry in a minute.");
        }
    }

    private record RateWindow(long minuteBucket, AtomicInteger count) {}
}
