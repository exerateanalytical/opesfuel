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
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Authenticates B2B Corporate Fleet Client Self-Service Portal sessions (X-Fleet-Token or Bearer fltp_...).
 * Strictly binds principal to ROLE_FLEET_CLIENT, tenantId, and fleetAccountId (stored in allowedStationIds slot).
 */
public class FleetPortalAuthFilter extends OncePerRequestFilter {

    public static final String FLEET_TOKEN_PREFIX = "fltp_";
    public static final String REQUEST_ATTR_FLEET_ACCOUNT_ID = "opesfuel.fleetAccountId";

    private final JdbcTemplate jdbcTemplate;

    public FleetPortalAuthFilter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
        throws ServletException, IOException {

        if (SecurityContextHolder.getContext().getAuthentication() == null) {
            String rawToken = request.getHeader("X-Fleet-Token");
            if (rawToken == null || rawToken.isBlank()) {
                String authHeader = request.getHeader("Authorization");
                if (authHeader != null && authHeader.startsWith("Bearer " + FLEET_TOKEN_PREFIX)) {
                    rawToken = authHeader.substring("Bearer ".length()).trim();
                }
            }

            if (rawToken != null && rawToken.startsWith(FLEET_TOKEN_PREFIX)) {
                try {
                    String hash = sha256(rawToken);
                    List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                        "SELECT user_id, tenant_id, fleet_account_id, email, expires_at FROM fleet_portal_sessions WHERE token_hash = ?",
                        hash
                    );
                    if (!rows.isEmpty()) {
                        Map<String, Object> s = rows.get(0);
                        Timestamp exp = (Timestamp) s.get("expires_at");
                        if (exp != null && Instant.now().isBefore(exp.toInstant())) {
                            String tenantId = String.valueOf(s.get("tenant_id"));
                            String fleetAccountId = String.valueOf(s.get("fleet_account_id"));
                            String email = String.valueOf(s.get("email"));
                            request.setAttribute(REQUEST_ATTR_FLEET_ACCOUNT_ID, fleetAccountId);

                            OpesFuelPrincipal principal = new OpesFuelPrincipal(
                                email,
                                tenantId,
                                String.valueOf(s.get("user_id")),
                                Set.of("FLEET_CLIENT"),
                                Set.of("fleet-portal:read", "fleet-portal:write"),
                                Set.of(fleetAccountId),
                                false
                            );
                            UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                principal,
                                null,
                                List.of(new SimpleGrantedAuthority("ROLE_FLEET_CLIENT"))
                            );
                            auth.setDetails(principal);
                            SecurityContextHolder.getContext().setAuthentication(auth);
                        }
                    }
                } catch (Exception ignored) {
                    // Leave unauthenticated if table absent or token invalid
                }
            }
        }
        filterChain.doFilter(request, response);
    }

    public static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
