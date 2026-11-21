package com.opesware.opesfuel.apiplatform;

import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "api_keys")
class ApiKeyEntity {
    @Id
    private String id;
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

    public static IssuedKey issue(String label, List<String> scopes) {
        ApiKeyEntity k = new ApiKeyEntity();
        k.id = "key_" + UUID.randomUUID().toString().substring(0, 8);
        k.label = label;
        k.keyPrefix = "opf_live_" + UUID.randomUUID().toString().replace("-", "").substring(0, 6);
        String rawSecret = UUID.randomUUID().toString().replace("-", "");
        String rawKey = k.keyPrefix + "_" + rawSecret;
        k.keyHash = sha256(rawKey);
        k.scopesCsv = String.join(",", scopes);
        k.createdAt = Instant.now();
        return new IssuedKey(k, rawKey);
    }

    public record IssuedKey(ApiKeyEntity entity, String rawKey) {}

    private static String sha256(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    public String getId() { return id; }
    public String getLabel() { return label; }
    public String getMaskedKey() { return keyPrefix + "_••••••••••••"; }
    public List<String> getScopes() { return List.of(scopesCsv.split(",")); }
    public Instant getCreatedAt() { return createdAt; }
}

@Entity
@Table(name = "webhook_subscriptions")
class WebhookEntity {
    @Id
    private String id;
    @Column(name = "target_url", nullable = false)
    private String targetUrl;
    @Column(name = "subscribed_events_csv", nullable = false)
    private String subscribedEventsCsv;
    @Column(name = "hmac_secret_hash", nullable = false)
    private String hmacSecretHash;
    @Column(nullable = false)
    private boolean active = true;

    public static WebhookEntity register(String targetUrl, List<String> events) {
        WebhookEntity w = new WebhookEntity();
        w.id = "wh_" + UUID.randomUUID().toString().substring(0, 8);
        w.targetUrl = targetUrl;
        w.subscribedEventsCsv = String.join(",", events);
        w.hmacSecretHash = UUID.randomUUID().toString();
        w.active = true;
        return w;
    }

    public void toggleActive() { this.active = !this.active; }

