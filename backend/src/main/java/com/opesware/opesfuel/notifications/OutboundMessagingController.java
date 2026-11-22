package com.opesware.opesfuel.notifications;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

record SendOutboundMessageCommand(
    @NotBlank String channel,
    @NotBlank String recipient,
    @NotBlank String subject,
    @NotBlank String body
) {}

@RestController
@RequestMapping("/api/v1/notifications/outbound")
public class OutboundMessagingController {
    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;
    private final HttpClient httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(4)).build();

    @Value("${opesfuel.mail.provider:LOG_ONLY}")
    private String mailProvider;

    @Value("${opesfuel.mail.api-key:}")
    private String mailApiKey;

    @Value("${opesfuel.mail.from:noreply@opesfuel.com}")
    private String mailFrom;

    public OutboundMessagingController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listOutbound() {
        String tenantId = accessGuard.currentTenantId();
        return jdbcTemplate.query(
            "SELECT * FROM outbound_messages WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100",
            (rs, idx) -> Map.<String, Object>of(
                "id", rs.getString("id"),
                "channel", rs.getString("channel"),
                "recipient", rs.getString("recipient"),
                "subject", rs.getString("subject"),
                "bodyPreview", rs.getString("body_preview"),
                "status", rs.getString("status"),
                "provider", rs.getString("provider"),
                "createdAt", rs.getTimestamp("created_at").toInstant().toString()
            ),
            tenantId
        );
    }

    @PostMapping("/send")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> send(@Valid @RequestBody SendOutboundMessageCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String channel = cmd.channel().trim().toUpperCase();
        String status = "SANDBOX_LOGGED";
        String usedProvider = mailProvider != null ? mailProvider : "LOG_ONLY";

        if ("EMAIL".equals(channel) && "RESEND".equalsIgnoreCase(usedProvider) && mailApiKey != null && !mailApiKey.isBlank()) {
            try {
                String json = "{\"from\":\"" + escape(mailFrom) + "\",\"to\":[\"" + escape(cmd.recipient())
                    + "\"],\"subject\":\"" + escape(cmd.subject()) + "\",\"text\":\"" + escape(cmd.body()) + "\"}";
                HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create("https://api.resend.com/emails"))
                    .timeout(Duration.ofSeconds(6))
                    .header("Authorization", "Bearer " + mailApiKey)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(json))
                    .build();
                HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
                status = (resp.statusCode() >= 200 && resp.statusCode() < 300) ? "SENT" : "FAILED";
            } catch (Exception ex) {
                status = "FAILED";
            }
        }

        String id = "msg_" + UUID.randomUUID().toString().substring(0, 10);
        String preview = cmd.body().length() > 280 ? cmd.body().substring(0, 280) + "..." : cmd.body();
        jdbcTemplate.update(
            """
            INSERT INTO outbound_messages (id, tenant_id, channel, recipient, subject, body_preview, status, provider, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id, principal.tenantId(), channel, cmd.recipient().trim(), cmd.subject().trim(),
            preview, status, usedProvider, Timestamp.from(Instant.now())
        );

        auditRecorder.record(
            principal.tenantId(), null, principal.subject(),
            principal.roles().stream().findFirst().orElse("OWNER"),
            "OUTBOUND_" + channel + "_" + status, "NOTIFICATION", id,
            "Dispatched " + channel + " to " + cmd.recipient() + ": " + cmd.subject()
        );

        return Map.of("id", id, "channel", channel, "recipient", cmd.recipient(), "status", status, "provider", usedProvider);
    }

    private String escape(String v) {
        return v == null ? "" : v.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n");
    }
}
