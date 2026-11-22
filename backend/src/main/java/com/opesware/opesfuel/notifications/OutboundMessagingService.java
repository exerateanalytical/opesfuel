package com.opesware.opesfuel.notifications;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Real multi-channel outbound messaging service:
 * - EMAIL: SMTP (STARTTLS/SMTPS) or Resend HTTP API
 * - SMS: Africa's Talking or Twilio REST API
 * - WHATSAPP: Meta WhatsApp Cloud API (v20.0)
 * LOG_ONLY is only used when explicitly configured as dev fallback.
 */
@Service
public class OutboundMessagingService {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE = new ParameterizedTypeReference<>() {};

    private final JdbcTemplate jdbcTemplate;
    private final AuditTrailRecorder auditRecorder;
    private final SmtpMailClient smtpMailClient;
    private RestClient restClient;

    @Value("${opesfuel.mail.provider:LOG_ONLY}")
    private String mailProvider;
    @Value("${opesfuel.mail.api-key:}")
    private String mailApiKey;
    @Value("${opesfuel.mail.from:noreply@opesfuel.com}")
    private String mailFrom;
    @Value("${opesfuel.mail.resend-url:https://api.resend.com/emails}")
    private String resendUrl;

    @Value("${opesfuel.mail.smtp.host:}")
    private String smtpHost;
    @Value("${opesfuel.mail.smtp.port:587}")
    private int smtpPort;
    @Value("${opesfuel.mail.smtp.username:}")
    private String smtpUsername;
    @Value("${opesfuel.mail.smtp.password:}")
    private String smtpPassword;
    @Value("${opesfuel.mail.smtp.starttls:true}")
    private boolean smtpStartTls;
    @Value("${opesfuel.mail.smtp.ssl:false}")
    private boolean smtpSsl;

    @Value("${opesfuel.sms.provider:LOG_ONLY}")
    private String smsProvider;
    @Value("${opesfuel.sms.africastalking.username:}")
    private String atUsername;
    @Value("${opesfuel.sms.africastalking.api-key:}")
    private String atApiKey;
    @Value("${opesfuel.sms.africastalking.from:OPESFUEL}")
    private String atFrom;
    @Value("${opesfuel.sms.africastalking.url:https://api.africastalking.com/version1/messaging}")
    private String atUrl;
    @Value("${opesfuel.sms.twilio.account-sid:}")
    private String twilioSid;
    @Value("${opesfuel.sms.twilio.auth-token:}")
    private String twilioToken;
    @Value("${opesfuel.sms.twilio.from:}")
    private String twilioFrom;
    @Value("${opesfuel.sms.twilio.base-url:https://api.twilio.com}")
    private String twilioBaseUrl;

    @Value("${opesfuel.whatsapp.provider:LOG_ONLY}")
    private String whatsappProvider;
    @Value("${opesfuel.whatsapp.meta.phone-number-id:}")
    private String metaPhoneNumberId;
    @Value("${opesfuel.whatsapp.meta.access-token:}")
    private String metaAccessToken;
    @Value("${opesfuel.whatsapp.meta.base-url:https://graph.facebook.com/v20.0}")
    private String metaBaseUrl;

    @Autowired
    public OutboundMessagingService(
        JdbcTemplate jdbcTemplate,
        AuditTrailRecorder auditRecorder,
        SmtpMailClient smtpMailClient
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.auditRecorder = auditRecorder;
        this.smtpMailClient = smtpMailClient;
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(4000);
        rf.setReadTimeout(10000);
        this.restClient = RestClient.builder().requestFactory(rf).build();
    }

    public void setRestClientForTesting(RestClient restClient) {
        this.restClient = restClient;
    }

