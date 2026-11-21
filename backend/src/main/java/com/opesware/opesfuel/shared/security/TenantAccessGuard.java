package com.opesware.opesfuel.shared.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
public class TenantAccessGuard {

    public static final String DEFAULT_TENANT_ID = "ten_opes_cm";

    public OpesFuelPrincipal currentPrincipal() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new AccessDeniedException("Authentication required.");
        }
        if (auth.getPrincipal() instanceof OpesFuelPrincipal principal) {
            return principal;
        }
        if (auth.getDetails() instanceof OpesFuelPrincipal principal) {
            return principal;
        }
        Set<String> roles = new HashSet<>();
        Set<String> scopes = new HashSet<>();
        for (GrantedAuthority authority : auth.getAuthorities()) {
            String a = authority.getAuthority();
            if (a != null && a.startsWith("ROLE_")) {
                roles.add(a.substring("ROLE_".length()));
            } else if (a != null && a.startsWith("SCOPE_")) {
                scopes.add(a.substring("SCOPE_".length()));
            }
        }
        String tenantId = DEFAULT_TENANT_ID;
        String auth0Sub = auth.getName();
        Set<String> stationIds = Collections.emptySet();
        if (auth.getPrincipal() instanceof Jwt jwt) {
            String claimTenant = jwt.getClaimAsString("https://opesfuel.com/tenant_id");
            if (claimTenant != null && !claimTenant.isBlank()) {
                tenantId = claimTenant.trim();
            }
            auth0Sub = jwt.getSubject();
            List<String> claimStations = jwt.getClaimAsStringList("https://opesfuel.com/station_ids");
            if (claimStations != null && !claimStations.isEmpty()) {
                stationIds = Set.copyOf(claimStations);
            }
        }
        return new OpesFuelPrincipal(
            auth.getName() != null ? auth.getName() : "unknown",
            tenantId,
            auth0Sub,
            Set.copyOf(roles),
            Set.copyOf(scopes),
            stationIds,
            false
        );
    }

    public String currentTenantId() {
        return currentPrincipal().tenantId();
    }

    public void assertTenantMatch(String resourceTenantId) {
        if (resourceTenantId == null || !currentTenantId().equals(resourceTenantId)) {
            throw new AccessDeniedException("Resource belongs to another tenant partition.");
        }
    }

    public void assertStationAccess(String stationId, String stationTenantId) {
        assertTenantMatch(stationTenantId);
        OpesFuelPrincipal principal = currentPrincipal();
        if (!principal.canAccessStation(stationId)) {
            throw new AccessDeniedException("Caller lacks station-level access to station " + stationId + ".");
        }
    }

    public void assertCanQueryAllStations() {
        OpesFuelPrincipal principal = currentPrincipal();
        if (principal.isStationRestricted()) {
            throw new AccessDeniedException("Station-scoped users cannot query stationId=ALL.");
        }
        if (!principal.apiKeyAuth()
            && !principal.hasRole("PLATFORM_ADMIN")
            && !principal.hasRole("OWNER")
            && !principal.hasRole("MANAGER")
            && !principal.hasRole("ACCOUNTANT")) {
            throw new AccessDeniedException("Only PLATFORM_ADMIN, OWNER, MANAGER, or ACCOUNTANT may query across all stations.");
        }
    }

    public void assertSelfOrManager(String employeeAuth0Sub) {
        OpesFuelPrincipal principal = currentPrincipal();
        if (principal.hasRole("PLATFORM_ADMIN") || principal.hasRole("OWNER") || principal.hasRole("MANAGER") || principal.hasScope("workforce:write")) {
            return;
        }
        if (employeeAuth0Sub == null || principal.auth0Sub() == null || !employeeAuth0Sub.equals(principal.auth0Sub())) {
            throw new AccessDeniedException("Attendants may only clock themselves in or out.");
        }
    }
}
