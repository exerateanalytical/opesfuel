package com.opesware.opesfuel.notifications;

import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

record RequestPasswordOtpCommand(@NotBlank String identifier, String channel) {}
record VerifyPasswordOtpCommand(@NotBlank String identifier, @NotBlank String code) {}

@RestController
@RequestMapping("/api/v1/public/auth")
public class PasswordResetOtpController {

    private static final SecureRandom RNG = new SecureRandom();
    private final JdbcTemplate jdbcTemplate;
    private final OutboundMessagingService messagingService;

    public PasswordResetOtpController(JdbcTemplate jdbcTemplate, OutboundMessagingService messagingService) {
        this.jdbcTemplate = jdbcTemplate;
        this.messagingService = messagingService;
    }

    @PostMapping("/request-otp")
    public Map<String, Object> requestOtp(@Valid @RequestBody RequestPasswordOtpCommand cmd) {
        String ident = cmd.identifier().trim();
        String channel = (cmd.channel() != null && !cmd.channel().isBlank())
            ? cmd.channel().trim().toUpperCase()
            : (ident.contains("@") ? "EMAIL" : "SMS");

        String otp = String.format("%06d", RNG.nextInt(1_000_000));
        String otpId = "otp_" + UUID.randomUUID().toString().substring(0, 10);
        Instant now = Instant.now();
        Instant expires = now.plusSeconds(600);

        jdbcTemplate.update(
            """
            INSERT INTO password_reset_otps (id, identifier, channel, code_hash, expires_at, consumed, attempts, created_at)
            VALUES (?, ?, ?, ?, ?, FALSE, 0, ?)
            """,
            otpId, ident.toLowerCase(), channel, sha256(otp), Timestamp.from(expires), Timestamp.from(now)
        );

        Map<String, Object> delivery = messagingService.dispatch(
            TenantAccessGuard.DEFAULT_TENANT_ID,
            "public-auth-otp",
            channel,
            ident,
            "OpesFuel Verification Code: " + otp,
            "Your OpesFuel one-time password reset code is " + otp + ". It expires in 10 minutes. Do not share this code.",
            "PASSWORD_RESET_OTP"
        );

        return Map.of(
            "otpId", otpId,
            "channel", channel,
            "deliveryStatus", delivery.get("status"),
            "provider", delivery.get("provider"),
            "expiresAt", expires.toString()
        );
    }

    @PostMapping("/verify-otp")
    public Map<String, Object> verifyOtp(@Valid @RequestBody VerifyPasswordOtpCommand cmd) {
        String ident = cmd.identifier().trim().toLowerCase();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT * FROM password_reset_otps WHERE identifier = ? AND consumed = FALSE ORDER BY created_at DESC LIMIT 1",
            ident
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No active verification code found for this account.");
        }
        Map<String, Object> row = rows.get(0);
        String id = String.valueOf(row.get("id"));
        int attempts = ((Number) row.get("attempts")).intValue();
        if (attempts >= 5) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Maximum OTP verification attempts exceeded.");
        }
        if (row.get("expires_at") instanceof Timestamp exp && Instant.now().isAfter(exp.toInstant())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Verification code has expired. Request a new code.");
        }

        if (!sha256(cmd.code().trim()).equals(String.valueOf(row.get("code_hash")))) {
            jdbcTemplate.update("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?", id);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid verification code.");
        }

        jdbcTemplate.update("UPDATE password_reset_otps SET consumed = TRUE WHERE id = ?", id);
        return Map.of(
            "verified", true,
            "identifier", ident,
            "resetToken", "rst_" + UUID.randomUUID().toString().replace("-", "")
        );
    }

    private static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
