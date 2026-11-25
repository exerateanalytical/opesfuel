package com.opesware.opesfuel.shared.security;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves the OpesFuel identity (tenant, roles, stations) for a signed-in person from {@code user_accounts},
 * keyed by their <b>verified</b> e-mail address. Shared by the Auth0 post-login Action endpoint
 * ({@code POST /api/v1/public/auth/identity-claims}) and by token enrichment for identity providers that cannot
 * call that endpoint (e.g. Keycloak), so both paths apply exactly the same rules.
 */
@Service
public class IdentityClaimsService {

    private final JdbcTemplate jdbc;

    public IdentityClaimsService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * @return {@code tenant_id}, {@code roles} (one element) and {@code station_ids}.
     * @throws ResponseStatusException 403 when the e-mail is not verified, 404 when no active account exists.
     */
    @Transactional
    public Map<String, Object> resolve(String rawEmail, String sub, Boolean emailVerified) {
        if (!Boolean.TRUE.equals(emailVerified)) { // never trust an unverified email (account-takeover guard)
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email must be verified.");
        }
        if (rawEmail == null || rawEmail.isBlank()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Email is required.");
        }
        String email = rawEmail.trim().toLowerCase();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT id, tenant_id, auth0_sub, role, assigned_station_id FROM user_accounts WHERE LOWER(email) = ? AND status = 'ACTIVE' ORDER BY created_at ASC",
            email);
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No workspace for this email.");
        }
        Map<String, Object> row = rows.get(0);
        if (sub != null && !sub.isBlank() && String.valueOf(row.get("auth0_sub")).startsWith("pending|")) {
            jdbc.update("UPDATE user_accounts SET auth0_sub = ? WHERE id = ?", sub, row.get("id"));
            // Invited staff: tie the login to their employee record (so the mobile app finds "me") and close the invitation.
            jdbc.update("""
                UPDATE employees SET auth0_sub = ?
                WHERE id IN (SELECT employee_id FROM user_invites
                             WHERE LOWER(email) = ? AND tenant_id = ? AND employee_id IS NOT NULL AND status = 'PENDING')
                """, sub, email, row.get("tenant_id"));
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
}
