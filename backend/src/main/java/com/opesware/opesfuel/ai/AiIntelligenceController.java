package com.opesware.opesfuel.ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.opesware.opesfuel.accounting.AccountingQueryApi;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import com.opesware.opesfuel.station.StationCatalogApi;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "ai_subscriptions")
class AiSubscriptionEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false, unique = true)
    private String stationId;
    @Column(nullable = false)
    private boolean active;
    @Column(name = "plan_code", nullable = false)
    private String planCode;
    @Column(name = "monthly_fee_fcfa", nullable = false)
    private long monthlyFeeFcfa;
    @Column(name = "activated_at")
    private Instant activatedAt;

    public static AiSubscriptionEntity create(String stationId, boolean active, String planCode, long monthlyFeeFcfa) {
        AiSubscriptionEntity sub = new AiSubscriptionEntity();
        sub.id = "aisub_" + stationId;
        sub.stationId = stationId;
        sub.active = active;
        sub.planCode = planCode;
        sub.monthlyFeeFcfa = monthlyFeeFcfa;
        sub.activatedAt = active ? Instant.now() : null;
        return sub;
    }

    public void setActive(boolean active, String planCode, long monthlyFeeFcfa) {
        this.active = active;
        this.planCode = planCode;
        this.monthlyFeeFcfa = monthlyFeeFcfa;
        this.activatedAt = active ? Instant.now() : null;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public boolean isActive() { return active; }
    public String getPlanCode() { return planCode; }
    public long getMonthlyFeeFcfa() { return monthlyFeeFcfa; }
    public Instant getActivatedAt() { return activatedAt; }
}

@Entity
@Table(name = "ai_audit_logs")
class AiAuditLogEntity {
    @Id
    private String id;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "operation_type", nullable = false)
    private String operationType;
    @Column(name = "model_name", nullable = false)
    private String modelName;
    @Column(name = "prompt_summary", nullable = false, columnDefinition = "TEXT")
    private String promptSummary;
    @Column(name = "response_text", nullable = false, columnDefinition = "TEXT")
    private String responseText;
    @Column(name = "estimated_tokens", nullable = false)
    private int estimatedTokens;
    @Column(name = "requested_by", nullable = false)
    private String requestedBy;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static AiAuditLogEntity record(
        String tenantId, String stationId, String opType, String model,
        String promptSummary, String responseText, String requestedBy
    ) {
        AiAuditLogEntity log = new AiAuditLogEntity();
        log.id = "ailog_" + UUID.randomUUID();
        log.tenantId = tenantId;
        log.stationId = stationId;
        log.operationType = opType;
        log.modelName = model;
        log.promptSummary = promptSummary.length() > 500 ? promptSummary.substring(0, 500) : promptSummary;
        log.responseText = responseText;
        log.estimatedTokens = Math.max(1, (promptSummary.length() + responseText.length()) / 4);
        log.requestedBy = requestedBy;
        log.createdAt = Instant.now();
        return log;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getOperationType() { return operationType; }
    public String getModelName() { return modelName; }
    public String getPromptSummary() { return promptSummary; }
    public String getResponseText() { return responseText; }
    public int getEstimatedTokens() { return estimatedTokens; }
    public String getRequestedBy() { return requestedBy; }
    public Instant getCreatedAt() { return createdAt; }
}

interface AiSubscriptionRepository extends JpaRepository<AiSubscriptionEntity, String> {
    java.util.Optional<AiSubscriptionEntity> findByStationId(String stationId);
}

interface AiAuditLogRepository extends JpaRepository<AiAuditLogEntity, String> {
    List<AiAuditLogEntity> findByStationIdOrderByCreatedAtDesc(String stationId, PageRequest pageable);
}

@Service
class AiCopilotService {
    private static final long AI_ADDON_MONTHLY_FEE_FCFA = 25_000L;

    private final AiSubscriptionRepository subscriptionRepo;
    private final AiAuditLogRepository auditLogRepo;
    private final StationCatalogApi stationCatalogApi;
    private final AccountingQueryApi accountingQueryApi;
    private final TenantAccessGuard accessGuard;
    private final ObjectMapper objectMapper;
    private final RestClient geminiClient;
    private final String configuredApiKey;
    private final String configuredModel;

