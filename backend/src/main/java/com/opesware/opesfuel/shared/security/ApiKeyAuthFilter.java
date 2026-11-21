package com.opesware.opesfuel.shared.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;

@Component
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
            String keyHash = sha256(apiKey.trim());
            List<String> scopesList = jdbcTemplate.query(
                "SELECT scopes_csv FROM api_keys WHERE key_hash = ?",
                (rs, rowNum) -> rs.getString("scopes_csv"),
                keyHash
            );
            if (!scopesList.isEmpty()) {
                List<SimpleGrantedAuthority> authorities = new ArrayList<>();
                authorities.add(new SimpleGrantedAuthority("ROLE_OWNER"));
                for (String scope : scopesList.get(0).split(",")) {
                    if (!scope.isBlank()) {
                        authorities.add(new SimpleGrantedAuthority("SCOPE_" + scope.trim()));
                    }
                }
                UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                    "api-key:" + apiKey.substring(0, Math.min(apiKey.length(), 15)),
                    null,
                    authorities
                );
                SecurityContextHolder.getContext().setAuthentication(auth);
            }
        }
        filterChain.doFilter(request, response);
    }

    private static String sha256(String input) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to hash API key", ex);
        }
    }
}
