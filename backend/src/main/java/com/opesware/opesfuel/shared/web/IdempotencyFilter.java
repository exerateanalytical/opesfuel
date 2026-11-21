package com.opesware.opesfuel.shared.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingResponseWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

@Component
public class IdempotencyFilter extends OncePerRequestFilter {

    private final JdbcTemplate jdbcTemplate;

    public IdempotencyFilter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain filterChain
    ) throws ServletException, IOException {
        String method = request.getMethod();
        String key = request.getHeader("Idempotency-Key");
        if (key == null || key.isBlank() || (!"POST".equalsIgnoreCase(method) && !"PUT".equalsIgnoreCase(method))) {
            filterChain.doFilter(request, response);
            return;
        }

        String endpoint = method + ":" + request.getRequestURI();
        List<CachedResponse> existing = jdbcTemplate.query(
            "SELECT response_code, response_body FROM idempotency_records WHERE idempotency_key = ? AND endpoint = ?",
            (rs, rowNum) -> new CachedResponse(rs.getInt("response_code"), rs.getString("response_body")),
            key.trim(),
            endpoint
        );

        if (!existing.isEmpty()) {
            CachedResponse cached = existing.get(0);
            response.setStatus(cached.status());
            response.setContentType("application/json");
            response.getWriter().write(cached.body());
            return;
        }

        ContentCachingResponseWrapper wrapper = new ContentCachingResponseWrapper(response);
        filterChain.doFilter(request, wrapper);

        int status = wrapper.getStatus();
        if (status >= 200 && status < 300) {
            String body = new String(wrapper.getContentAsByteArray(), StandardCharsets.UTF_8);
            jdbcTemplate.update(
                "INSERT INTO idempotency_records (idempotency_key, endpoint, response_code, response_body) VALUES (?, ?, ?, ?) ON CONFLICT (idempotency_key) DO NOTHING",
                key.trim(),
                endpoint,
                status,
                body
            );
        }
        wrapper.copyBodyToResponse();
    }

    private record CachedResponse(int status, String body) {}
}