    public String getId() { return id; }
    public String getTargetUrl() { return targetUrl; }
    public List<String> getSubscribedEvents() { return List.of(subscribedEventsCsv.split(",")); }
    public boolean isActive() { return active; }
}

@Entity
@Table(name = "outbox_events")
class OutboxEventEntity {
    @Id
    @Column(name = "event_id")
    private String eventId;
    @Column(name = "event_type", nullable = false)
    private String eventType;
    @Column(name = "aggregate_type", nullable = false)
    private String aggregateType;
    @Column(name = "aggregate_id", nullable = false)
    private String aggregateId;
    @Column(nullable = false)
    private String summary;
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    public String getEventId() { return eventId; }
    public String getEventType() { return eventType; }
    public String getAggregateType() { return aggregateType; }
    public String getAggregateId() { return aggregateId; }
    public String getSummary() { return summary; }
    public Instant getOccurredAt() { return occurredAt; }
}

interface ApiKeyRepository extends JpaRepository<ApiKeyEntity, String> {}
interface WebhookRepository extends JpaRepository<WebhookEntity, String> {}
interface OutboxEventRepository extends JpaRepository<OutboxEventEntity, String> {
    List<OutboxEventEntity> findTop50ByOrderByOccurredAtDesc();
}

record SubscriptionPlanDto(
    String id,
    String name,
    String audience,
    long monthlyPriceFcfa,
    String pumpLimit,
    String apiQuotaPerMonth,
    List<String> features
) {}

record EnterpriseLicenseDto(
    String id,
    String title,
    String billingModel,
    Long annualFeeFcfa,
    String pricingDisplay,
    List<String> platformsIncluded,
    boolean fullIntellectualPropertyTransfer,
    List<String> includedServices
) {}

record DemoLeadCommand(
    @NotBlank String fullName,
    @NotBlank String stationName,
    @Email @NotBlank String email,
    @NotBlank String phone,
    int pumpCount,
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

record CreateApiKeyCommand(@NotBlank String label, @NotEmpty List<String> scopes) {}
record CreateWebhookCommand(@NotBlank String targetUrl, @NotEmpty List<String> subscribedEvents) {}

@RestController
@RequestMapping("/api/v1")
public class ApiPlatformController {
    private final ApiKeyRepository apiKeyRepo;
    private final WebhookRepository webhookRepo;
    private final OutboxEventRepository outboxRepo;

    public ApiPlatformController(ApiKeyRepository apiKeyRepo, WebhookRepository webhookRepo, OutboxEventRepository outboxRepo) {
        this.apiKeyRepo = apiKeyRepo;
        this.webhookRepo = webhookRepo;
        this.outboxRepo = outboxRepo;
    }

    @GetMapping("/billing/plans")
    public List<SubscriptionPlanDto> listPlans() {
        return List.of(
            new SubscriptionPlanDto("starter", "Starter Station", "For independent single-site stations", 25_000L, "Up to 6 pumps · 3 tanks", "50,000 API calls / month",
                List.of("Pump & shift meter reconciliation", "Underground tank dipstick tracking", "Automated daily P&L in FCFA", "Mobile app for Android & iPhone (3 seats)")),
            new SubscriptionPlanDto("pro", "Multi-Pump Pro", "For high-volume urban forecourts", 55_000L, "Up to 18 pumps · 8 tanks", "250,000 API calls / month",
                List.of("Everything in Starter Station", "Corporate fleet credit & invoicing", "Lubricants, LPG & shop POS ledger", "Full Trial Balance, Balance Sheet & VAT export")),
            new SubscriptionPlanDto("enterprise", "Network Enterprise", "For regional station networks & ERPs", 120_000L, "Unlimited stations & pumps", "Unlimited API + HMAC Webhooks",
                List.of("Multi-station consolidated reporting", "Dedicated Auth0 tenant & custom roles", "Signed domain event webhooks", "Included AI Copilot + Priority SLA"))
        );
    }

    @GetMapping("/billing/enterprise-licenses")
    public List<EnterpriseLicenseDto> listEnterpriseLicenses() {
        return List.of(
            new EnterpriseLicenseDto(
                "perpetual_managed",
                "Perpetual Self-Hosted Deployment License",
                "PERPETUAL_ANNUAL_MANAGED",
                5_000_000L,
                "5 000 000 FCFA / year",
                List.of("Web", "Mobile (Android & iPhone)", "Java 25 Spring Boot + PostgreSQL"),
                false,
                List.of(
                    "Dedicated private server or cloud deployment",
                    "Infrastructure management & PostgreSQL backups",
                    "Security patching & CVE remediation",
                    "Preventive maintenance & regulatory upgrades"
                )
            ),
            new EnterpriseLicenseDto(
                "custom_ip_buyout",
                "Custom-Developed Platform & Full Source Code IP License",
                "NEGOTIATED_IP_ACQUISITION",
                null,
                "Negotiated Price",
                List.of("Web", "Mobile (iOS/Android)", "Desktop (Windows/macOS/Linux)", "Java 25 Backend"),
                true,
                List.of(
                    "100% source code delivery across Web, Mobile & Desktop",
                    "Full Intellectual Property (IP) ownership assignment",
                    "White-label branding & custom hardware integrations"
                )
            )
        );
    }

    @PostMapping("/public/leads")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, String> submitLead(@Valid @RequestBody DemoLeadCommand command) {
        return Map.of(
            "referenceId", "LEAD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(),
            "status", "RECEIVED",
            "submittedAt", Instant.now().toString()
        );
    }

    @GetMapping("/platform/events")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public List<OutboxEventEntity> listEvents() {
        return outboxRepo.findTop50ByOrderByOccurredAtDesc();
    }

    @GetMapping("/platform/api-keys")
    @PreAuthorize("hasRole('OWNER')")
    public List<ApiKeyEntity> listApiKeys() {
        return apiKeyRepo.findAll();
    }

    @PostMapping("/platform/api-keys")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER')")
    public ApiKeyIssuedDto createApiKey(@Valid @RequestBody CreateApiKeyCommand command) {
        ApiKeyEntity.IssuedKey issued = ApiKeyEntity.issue(command.label(), command.scopes());
        ApiKeyEntity saved = apiKeyRepo.save(issued.entity());
        return new ApiKeyIssuedDto(
            saved.getId(),
            saved.getLabel(),
            saved.getMaskedKey(),
            issued.rawKey(),
            saved.getScopes(),
            saved.getCreatedAt()
        );
    }

    @DeleteMapping("/platform/api-keys/{keyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER')")
    public void revokeApiKey(@PathVariable String keyId) {
        apiKeyRepo.deleteById(keyId);
    }

    @GetMapping("/platform/webhooks")
    @PreAuthorize("hasRole('OWNER')")
    public List<WebhookEntity> listWebhooks() {
        return webhookRepo.findAll();
    }

    @PostMapping("/platform/webhooks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER')")
    public WebhookEntity createWebhook(@Valid @RequestBody CreateWebhookCommand command) {
        return webhookRepo.save(WebhookEntity.register(command.targetUrl(), command.subscribedEvents()));
    }

    @PatchMapping("/platform/webhooks/{webhookId}")
    @PreAuthorize("hasRole('OWNER')")
    public WebhookEntity toggleWebhook(@PathVariable String webhookId) {
        WebhookEntity webhook = webhookRepo.findById(webhookId)
            .orElseThrow(() -> new IllegalArgumentException("Webhook not found: " + webhookId));
        webhook.toggleActive();
        return webhookRepo.save(webhook);
    }

    @DeleteMapping("/platform/webhooks/{webhookId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER')")
    public void deleteWebhook(@PathVariable String webhookId) {
        webhookRepo.deleteById(webhookId);
    }
}
