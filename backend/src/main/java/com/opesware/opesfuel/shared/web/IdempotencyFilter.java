package com.opesware.opesfuel.shared.web;

import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

/**
 * Atomic, per-principal, payload-hashed Idempotency-Key filter executed after authentication.
 * Prevents TOCTOU double-mutations, cross-tenant replay leaks, and silent key reuse across endpoints/payloads.
 */
public class IdempotencyFilter extends OncePerRequestFilter {

    private static final Set<String> MUTATING_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");
    private static final int MAX_KEY_LENGTH = 64;

    private final JdbcTemplate jdbcTemplate;
    private final long ttlHours;

    public IdempotencyFilter(JdbcTemplate jdbcTemplate, long ttlHours) {
        this.jdbcTemplate = jdbcTemplate;
        this.ttlHours = ttlHours > 0 ? ttlHours : 24L;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String method = request.getMethod();
        String rawKey = request.getHeader("Idempotency-Key");
        if (rawKey == null || rawKey.isBlank() || !MUTATING_METHODS.contains(method.toUpperCase())) {
            filterChain.doFilter(request, response);
            return;
        }

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getPrincipal())) {
            filterChain.doFilter(request, response);
            return;
        }

        String key = rawKey.trim();
        if (key.length() > MAX_KEY_LENGTH) {
            writeProblem(response, HttpStatus.BAD_REQUEST, "Invalid Idempotency-Key",
                "Idempotency-Key header must not exceed " + MAX_KEY_LENGTH + " characters.");
            return;
        }

        String principalId = resolvePrincipalId(auth);
        String endpoint = method.toUpperCase() + ":" + request.getRequestURI();

        CachedBodyRequestWrapper requestWrapper = new CachedBodyRequestWrapper(request);
        String requestHash = sha256(requestWrapper.getCachedBody());

        Instant now = Instant.now();
        Instant expiresAt = now.plus(ttlHours, ChronoUnit.HOURS);

        boolean reserved = tryReserveKey(key, principalId, endpoint, requestHash, now, expiresAt);
        if (!reserved) {
            List<StoredRecord> existing = jdbcTemplate.query(
                "SELECT endpoint, request_hash, response_code, response_body, status, expires_at FROM idempotency_records WHERE principal_id = ? AND idempotency_key = ?",
                (rs, rowNum) -> new StoredRecord(
                    rs.getString("endpoint"),
                    rs.getString("request_hash"),
                    rs.getInt("response_code"),
                    rs.getString("response_body"),
                    rs.getString("status"),
                    rs.getTimestamp("expires_at") != null ? rs.getTimestamp("expires_at").toInstant() : null
                ),
                principalId,
                key
            );
            if (!existing.isEmpty()) {
                StoredRecord rec = existing.get(0);
                if (rec.expiresAt() != null && rec.expiresAt().isBefore(now)) {
                    jdbcTemplate.update(
                        "DELETE FROM idempotency_records WHERE principal_id = ? AND idempotency_key = ?",
                        principalId, key
                    );
                    reserved = tryReserveKey(key, principalId, endpoint, requestHash, now, expiresAt);
                } else if ("IN_PROGRESS".equals(rec.status())) {
                    writeProblem(response, HttpStatus.CONFLICT, "Idempotent Request In Progress",
                        "A request with this Idempotency-Key is currently being processed.");
                    return;
                } else if (!endpoint.equals(rec.endpoint()) || !requestHash.equals(rec.requestHash())) {
                    writeProblem(response, HttpStatus.CONFLICT, "Idempotency-Key Reuse Conflict",
                        "Idempotency-Key was already used with a different endpoint or request payload.");
                    return;
                } else {
                    response.setStatus(rec.statusCode());
                    response.setHeader("Idempotency-Replayed", "true");
                    if (rec.body() != null && !rec.body().isEmpty()) {
                        response.setContentType("application/json");
                        response.getWriter().write(rec.body());
                    }
                    return;
                }
            }
            if (!reserved) {
                writeProblem(response, HttpStatus.CONFLICT, "Idempotency-Key Conflict",
                    "Unable to acquire idempotency lock for this key.");
                return;
            }
        }

        ContentCachingResponseWrapper responseWrapper = new ContentCachingResponseWrapper(response);
        boolean completed = false;
        try {
            filterChain.doFilter(requestWrapper, responseWrapper);
            int status = responseWrapper.getStatus();
            if (status >= 200 && status < 300) {
                String body = new String(responseWrapper.getContentAsByteArray(), StandardCharsets.UTF_8);
                jdbcTemplate.update(
                    "UPDATE idempotency_records SET response_code = ?, response_body = ?, status = 'COMPLETED' WHERE principal_id = ? AND idempotency_key = ?",
                    status, body, principalId, key
                );
                completed = true;
            }
        } finally {
            if (!completed) {
                jdbcTemplate.update(
                    "DELETE FROM idempotency_records WHERE principal_id = ? AND idempotency_key = ? AND status = 'IN_PROGRESS'",
                    principalId, key
                );
            }
            responseWrapper.copyBodyToResponse();
        }
    }

    private boolean tryReserveKey(String key, String principalId, String endpoint, String requestHash, Instant now, Instant expiresAt) {
        try {
            jdbcTemplate.update(
                "INSERT INTO idempotency_records (idempotency_key, principal_id, endpoint, request_hash, response_code, response_body, status, created_at, expires_at) VALUES (?, ?, ?, ?, 0, '', 'IN_PROGRESS', ?, ?)",
                key, principalId, endpoint, requestHash, Timestamp.from(now), Timestamp.from(expiresAt)
            );
            return true;
        } catch (DuplicateKeyException ex) {
            return false;
        }
    }

    private static String resolvePrincipalId(Authentication auth) {
        if (auth.getPrincipal() instanceof OpesFuelPrincipal p) {
            return p.tenantId() + ":" + p.principalId();
        }
        return auth.getName() != null ? auth.getName() : "authenticated";
    }

    private static void writeProblem(HttpServletResponse response, HttpStatus status, String title, String detail) throws IOException {
        response.setStatus(status.value());
        response.setContentType("application/problem+json");
        String escapedDetail = detail.replace("\"", "\\\"");
        response.getWriter().write(
            "{\"type\":\"https://api.opesfuel.com/errors/idempotency\",\"title\":\"" + title
                + "\",\"status\":" + status.value() + ",\"detail\":\"" + escapedDetail + "\"}"
        );
    }

    private static String sha256(byte[] input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(input);
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to hash request payload", ex);
        }
    }

    private record StoredRecord(String endpoint, String requestHash, int statusCode, String body, String status, Instant expiresAt) {}

    private static class CachedBodyRequestWrapper extends HttpServletRequestWrapper {
        private final byte[] cachedBody;

        CachedBodyRequestWrapper(HttpServletRequest request) throws IOException {
            super(request);
            this.cachedBody = request.getInputStream().readAllBytes();
        }

        byte[] getCachedBody() {
            return cachedBody;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream bais = new ByteArrayInputStream(cachedBody);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() { return bais.available() == 0; }
                @Override
                public boolean isReady() { return true; }
                @Override
                public void setReadListener(ReadListener readListener) {}
                @Override
                public int read() { return bais.read(); }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }
    }
}