    AiCopilotService(
        AiSubscriptionRepository subscriptionRepo,
        AiAuditLogRepository auditLogRepo,
        StationCatalogApi stationCatalogApi,
        AccountingQueryApi accountingQueryApi,
        TenantAccessGuard accessGuard,
        ObjectMapper objectMapper,
        @Value("${opesfuel.ai.base-url:https://generativelanguage.googleapis.com}") String baseUrl,
        @Value("${opesfuel.ai.api-key:}") String apiKey,
        @Value("${opesfuel.ai.model:gemini-2.5-flash}") String model,
        @Value("${opesfuel.ai.connect-timeout-ms:5000}") int connectTimeoutMs,
        @Value("${opesfuel.ai.read-timeout-ms:30000}") int readTimeoutMs
    ) {
        this.subscriptionRepo = subscriptionRepo;
        this.auditLogRepo = auditLogRepo;
        this.stationCatalogApi = stationCatalogApi;
        this.accountingQueryApi = accountingQueryApi;
        this.accessGuard = accessGuard;
        this.objectMapper = objectMapper;
        this.configuredApiKey = apiKey;
        this.configuredModel = model;

        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(connectTimeoutMs);
        rf.setReadTimeout(readTimeoutMs);
        this.geminiClient = RestClient.builder().baseUrl(baseUrl).requestFactory(rf).build();
    }

    @Transactional(readOnly = true)
    public AiSubscriptionEntity getSubscription(String stationId) {
        stationCatalogApi.requireAccessibleStation(stationId);
        boolean enterprise = stationCatalogApi.isEnterprisePlan(stationId);
        return subscriptionRepo.findByStationId(stationId)
            .orElseGet(() -> AiSubscriptionEntity.create(
                stationId, enterprise, enterprise ? "INCLUDED_ENTERPRISE" : "AI_COPILOT_ADDON",
                enterprise ? 0L : AI_ADDON_MONTHLY_FEE_FCFA
            ));
    }

    @Transactional
    public AiSubscriptionEntity updateSubscription(UpdateAiSubscriptionCommand command) {
        stationCatalogApi.requireAccessibleStation(command.stationId());
        boolean isEnterprise = stationCatalogApi.isEnterprisePlan(command.stationId());

        if ("INCLUDED_ENTERPRISE".equalsIgnoreCase(command.planCode()) && !isEnterprise) {
            throw new IllegalStateException(
                "INCLUDED_ENTERPRISE (0 FCFA) AI entitlement requires an active Network Enterprise station subscription."
            );
        }

        String code = isEnterprise ? "INCLUDED_ENTERPRISE" : "AI_COPILOT_ADDON";
        long fee = isEnterprise ? 0L : AI_ADDON_MONTHLY_FEE_FCFA;
        AiSubscriptionEntity entity = subscriptionRepo.findByStationId(command.stationId())
            .orElseGet(() -> AiSubscriptionEntity.create(command.stationId(), command.active(), code, fee));
        entity.setActive(command.active(), code, fee);
        return subscriptionRepo.save(entity);
    }

    @Transactional(readOnly = true)
    public List<AiAuditLogEntity> listHistory(String stationId, int limit) {
        stationCatalogApi.requireAccessibleStation(stationId);
        return auditLogRepo.findByStationIdOrderByCreatedAtDesc(stationId, PageRequest.of(0, Math.max(1, Math.min(limit, 100))));
    }

    public Map<String, Object> analyzeStation(AiAnalyzeCommand command) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(command.stationId());
        AiSubscriptionEntity sub = getSubscription(command.stationId());
        if (!sub.isActive()) {
            throw new ResponseStatusException(
                HttpStatus.PAYMENT_REQUIRED,
                "Paid AI Copilot subscription (25,000 FCFA/month or Network Enterprise) is required before running AI predictions."
            );
        }

