package com.opesware.opesfuel.ai;

import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;

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
        if (active) {
            this.activatedAt = Instant.now();
        }
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public boolean isActive() { return active; }
    public String getPlanCode() { return planCode; }
    public long getMonthlyFeeFcfa() { return monthlyFeeFcfa; }
    public Instant getActivatedAt() { return activatedAt; }
}

interface AiSubscriptionRepository extends JpaRepository<AiSubscriptionEntity, String> {
    java.util.Optional<AiSubscriptionEntity> findByStationId(String stationId);
}

record UpdateAiSubscriptionCommand(
    @NotBlank String stationId,
    boolean active,
    String planCode
) {}

record AiAnalyzeCommand(
    @NotBlank String stationId,
    Map<String, Object> metricsSnapshot
) {}

record AiChatCommand(
    @NotBlank String stationId,
    @NotBlank String question,
    Map<String, Object> metricsSnapshot
) {}

@RestController
@RequestMapping("/api/v1/ai")
public class AiIntelligenceController {

    private final AiSubscriptionRepository subscriptionRepo;

    public AiIntelligenceController(AiSubscriptionRepository subscriptionRepo) {
        this.subscriptionRepo = subscriptionRepo;
    }

    @GetMapping("/subscription")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public AiSubscriptionEntity getSubscription(@RequestParam String stationId) {
        return subscriptionRepo.findByStationId(stationId)
            .orElseGet(() -> AiSubscriptionEntity.create(stationId, false, "AI_COPILOT_ADDON", 25_000L));
    }

    @PostMapping("/subscription/activate")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @Transactional
    public AiSubscriptionEntity updateSubscription(@Valid @RequestBody UpdateAiSubscriptionCommand command) {
        String code = command.planCode() != null && !command.planCode().isBlank()
            ? command.planCode()
            : "AI_COPILOT_ADDON";
        long fee = "INCLUDED_ENTERPRISE".equalsIgnoreCase(code) ? 0L : 25_000L;
        AiSubscriptionEntity entity = subscriptionRepo.findByStationId(command.stationId())
            .orElseGet(() -> AiSubscriptionEntity.create(command.stationId(), command.active(), code, fee));
        entity.setActive(command.active(), code, fee);
        return subscriptionRepo.save(entity);
    }

    @PostMapping("/analyze")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> analyzeStation(@Valid @RequestBody AiAnalyzeCommand command) {
        AiSubscriptionEntity sub = getSubscription(command.stationId());
        if (!sub.isActive()) {
            throw new IllegalStateException("Paid AI Copilot subscription (25,000 FCFA/month) is required before running AI predictions.");
        }
        String geminiResponse = invokeGeminiModel(
            "Analyze the following OpesFuel station telemetry JSON (FCFA currency, Litres fuel volumes) and provide concise stockout predictions, variance checks, and margin suggestions:\n"
                + command.metricsSnapshot()
        );
        return Map.of(
            "stationId", command.stationId(),
            "model", "gemini-4-hydrogen",
            "analysis", geminiResponse,
            "generatedAt", Instant.now().toString()
        );
    }

    @PostMapping("/chat")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> chatWithAdvisor(@Valid @RequestBody AiChatCommand command) {
        AiSubscriptionEntity sub = getSubscription(command.stationId());
        if (!sub.isActive()) {
            throw new IllegalStateException("Paid AI Copilot subscription (25,000 FCFA/month) is required.");
        }
        String geminiResponse = invokeGeminiModel(
            "Context (FCFA & Litres): " + command.metricsSnapshot() + "\nOperator question: " + command.question()
        );
        return Map.of(
            "stationId", command.stationId(),
            "answer", geminiResponse,
            "answeredAt", Instant.now().toString()
        );
    }

    @SuppressWarnings("unchecked")
    private String invokeGeminiModel(String promptText) {
        String apiKey = System.getenv("GEMINI_API_KEY");
        if (apiKey == null || apiKey.isBlank() || "MY_GEMINI_API_KEY".equals(apiKey)) {
            throw new IllegalStateException("GEMINI_API_KEY is not configured in server environment.");
        }
        RestClient client = RestClient.create("https://generativelanguage.googleapis.com");
        Map<String, Object> payload = Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", promptText))))
        );
        Map<String, Object> response = client.post()
            .uri("/v1beta/models/gemini-4-hydrogen:generateContent?key=" + apiKey)
            .header("User-Agent", "aistudio-build")
            .body(payload)
            .retrieve()
            .onStatus(status -> status.isError(), (req, res) -> {
                throw new org.springframework.web.server.ResponseStatusException(
                    HttpStatus.BAD_GATEWAY,
                    "AI provider returned HTTP " + res.getStatusCode().value()
                );
            })
            .body(Map.class);

        if (response == null) {
            throw new IllegalStateException("Empty response from Gemini API.");
        }
        List<Map<String, Object>> candidates = (List<Map<String, Object>>) response.get("candidates");
        if (candidates == null || candidates.isEmpty()) {
            throw new IllegalStateException("No candidates returned by Gemini API.");
        }
        Map<String, Object> content = (Map<String, Object>) candidates.get(0).get("content");
        List<Map<String, Object>> parts = (List<Map<String, Object>>) content.get("parts");
        return String.valueOf(parts.get(0).get("text"));
    }
}