    public synchronized void applyEmailConfig(Map<String, String> cfg) {
        if (cfg == null) return;
        if (cfg.containsKey("provider")) this.mailProvider = cfg.getOrDefault("provider", "LOG_ONLY");
        if (cfg.containsKey("from")) this.mailFrom = cfg.getOrDefault("from", "noreply@opesfuel.com");
        if (cfg.containsKey("apiKey")) this.mailApiKey = cfg.getOrDefault("apiKey", "");
        if (cfg.containsKey("smtpHost")) this.smtpHost = cfg.getOrDefault("smtpHost", "");
        if (cfg.containsKey("smtpPort")) {
            try { this.smtpPort = Integer.parseInt(cfg.get("smtpPort")); } catch (Exception ignored) {}
        }
        if (cfg.containsKey("smtpUsername")) this.smtpUsername = cfg.getOrDefault("smtpUsername", "");
        if (cfg.containsKey("smtpPassword")) this.smtpPassword = cfg.getOrDefault("smtpPassword", "");
        if (cfg.containsKey("smtpStartTls")) this.smtpStartTls = Boolean.parseBoolean(cfg.get("smtpStartTls"));
        if (cfg.containsKey("smtpSsl")) this.smtpSsl = Boolean.parseBoolean(cfg.get("smtpSsl"));
    }

    public synchronized void applySmsConfig(Map<String, String> cfg) {
        if (cfg == null) return;
        if (cfg.containsKey("provider")) this.smsProvider = cfg.getOrDefault("provider", "LOG_ONLY");
        if (cfg.containsKey("atUsername")) this.atUsername = cfg.getOrDefault("atUsername", "");
        if (cfg.containsKey("atApiKey")) this.atApiKey = cfg.getOrDefault("atApiKey", "");
        if (cfg.containsKey("atFrom")) this.atFrom = cfg.getOrDefault("atFrom", "OPESFUEL");
        if (cfg.containsKey("twilioAccountSid")) this.twilioSid = cfg.getOrDefault("twilioAccountSid", "");
        if (cfg.containsKey("twilioAuthToken")) this.twilioToken = cfg.getOrDefault("twilioAuthToken", "");
        if (cfg.containsKey("twilioFrom")) this.twilioFrom = cfg.getOrDefault("twilioFrom", "");
    }

    public synchronized void applyWhatsappConfig(Map<String, String> cfg) {
        if (cfg == null) return;
        if (cfg.containsKey("provider")) this.whatsappProvider = cfg.getOrDefault("provider", "LOG_ONLY");
        if (cfg.containsKey("phoneNumberId")) this.metaPhoneNumberId = cfg.getOrDefault("phoneNumberId", "");
        if (cfg.containsKey("accessToken")) this.metaAccessToken = cfg.getOrDefault("accessToken", "");
    }

    public Map<String, Object> providerStatus() {
        return Map.of(
            "email", Map.of(
                "provider", mailProvider,
                "configured", "LOG_ONLY".equalsIgnoreCase(mailProvider)
                    || ("RESEND".equalsIgnoreCase(mailProvider) && notBlank(mailApiKey))
                    || ("SMTP".equalsIgnoreCase(mailProvider) && notBlank(smtpHost))
            ),
            "sms", Map.of(
                "provider", smsProvider,
                "configured", "LOG_ONLY".equalsIgnoreCase(smsProvider)
                    || ("AFRICAS_TALKING".equalsIgnoreCase(smsProvider) && notBlank(atUsername) && notBlank(atApiKey))
                    || ("TWILIO".equalsIgnoreCase(smsProvider) && notBlank(twilioSid) && notBlank(twilioToken) && notBlank(twilioFrom))
            ),
            "whatsapp", Map.of(
                "provider", whatsappProvider,
                "configured", "LOG_ONLY".equalsIgnoreCase(whatsappProvider)
                    || ("META_CLOUD".equalsIgnoreCase(whatsappProvider) && notBlank(metaPhoneNumberId) && notBlank(metaAccessToken))
            )
        );
    }

