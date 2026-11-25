package com.opesware.opesfuel.shared.security;

import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

/**
 * Tokens from identity providers that cannot stamp OpesFuel claims themselves (e.g. the self-hosted Keycloak) arrive
 * without {@code https://opesfuel.com/tenant_id}. For those, the identity is resolved from the verified e-mail with the
 * same rules as the Auth0 Action endpoint, and the claims are added before the normal role conversion runs.
 * Tokens that already carry the claims are passed through untouched. Unknown/unverified people get no tenant claim,
 * so the tenant guard keeps failing closed.
 */
public class ClaimsEnrichingJwtConverter implements Converter<Jwt, AbstractAuthenticationToken> {
    private static final String NS = "https://opesfuel.com/";
    private final IdentityClaimsService identityClaims;
    private final JwtAuthenticationConverter delegate;

    public ClaimsEnrichingJwtConverter(IdentityClaimsService identityClaims, JwtAuthenticationConverter delegate) {
        this.identityClaims = identityClaims;
        this.delegate = delegate;
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        return delegate.convert(enrich(jwt));
    }

    Jwt enrich(Jwt jwt) {
        if (jwt.getClaims().containsKey(NS + "tenant_id")) return jwt;
        Map<String, Object> resolved;
        try {
            resolved = identityClaims.resolve(jwt.getClaimAsString("email"), jwt.getSubject(), jwt.getClaimAsBoolean("email_verified"));
        } catch (ResponseStatusException e) {
            return jwt; // no workspace / unverified: leave claims absent (fail closed downstream)
        }
        return Jwt.withTokenValue(jwt.getTokenValue())
            .headers(h -> h.putAll(jwt.getHeaders()))
            .claims(c -> {
                c.putAll(jwt.getClaims());
                c.put(NS + "tenant_id", resolved.get("tenant_id"));
                c.put(NS + "roles", resolved.get("roles"));
                c.put(NS + "station_ids", resolved.get("station_ids"));
            })
            .build();
    }
}
