package com.opesware.opesfuel.tenant;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Public self-service onboarding.
 *  POST /api/v1/public/auth/signup           -> creates company + first station + OWNER + 14-day trial.
 *  POST /api/v1/public/auth/identity-claims  -> called by the Auth0 post-login Action to stamp tenant_id / roles /
 *                                               station_ids into the token (shared-secret protected, verified email only).
 * Passwords never touch this API: Auth0 owns credentials; this API owns tenancy.
 */
@RestController
@RequestMapping("/api/v1/public/auth")
public class SelfSignupController {

    private static final int TRIAL_DAYS = 14;
    private static final int MAX_SIGNUPS_PER_IP_PER_HOUR = 5;
    private static final int MAX_SIGNUPS_GLOBAL_PER_HOUR = 200;

    private final JdbcTemplate jdbc;
    private final AuditTrailRecorder audit;
    private final String actionSecret;
    private final Map<String, Deque<Long>> ipHits = new ConcurrentHashMap<>();
    private final Deque<Long> globalHits = new ArrayDeque<>();

    public SelfSignupController(JdbcTemplate jdbc, AuditTrailRecorder audit,
                                @Value("${opesfuel.auth0.action-secret:}") String actionSecret) {
        this.jdbc = jdbc;
        this.audit = audit;
        this.actionSecret = actionSecret;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public Map<String, Object> signup(@Valid @RequestBody SelfSignupCommand cmd, HttpServletRequest request) {
        if (cmd.website() != null && !cmd.website().isBlank()) { // honeypot: humans leave it empty
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid signup request.");
        }
        throttle(clientIp(request));

        String email = cmd.email().trim().toLowerCase();
        // Resume instead of blocking: a workspace whose owner never signed in yet (login not linked) belongs to nobody
        // until the verified email holder logs in, so re-submitting simply refreshes its details. This neutralises
        // email squatting without exposing anything: access is still gated by a verified-email login.
        List<Map<String, Object>> pending = jdbc.queryForList(
            "SELECT id, tenant_id, assigned_station_id FROM user_accounts WHERE LOWER(email) = ? AND auth0_sub LIKE 'pending|%' AND role = 'OWNER'", email);
        if (!pending.isEmpty()) {
            Map<String, Object> row = pending.get(0);
            String tid = String.valueOf(row.get("tenant_id"));
            jdbc.update("UPDATE tenants SET name = ? WHERE id = ?", cmd.companyName().trim(), tid);
            jdbc.update("UPDATE user_accounts SET full_name = ?, phone = ? WHERE id = ?",
                cmd.ownerName().trim(), cmd.phone() != null ? cmd.phone().trim() : null, row.get("id"));
            Map<String, Object> resumed = new LinkedHashMap<>();
            resumed.put("tenantId", tid);
            resumed.put("stationId", row.get("assigned_station_id"));
            resumed.put("resumed", true);
            resumed.put("nextStep", "SIGN_IN_WITH_VERIFIED_EMAIL");
            resumed.put("message", "Your workspace is ready. Sign in with " + email + " (verify your email) to continue your trial.");
            return resumed;
        }
        Integer existing = jdbc.queryForObject(
            "SELECT (SELECT COUNT(*) FROM tenants WHERE LOWER(owner_email) = ?) + (SELECT COUNT(*) FROM user_accounts WHERE LOWER(email) = ?)",
            Integer.class, email, email);
        if (existing != null && existing > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "An account already exists for this email. Sign in instead, or contact support.");
        }

        String company = cmd.companyName().trim();
        String tenantId = "ten_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String stationId = "st_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String userId = "usr_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String stationCode = "OPF-" + UUID.randomUUID().toString().substring(0, 5).toUpperCase();
        String country = cmd.countryCode() != null && !cmd.countryCode().isBlank() ? cmd.countryCode().trim().toUpperCase() : "CM";
        String city = cmd.city() != null && !cmd.city().isBlank() ? cmd.city().trim() : "Douala";
        Timestamp now = Timestamp.from(Instant.now());
        Instant trialEnds = Instant.now().plus(TRIAL_DAYS, ChronoUnit.DAYS);

        jdbc.update("""
            INSERT INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, trial_ends_at, max_pumps, created_at, billing_status)
            VALUES (?, ?, ?, 'FCFA', ?, 'Africa/Douala', 'ACTIVE', ?, 6, ?, 'TRIAL')
            """, tenantId, company, email, country, Timestamp.from(trialEnds), now);
        jdbc.update("""
            INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            VALUES (?, ?, ?, ?, ?, 'FCFA', 'Starter Station', 25000, 0.1925, 'Africa/Douala', ?)
            """, stationId, tenantId, stationCode, company + " Main Station", city, now);
        jdbc.update("""
            INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, phone, role, assigned_station_id, preferred_language, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'OWNER', ?, 'en', 'ACTIVE', ?)
            """, userId, tenantId, "pending|" + userId, cmd.ownerName().trim(), email,
            cmd.phone() != null ? cmd.phone().trim() : null, stationId, now);
        try {
            jdbc.update("""
                INSERT INTO tenant_feature_flags (tenant_id, ai_copilot_enabled, hardware_bridge_enabled, ocpp_ev_enabled, b2b_wholesale_enabled, franchise_mode_enabled, white_label_branding_enabled, updated_by, updated_at)
                VALUES (?, TRUE, TRUE, TRUE, TRUE, FALSE, TRUE, 'self-signup', CURRENT_TIMESTAMP)
                """, tenantId);
        } catch (org.springframework.dao.DataAccessException ignored) {
            // feature-flag table defaults apply when no row exists
        }
        audit.record(tenantId, stationId, email, "OWNER", "TENANT_SELF_SIGNUP", "TENANT", tenantId,
            "Self-service signup for " + company + " (" + TRIAL_DAYS + "-day trial)");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tenantId", tenantId);
        out.put("stationId", stationId);
        out.put("trialEndsAt", trialEnds.toString());
        out.put("nextStep", "SIGN_IN_WITH_VERIFIED_EMAIL");
        out.put("message", "Workspace created. Sign in with " + email + " (verify your email) to start your trial.");
        return out;
    }