        // Ground AI analysis in authoritative server-side SYSCOHADA financials merged with optional telemetry
        Map<String, Object> groundedContext = buildServerGroundedContext(station, command.metricsSnapshot());
        String prompt = "You are the OpesFuel Petroleum Operations & SYSCOHADA Financial AI Copilot. "
            + "Analyze the following station telemetry & ledger JSON (currency: FCFA, fuel volumes: Litres) and return JSON with keys: "
            + "executiveSummary (string), healthScore (integer 0-100), revenueForecast30dFcfa (integer), "
            + "stockoutPredictions (array of {tankId, tankName, grade, daysRemaining, recommendedOrderLitres, urgency}), "
            + "marginSuggestions (array of {title, impactFcfa, recommendation}), "
            + "anomalyAlerts (array of {severity, module, detail}), "
            + "prioritizedActions (array of {action, targetSection, rationale}).\n"
            + "Authoritative Station Context JSON: " + toJsonSafe(groundedContext);

        String geminiRaw = invokeGeminiModel(prompt, true);
        auditLogRepo.save(AiAuditLogEntity.record(
            station.tenantId(), station.id(), "ANALYZE", configuredModel,
            "Station telemetry & financial analysis for " + station.name(), geminiRaw, accessGuard.currentPrincipal().principalId()
        ));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("stationId", command.stationId());
        result.put("model", configuredModel);
        result.put("generatedAt", Instant.now().toString());
        result.put("analysis", geminiRaw);
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> structured = objectMapper.readValue(geminiRaw, Map.class);
            result.putAll(structured);
        } catch (Exception ignored) {
            // Preserve raw analysis text fallback
        }
        return result;
    }

    public Map<String, Object> chatWithAdvisor(AiChatCommand command) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(command.stationId());
        AiSubscriptionEntity sub = getSubscription(command.stationId());
        if (!sub.isActive()) {
            throw new ResponseStatusException(
                HttpStatus.PAYMENT_REQUIRED,
                "Paid AI Copilot subscription (25,000 FCFA/month or Network Enterprise) is required."
            );
        }

        Map<String, Object> groundedContext = buildServerGroundedContext(station, command.metricsSnapshot());
        String historyText = "";
        if (command.history() != null && !command.history().isEmpty()) {
            int start = Math.max(0, command.history().size() - 6);
            StringBuilder sb = new StringBuilder("\nRecent conversation:\n");
            for (Map<String, String> msg : command.history().subList(start, command.history().size())) {
                String speaker = "user".equalsIgnoreCase(msg.get("role")) ? "Operator" : "OpesFuel AI";
                sb.append(speaker).append(": ").append(msg.getOrDefault("content", "")).append("\n");
            }
            historyText = sb.toString();
        }

        String prompt = "You are the OpesFuel AI Operations Advisor for petrol station owners, managers, and accountants in FCFA and Litres.\n"
            + "Authoritative Station Telemetry & Ledger JSON: " + toJsonSafe(groundedContext)
            + historyText
            + "\nOperator question: " + command.question().trim();

        String geminiResponse = invokeGeminiModel(prompt, false);
        auditLogRepo.save(AiAuditLogEntity.record(
            station.tenantId(), station.id(), "CHAT", configuredModel,
            command.question().trim(), geminiResponse, accessGuard.currentPrincipal().principalId()
        ));

        return Map.of(
            "stationId", command.stationId(),
            "model", configuredModel,
            "answer", geminiResponse,
            "answeredAt", Instant.now().toString()
        );
    }

    private Map<String, Object> buildServerGroundedContext(StationCatalogApi.StationSnapshot station, Map<String, Object> clientMetrics) {
        AccountingQueryApi.FinancialSummary fin = accountingQueryApi.getFinancialSummary(station.id(), null, null);
        Map<String, Object> ctx = new LinkedHashMap<>();
        ctx.put("station", Map.of("id", station.id(), "code", station.code(), "name", station.name(), "city", station.city(), "plan", station.planName()));
        ctx.put("serverFinancialsFcfa", Map.of(
            "totalRevenueFcfa", fin.totalRevenueFcfa(),
            "cogsFcfa", fin.cogsFcfa(),
            "grossProfitFcfa", fin.grossProfitFcfa(),
            "operatingExpensesFcfa", fin.operatingExpensesFcfa(),
            "cashVarianceFcfa", fin.cashVarianceFcfa(),
            "netIncomeFcfa", fin.netIncomeFcfa(),
            "vatPayableFcfa", fin.vatPayableFcfa(),
            "inventoryAssetFcfa", fin.inventoryAssetFcfa(),
            "fleetReceivablesFcfa", fin.fleetReceivablesFcfa(),
            "accountsPayableFcfa", fin.accountsPayableFcfa()
        ));
        if (clientMetrics != null && !clientMetrics.isEmpty()) {
            ctx.put("clientTelemetry", clientMetrics);
        }
        return ctx;
    }

    private String toJsonSafe(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj != null ? obj : Map.of());
        } catch (Exception ex) {
            return "{}";
        }
    }

    @SuppressWarnings("unchecked")
    private String invokeGeminiModel(String promptText, boolean expectJson) {
        String apiKey = (configuredApiKey != null && !configuredApiKey.isBlank())
            ? configuredApiKey
            : System.getenv("GEMINI_API_KEY");
        if (apiKey == null || apiKey.isBlank() || "MY_GEMINI_API_KEY".equals(apiKey)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "GEMINI_API_KEY is not configured in server environment.");
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contents", List.of(Map.of("parts", List.of(Map.of("text", promptText)))));
        if (expectJson) {
            payload.put("generationConfig", Map.of("responseMimeType", "application/json"));
        }

        Map<String, Object> response = geminiClient.post()
            .uri("/v1beta/models/{model}:generateContent", configuredModel)
            .header("x-goog-api-key", apiKey)
            .body(payload)
            .retrieve()
            .onStatus(status -> status.isError(), (req, res) -> {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider returned HTTP " + res.getStatusCode().value());
            })
            .body(Map.class);

        if (response == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Empty response from AI provider.");
        }
        Object candidatesObj = response.get("candidates");
        if (!(candidatesObj instanceof List<?> candidates) || candidates.isEmpty() || !(candidates.get(0) instanceof Map<?, ?> firstCandidate)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "No candidates returned by AI provider.");
        }
        Object contentObj = firstCandidate.get("content");
        if (!(contentObj instanceof Map<?, ?> content)) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider candidate contained no content (possibly safety-filtered).");
        }
        Object partsObj = content.get("parts");
        if (!(partsObj instanceof List<?> parts) || parts.isEmpty() || !(parts.get(0) instanceof Map<?, ?> firstPart) || firstPart.get("text") == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "AI provider returned empty text content.");
        }
        return String.valueOf(firstPart.get("text"));
    }
}

