package com.opesware.opesfuel.shared.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Set;

/**
 * Authenticates tenant API keys via X-API-Key header using least-privilege SCOPE_* authorities.
 * Registered exclusively inside SecurityFilterChain (not as a global servlet filter).
 */
public class ApiKeyAuthFilter extends OncePerRequestFilter {

    private final JdbcTemplate jdbcTemplate;

    public ApiKeyAuthFilter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String apiKey = request.getHeader("X-API-Key");
        if (apiKey != null && !apiKey.isBlank() && SecurityContextHolder.getContext().getAuthentication() == null) {
            String trimmed = apiKey.trim();
            String keyHash = sha256(trimmed);
            List<ApiKeyRow> matches = jdbcTemplate.query(
                "SELECT id, tenant_id, key_prefix, scopes_csv FROM api_keys WHERE key_hash = ?",
                (rs, rowNum) -> new ApiKeyRow(
                    rs.getString("id"),
                    rs.getString("tenant_id"),
                    rs.getString("key_prefix"),
                    rs.getString("scopes_csv")
                ),
                keyHash
            );
            if (!matches.isEmpty()) {
                ApiKeyRow row = matches.get(0);
                List<SimpleGrantedAuthority> authorities = new ArrayList<>();
                Set<String> scopes = new HashSet<>();
                for (String scope : row.scopesCsv().split(",")) {
                    String s = scope.trim();
                    if (!s.isEmpty()) {
                        scopes.add(s);
                        authorities.add(new SimpleGrantedAuthority("SCOPE_" + s));
                    }
                }
                OpesFuelPrincipal principal = new OpesFuelPrincipal(
                    "api-key:" + row.id(),
                    row.tenantId() != null ? row.tenantId() : TenantAccessGuard.DEFAULT_TENANT_ID,
                    null,
                    Set.of(),
                    Set.copyOf(scopes),
                    Set.of(),
                    true
                );
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    principal,
                    null,
                    authorities
                );
                auth.setDetails(principal);
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        filterChain.doFilter(request, response);
    }

    public static String sha256(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to hash API key", ex);
        }
    }

    private record ApiKeyRow(String id, String tenantId, String keyPrefix, String scopesCsv) {}
}
