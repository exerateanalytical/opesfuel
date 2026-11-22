package com.opesware.opesfuel.audit;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

record RegisterIssuedDocumentCommand(
    @NotBlank String fingerprint,
    @NotBlank String docType,
    String docSerial,
    @NotBlank String organizationName,
    @NotBlank String subjectName,
    @NotBlank String sha256Hash,
    String expiresAt
) {}

record RevokeDocumentCommand(@NotBlank String reason) {}

@RestController
public class DocumentVerificationController {

    private static final int RATE_LIMIT_PER_MIN = 30;
    private final ConcurrentHashMap<String, Deque<Long>> rateLimiter = new ConcurrentHashMap<>();

    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;

    public DocumentVerificationController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    @PostMapping("/api/v1/documents/register")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> register(@Valid @RequestBody RegisterIssuedDocumentCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String fp = cmd.fingerprint().trim().toUpperCase();
        Instant now = Instant.now();
        Timestamp expiresTs = null;
        if (cmd.expiresAt() != null && !cmd.expiresAt().isBlank()) {
            try {
                String raw = cmd.expiresAt().trim();
                Instant parsed = raw.length() == 10 ? Instant.parse(raw + "T23:59:59Z") : Instant.parse(raw);
                expiresTs = Timestamp.from(parsed);
            } catch (Exception ignored) {
                expiresTs = null;
            }
        }

        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
            "SELECT fingerprint, tenant_id FROM issued_documents WHERE fingerprint = ?", fp
        );
        if (existing.isEmpty()) {
            jdbcTemplate.update(
                """
                INSERT INTO issued_documents (
                    fingerprint, tenant_id, organization_name, doc_type, doc_serial,
                    subject_name, sha256_hash, issued_by, issued_at, expires_at, revoked
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
                """,
                fp, principal.tenantId(), cmd.organizationName().trim(), cmd.docType().trim().toUpperCase(),
                cmd.docSerial() != null ? cmd.docSerial().trim() : null,
                cmd.subjectName().trim(), cmd.sha256Hash().trim(), principal.subject(),
                Timestamp.from(now), expiresTs
            );
        } else {
            accessGuard.assertTenantMatch(String.valueOf(existing.get(0).get("tenant_id")));
        }

        auditRecorder.record(
            principal.tenantId(), null, principal.subject(),
            principal.roles().stream().findFirst().orElse("OWNER"),
            "SECURITY_DOCUMENT_REGISTERED", "ISSUED_DOCUMENT", fp,
            "Registered " + cmd.docType() + " for " + cmd.subjectName() + " (" + fp + ")"
        );

        return Map.of(
            "fingerprint", fp,
            "status", "VALID",
            "verifyPath", "/#/verify/" + fp,
            "issuedAt", now.toString()
        );
    }

    @GetMapping("/api/v1/documents")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listTenantDocuments() {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        if (principal.hasRole("PLATFORM_ADMIN")) {
            return jdbcTemplate.queryForList("SELECT * FROM issued_documents ORDER BY issued_at DESC LIMIT 200");
        }
        return jdbcTemplate.queryForList(
            "SELECT * FROM issued_documents WHERE tenant_id = ? ORDER BY issued_at DESC LIMIT 200",
            principal.tenantId()
        );
    }

    @PostMapping("/api/v1/documents/{fingerprint}/revoke")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> revoke(@PathVariable String fingerprint, @Valid @RequestBody RevokeDocumentCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String fp = fingerprint.trim().toUpperCase();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT tenant_id FROM issued_documents WHERE fingerprint = ?", fp
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Issued document not found: " + fp);
        }
        if (!principal.hasRole("PLATFORM_ADMIN")) {
            accessGuard.assertTenantMatch(String.valueOf(rows.get(0).get("tenant_id")));
        }
        Instant now = Instant.now();
        jdbcTemplate.update(
            "UPDATE issued_documents SET revoked = TRUE, revoked_reason = ?, revoked_at = ? WHERE fingerprint = ?",
            cmd.reason().trim(), Timestamp.from(now), fp
        );
        auditRecorder.record(
            principal.tenantId(), null, principal.subject(),
            principal.roles().stream().findFirst().orElse("OWNER"),
            "SECURITY_DOCUMENT_REVOKED", "ISSUED_DOCUMENT", fp,
            "Revoked document " + fp + ": " + cmd.reason().trim()
        );
        return Map.of("fingerprint", fp, "status", "REVOKED", "revokedAt", now.toString(), "reason", cmd.reason().trim());
    }

    @GetMapping("/api/v1/public/verify/{fingerprint}")
    public Map<String, Object> verifyPublic(@PathVariable String fingerprint, HttpServletRequest request) {
        enforceRateLimit(request != null ? request.getRemoteAddr() : "unknown");
        String fp = fingerprint.trim().toUpperCase();
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            """
            SELECT fingerprint, organization_name, doc_type, doc_serial, subject_name,
                   issued_at, expires_at, revoked, revoked_at
            FROM issued_documents WHERE fingerprint = ?
            """,
            fp
        );
        if (rows.isEmpty()) {
            return Map.of(
                "fingerprint", fp,
                "status", "NOT_FOUND",
                "verified", false,
                "checkedAt", Instant.now().toString()
            );
        }
        Map<String, Object> row = rows.get(0);
        boolean revoked = Boolean.TRUE.equals(row.get("revoked"));
        Instant expiresAt = row.get("expires_at") instanceof Timestamp ts ? ts.toInstant() : null;
        boolean expired = expiresAt != null && Instant.now().isAfter(expiresAt);
        String status = revoked ? "REVOKED" : (expired ? "EXPIRED" : "VALID");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fingerprint", row.get("fingerprint"));
        result.put("status", status);
        result.put("verified", "VALID".equals(status));
        result.put("docType", row.get("doc_type"));
        result.put("docSerial", row.get("doc_serial"));
        result.put("organizationName", row.get("organization_name"));
        result.put("subjectName", row.get("subject_name"));
        result.put("issuedAt", row.get("issued_at") instanceof Timestamp ts ? ts.toInstant().toString() : null);
        result.put("expiresAt", expiresAt != null ? expiresAt.toString() : null);
        result.put("revokedAt", row.get("revoked_at") instanceof Timestamp ts ? ts.toInstant().toString() : null);
        result.put("checkedAt", Instant.now().toString());
        return result;
    }

    private void enforceRateLimit(String ip) {
        String key = (ip == null || ip.isBlank()) ? "anon" : ip;
        long now = System.currentTimeMillis();
        long cutoff = now - 60_000L;
        Deque<Long> q = rateLimiter.computeIfAbsent(key, k -> new ConcurrentLinkedDeque<>());
        synchronized (q) {
            while (!q.isEmpty() && q.peekFirst() < cutoff) q.pollFirst();
            if (q.size() >= RATE_LIMIT_PER_MIN) {
                throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Verification rate limit exceeded. Retry in 60 seconds.");
            }
            q.addLast(now);
        }
    }
}