record UpdateAiSubscriptionCommand(@NotBlank String stationId, boolean active, String planCode) {}
record AiAnalyzeCommand(@NotBlank String stationId, Map<String, Object> metricsSnapshot) {}
record AiChatCommand(@NotBlank String stationId, @NotBlank String question, Map<String, Object> metricsSnapshot, List<Map<String, String>> history) {}

@RestController
@RequestMapping("/api/v1/ai")
public class AiIntelligenceController {

    private final AiCopilotService service;

    public AiIntelligenceController(AiCopilotService service) {
        this.service = service;
    }

    @GetMapping("/subscription")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_ai:read')")
    public AiSubscriptionEntity getSubscription(@RequestParam String stationId) {
        return service.getSubscription(stationId);
    }

    @PostMapping("/subscription/activate")
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_ai:admin')")
    public AiSubscriptionEntity updateSubscription(@Valid @RequestBody UpdateAiSubscriptionCommand command) {
        return service.updateSubscription(command);
    }

    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_ai:read')")
    public List<AiAuditLogEntity> listHistory(
        @RequestParam String stationId,
        @RequestParam(required = false, defaultValue = "30") int limit
    ) {
        return service.listHistory(stationId, limit);
    }

    @PostMapping("/analyze")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_ai:read')")
    public Map<String, Object> analyzeStation(@Valid @RequestBody AiAnalyzeCommand command) {
        return service.analyzeStation(command);
    }

    @PostMapping("/chat")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_ai:read')")
    public Map<String, Object> chatWithAdvisor(@Valid @RequestBody AiChatCommand command) {
        return service.chatWithAdvisor(command);
    }
}