    @PostMapping("/identity-claims")
    public Map<String, Object> identityClaims(
        @RequestHeader(value = "X-Auth0-Action-Secret", required = false) String secret,
        @Valid @RequestBody IdentityClaimsRequest req) {
        if (actionSecret == null || actionSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Identity claims endpoint is not configured.");
        }
        if (secret == null || !MessageDigest.isEqual(secret.getBytes(StandardCharsets.UTF_8), actionSecret.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid action secret.");
        }
        if (!Boolean.TRUE.equals(req.emailVerified())) { // never trust an unverified email (account-takeover guard)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email must be verified.");
        }
        String email = req.email().trim().toLowerCase();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, tenant_id, auth0_sub, role, assigned_station_id FROM user_accounts WHERE LOWER(email) = ? AND status = 'ACTIVE' ORDER BY created_at ASC",
            email);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No workspace for this email.");
        }
        Map<String, Object> row = rows.get(0);
        if (req.sub() != null && !req.sub().isBlank() && String.valueOf(row.get("auth0_sub")).startsWith("pending|")) {
            jdbc.update("UPDATE user_accounts SET auth0_sub = ? WHERE id = ?", req.sub(), row.get("id"));
            // Invited staff: tie the login to their employee record (so the mobile app finds "me") and close the invitation.
            jdbc.update("""
                UPDATE employees SET auth0_sub = ?
                WHERE id IN (SELECT employee_id FROM user_invites
                             WHERE LOWER(email) = ? AND tenant_id = ? AND employee_id IS NOT NULL AND status = 'PENDING')
                """, req.sub(), email, row.get("tenant_id"));
            jdbc.update("UPDATE user_invites SET status = 'ACCEPTED', accepted_at = CURRENT_TIMESTAMP WHERE LOWER(email) = ? AND tenant_id = ? AND status = 'PENDING'",
                email, row.get("tenant_id"));
        }
        Object station = row.get("assigned_station_id");
        String role = String.valueOf(row.get("role")).toUpperCase();
        boolean restricted = !role.equals("OWNER") && !role.equals("PLATFORM_ADMIN") && !role.equals("GROUP_CFO");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tenant_id", row.get("tenant_id"));
        out.put("roles", List.of(role));
        out.put("station_ids", restricted && station != null ? List.of(String.valueOf(station)) : List.of());
        return out;
    }

    private String clientIp(HttpServletRequest request) {
        String fwd = request.getHeader("X-Forwarded-For");
        if (fwd != null && !fwd.isBlank()) return fwd.split(",")[0].trim();
        return request.getRemoteAddr();
    }

    private void throttle(String ip) {
        long now = System.currentTimeMillis();
        long cutoff = now - 3_600_000L;
        Deque<Long> hits = ipHits.computeIfAbsent(ip, k -> new ArrayDeque<>());
        synchronized (hits) {
            while (!hits.isEmpty() && hits.peekFirst() < cutoff) hits.pollFirst();
            if (hits.size() >= MAX_SIGNUPS_PER_IP_PER_HOUR) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many signups from this network. Try again later.");
            }
            hits.addLast(now);
        }
        synchronized (globalHits) {
            while (!globalHits.isEmpty() && globalHits.peekFirst() < cutoff) globalHits.pollFirst();
            if (globalHits.size() >= MAX_SIGNUPS_GLOBAL_PER_HOUR) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Signup is temporarily busy. Try again shortly.");
            }
            globalHits.addLast(now);
        }
    }
}

record SelfSignupCommand(
    @NotBlank @Size(max = 120) String companyName,
    @NotBlank @Size(max = 120) String ownerName,
    @NotBlank @Email @Size(max = 180) String email,
    @Size(max = 40) String phone,
    @Size(max = 8) String countryCode,
    @Size(max = 80) String city,
    String website
) {}

record IdentityClaimsRequest(@NotBlank @Email String email, String sub, Boolean emailVerified) {}
