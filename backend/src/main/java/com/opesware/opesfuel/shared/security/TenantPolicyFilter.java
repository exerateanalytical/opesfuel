package com.opesware.opesfuel.shared.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * SaaS policy gate, applied after authentication:
 *  1. Public demo tenant is READ-ONLY (visitors can browse, never change or delete).
 *  2. Suspended tenants are blocked entirely (billing pages stay reachable so they can pay).
 *  3. Expired trials / restricted billing become READ-ONLY (402) until payment.
 * PLATFORM_ADMIN is never blocked. Tenant state is cached briefly to avoid a DB hit per request.
 */
public class TenantPolicyFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(TenantPolicyFilter.class);
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");
    private static final Set<String> LOCKED_BILLING = Set.of("RESTRICTED", "CANCELLED", "EXPIRED");
    private static final long CACHE_MS = 30_000L;

    private record TenantState(String status, String billingStatus, Instant trialEndsAt, long loadedAt) {}

    private final JdbcTemplate jdbc;
    private final TenantAccessGuard guard;
    private final String demoTenantId;
    private final boolean demoReadOnly;
    private final boolean enforceBilling;
    private final ConcurrentHashMap<String, TenantState> cache = new ConcurrentHashMap<>();

    public TenantPolicyFilter(JdbcTemplate jdbc, TenantAccessGuard guard,
                              String demoTenantId, boolean demoReadOnly, boolean enforceBilling) {
        this.jdbc = jdbc;
        this.guard = guard;
        this.demoTenantId = demoTenantId;
        this.demoReadOnly = demoReadOnly;
        this.enforceBilling = enforceBilling;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            chain.doFilter(request, response);
            return;
        }
        OpesFuelPrincipal principal;
        try {
            principal = guard.currentPrincipal();
        } catch (RuntimeException e) {
            chain.doFilter(request, response); // controllers/guards will reject (e.g. missing tenant claim)
            return;
        }
        if (principal.hasRole("PLATFORM_ADMIN")) {
            chain.doFilter(request, response);
            return;
        }
        String tenantId = principal.tenantId();
        boolean write = !SAFE_METHODS.contains(request.getMethod().toUpperCase());
        String path = request.getRequestURI();

        if (demoReadOnly && tenantId != null && tenantId.equals(demoTenantId) && write) {
            deny(response, 403, "DEMO_READ_ONLY",
                "This is a read-only demo workspace. Start a free trial to create and edit your own data.");
            return;
        }
        if (enforceBilling && tenantId != null && !tenantId.equals(demoTenantId) && !path.startsWith("/api/v1/billing/")) {
            TenantState st = load(tenantId);
            if (st != null) {
                if ("SUSPENDED".equalsIgnoreCase(st.status())) {
                    deny(response, 403, "TENANT_SUSPENDED",
                        "This workspace is suspended. Contact OpesFuel support or settle your subscription.");
                    return;
                }
                boolean locked = isWriteLocked(st.billingStatus(), st.trialEndsAt(), Instant.now());
                if (locked && write) {
                    deny(response, 402, "SUBSCRIPTION_REQUIRED",
                        "Your trial or subscription has ended. Your data is safe and read-only; subscribe to resume editing.");
                    return;
                }
            }
        }
        chain.doFilter(request, response);
    }

    /** Single definition of "this company can only read": used by the filter and by the subscription-status endpoint. */
    public static boolean isWriteLocked(String billingStatus, Instant trialEndsAt, Instant now) {
        String b = String.valueOf(billingStatus).toUpperCase();
        return LOCKED_BILLING.contains(b) || ("TRIAL".equals(b) && trialEndsAt != null && trialEndsAt.isBefore(now));
    }

    private TenantState load(String tenantId) {
        TenantState cached = cache.get(tenantId);
        long now = System.currentTimeMillis();
        if (cached != null && now - cached.loadedAt() < CACHE_MS) {
            return cached;
        }
        try {
            TenantState fresh = jdbc.query(
                "SELECT status, billing_status, trial_ends_at FROM tenants WHERE id = ?",
                rs -> {
                    if (!rs.next()) return null;
                    Timestamp t = rs.getTimestamp("trial_ends_at");
                    return new TenantState(rs.getString("status"), rs.getString("billing_status"),
                        t != null ? t.toInstant() : null, now);
                }, tenantId);
            if (fresh != null) cache.put(tenantId, fresh);
            return fresh;
        } catch (RuntimeException e) {
            log.warn("Tenant policy lookup failed for {}: {}", tenantId, e.getMessage());
            return cached;
        }
    }

    private static void deny(HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType("application/json");
        String safe = message.replace("\"", "'");
        // ProblemDetail-compatible (detail/title/status) so the website and mobile app show it like any other API error
        response.getWriter().write("{\"error\":\"" + code + "\",\"title\":\"" + code + "\",\"status\":" + status + ",\"detail\":\"" + safe + "\",\"message\":\"" + safe + "\"}");
    }
}