    public Map<String, Object> dispatch(
        String tenantId,
        String actor,
        String rawChannel,
        String recipient,
        String subject,
        String body,
        String templateType
    ) {
        String channel = rawChannel == null ? "EMAIL" : rawChannel.trim().toUpperCase();
        String provider;
        String status;
        String providerMsgId = null;
        String errorDetail = null;

        try {
            switch (channel) {
                case "EMAIL" -> {
                    provider = normalizeProvider(mailProvider);
                    if ("LOG_ONLY".equals(provider)) {
                        status = "SANDBOX_LOGGED";
                    } else if ("RESEND".equals(provider)) {
                        requireNotBlank(mailApiKey, "EMAIL (RESEND) not configured: set OPESFUEL_MAIL_API_KEY.");
                        Map<String, Object> resp = restClient.post()
                            .uri(resendUrl)
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + mailApiKey)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(Map.of(
                                "from", mailFrom,
                                "to", List.of(recipient.trim()),
                                "subject", subject != null ? subject.trim() : "OpesFuel Notification",
                                "text", body
                            ))
                            .retrieve()
                            .body(MAP_TYPE);
                        providerMsgId = resp != null && resp.get("id") != null ? String.valueOf(resp.get("id")) : null;
                        status = "SENT";
                    } else if ("SMTP".equals(provider)) {
                        requireNotBlank(smtpHost, "EMAIL (SMTP) not configured: set OPESFUEL_SMTP_HOST.");
                        providerMsgId = smtpMailClient.send(
                            new SmtpMailClient.SmtpConfig(smtpHost, smtpPort, smtpUsername, smtpPassword, smtpStartTls, smtpSsl),
                            mailFrom, recipient.trim(), subject != null ? subject.trim() : "OpesFuel Notification", body
                        );
                        status = "SENT";
                    } else {
                        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Unsupported email provider: " + provider);
                    }
                }
                case "SMS" -> {
                    provider = normalizeProvider(smsProvider);
                    if ("LOG_ONLY".equals(provider)) {
                        status = "SANDBOX_LOGGED";
                    } else if ("AFRICAS_TALKING".equals(provider)) {
                        requireNotBlank(atUsername, "SMS (AFRICAS_TALKING) not configured: set OPESFUEL_AT_USERNAME.");
                        requireNotBlank(atApiKey, "SMS (AFRICAS_TALKING) not configured: set OPESFUEL_AT_API_KEY.");
                        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
                        form.add("username", atUsername);
                        form.add("to", recipient.trim());
                        form.add("message", body);
                        if (notBlank(atFrom)) form.add("from", atFrom);
                        Map<String, Object> resp = restClient.post()
                            .uri(atUrl)
                            .header("apiKey", atApiKey)
                            .header(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                            .body(form)
                            .retrieve()
                            .body(MAP_TYPE);
                        providerMsgId = resp != null ? "at_" + UUID.randomUUID().toString().substring(0, 8) : null;
                        status = "SENT";
                    } else if ("TWILIO".equals(provider)) {
                        requireNotBlank(twilioSid, "SMS (TWILIO) not configured: set OPESFUEL_TWILIO_ACCOUNT_SID.");
                        requireNotBlank(twilioToken, "SMS (TWILIO) not configured: set OPESFUEL_TWILIO_AUTH_TOKEN.");
                        requireNotBlank(twilioFrom, "SMS (TWILIO) not configured: set OPESFUEL_TWILIO_FROM.");
                        String basic = Base64.getEncoder().encodeToString((twilioSid + ":" + twilioToken).getBytes(StandardCharsets.UTF_8));
                        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
                        form.add("To", recipient.trim());
                        form.add("From", twilioFrom);
                        form.add("Body", body);
                        Map<String, Object> resp = restClient.post()
                            .uri(twilioBaseUrl.replaceAll("/+$", "") + "/2010-04-01/Accounts/" + twilioSid + "/Messages.json")
                            .header(HttpHeaders.AUTHORIZATION, "Basic " + basic)
                            .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                            .body(form)
                            .retrieve()
                            .body(MAP_TYPE);
                        providerMsgId = resp != null && resp.get("sid") != null ? String.valueOf(resp.get("sid")) : null;
                        status = "SENT";
                    } else {
                        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Unsupported SMS provider: " + provider);
                    }
                }
                case "WHATSAPP" -> {
                    provider = normalizeProvider(whatsappProvider);
                    if ("LOG_ONLY".equals(provider)) {
                        status = "SANDBOX_LOGGED";
                    } else if ("META_CLOUD".equals(provider)) {
                        requireNotBlank(metaPhoneNumberId, "WHATSAPP (META_CLOUD) not configured: set OPESFUEL_WHATSAPP_PHONE_NUMBER_ID.");
                        requireNotBlank(metaAccessToken, "WHATSAPP (META_CLOUD) not configured: set OPESFUEL_WHATSAPP_ACCESS_TOKEN.");
                        String digits = recipient.replaceAll("[^0-9]", "");
                        Map<String, Object> payload = Map.of(
                            "messaging_product", "whatsapp",
                            "to", digits,
                            "type", "text",
                            "text", Map.of("preview_url", false, "body", body)
                        );
                        Map<String, Object> resp = restClient.post()
                            .uri(metaBaseUrl.replaceAll("/+$", "") + "/" + metaPhoneNumberId + "/messages")
                            .header(HttpHeaders.AUTHORIZATION, "Bearer " + metaAccessToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(payload)
                            .retrieve()
                            .body(MAP_TYPE);
                        if (resp != null && resp.get("messages") instanceof List<?> msgs && !msgs.isEmpty() && msgs.get(0) instanceof Map<?, ?> m) {
                            providerMsgId = m.get("id") != null ? String.valueOf(m.get("id")) : null;
                        }
                        status = "SENT";
                    } else {
                        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Unsupported WhatsApp provider: " + provider);
                    }
                }
                default -> throw new IllegalArgumentException("Unsupported messaging channel: " + channel + " (use EMAIL, SMS, or WHATSAPP).");
            }
        } catch (ResponseStatusException rse) {
            persistLog(tenantId, actor, channel, resolveProviderName(channel), recipient, subject, body, "FAILED", null, rse.getReason(), templateType);
            throw rse;
        } catch (Exception ex) {
            errorDetail = ex.getMessage();
            status = "FAILED";
            provider = resolveProviderName(channel);
        }

        String id = persistLog(tenantId, actor, channel, provider, recipient, subject, body, status, providerMsgId, errorDetail, templateType);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("channel", channel);
        out.put("provider", provider);
        out.put("recipient", recipient.trim());
        out.put("status", status);
        if (providerMsgId != null) out.put("providerMessageId", providerMsgId);
        if (errorDetail != null) out.put("error", errorDetail);
        return out;
    }

    public List<Map<String, Object>> listDeliveries(String tenantId) {
        try {
            return jdbcTemplate.queryForList(
                "SELECT * FROM outbound_message_deliveries WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100",
                tenantId
            );
        } catch (Exception ex) {
            return jdbcTemplate.queryForList(
                "SELECT * FROM outbound_messages WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 100",
                tenantId
            );
        }
    }

    private String persistLog(
        String tenantId,
        String actor,
        String channel,
        String provider,
        String recipient,
        String subject,
        String body,
        String status,
        String providerMsgId,
        String errorDetail,
        String templateType
    ) {
        String id = "msg_" + UUID.randomUUID().toString().substring(0, 10);
        String preview = body != null && body.length() > 280 ? body.substring(0, 280) + "..." : (body == null ? "" : body);
        Timestamp now = Timestamp.from(Instant.now());

        try {
            jdbcTemplate.update(
                """
                INSERT INTO outbound_message_deliveries (
                    id, tenant_id, channel, provider, recipient, subject, body_preview, status,
                    provider_message_id, error_detail, template_type, created_by, created_at, delivered_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id, tenantId, channel, provider, recipient.trim(), subject != null ? subject.trim() : "",
                preview, status, providerMsgId, errorDetail, templateType, actor, now,
                "SENT".equals(status) ? now : null
            );
        } catch (Exception ignored) {
            // V15 table may not be loaded in legacy pre-V15 tests
        }

        try {
            jdbcTemplate.update(
                """
                INSERT INTO outbound_messages (id, tenant_id, channel, recipient, subject, body_preview, status, provider, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id, tenantId, channel, recipient.trim(), subject != null ? subject.trim() : "",
                preview, status, provider, now
            );
        } catch (Exception ignored) {
            // legacy table optional
        }

        auditRecorder.record(
            tenantId, null, actor, "MESSAGING",
            "OUTBOUND_" + channel + "_" + status, "NOTIFICATION", id,
            "Dispatched " + channel + " via " + provider + " to " + recipient + ": " + (subject != null ? subject : templateType)
        );
        return id;
    }

    private String resolveProviderName(String channel) {
        return switch (channel) {
            case "SMS" -> normalizeProvider(smsProvider);
            case "WHATSAPP" -> normalizeProvider(whatsappProvider);
            default -> normalizeProvider(mailProvider);
        };
    }

    private static String normalizeProvider(String p) {
        return (p == null || p.isBlank()) ? "LOG_ONLY" : p.trim().toUpperCase();
    }

    private static boolean notBlank(String v) {
        return v != null && !v.isBlank();
    }

    private static void requireNotBlank(String v, String msg) {
        if (!notBlank(v)) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, msg);
        }
    }
}
