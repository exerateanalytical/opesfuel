package com.opesware.opesfuel.shared.security;

import java.util.Set;

public record OpesFuelPrincipal(
    String principalId,
    String tenantId,
    String auth0Sub,
    Set<String> roles,
    Set<String> scopes,
    Set<String> allowedStationIds,
    boolean apiKeyAuth
) {
    public boolean hasRole(String role) {
        return roles != null && roles.contains(role.toUpperCase());
    }

    public boolean hasScope(String scope) {
        return scopes != null && scopes.contains(scope);
    }

    public boolean isStationRestricted() {
        return allowedStationIds != null && !allowedStationIds.isEmpty();
    }

    public boolean canAccessStation(String stationId) {
        if (stationId == null || stationId.isBlank()) {
            return false;
        }
        if (!isStationRestricted()) {
            return true;
        }
        return allowedStationIds.contains(stationId);
    }
}
