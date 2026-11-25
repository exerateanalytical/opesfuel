package com.opesware.opesfuel.shared.security;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ClaimsEnrichingJwtConverterTest {

    private static Jwt jwt(Map<String, Object> claims) {
        Jwt.Builder b = Jwt.withTokenValue("t").header("alg", "RS256").issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).subject("kc-1");
        claims.forEach(b::claim);
        return b.build();
    }

    @Test
    void addsClaimsFromVerifiedEmail() {
        IdentityClaimsService svc = mock(IdentityClaimsService.class);
        when(svc.resolve("a@b.com", "kc-1", true)).thenReturn(Map.of("tenant_id", "ten_x", "roles", List.of("OWNER"), "station_ids", List.of()));
        var c = new ClaimsEnrichingJwtConverter(svc, new JwtAuthenticationConverter());
        Jwt out = c.enrich(jwt(Map.of("email", "a@b.com", "email_verified", true)));
        assertEquals("ten_x", out.getClaimAsString("https://opesfuel.com/tenant_id"));
        assertEquals(List.of("OWNER"), out.getClaimAsStringList("https://opesfuel.com/roles"));
    }

    @Test
    void leavesTokenWithoutTenantWhenUnknown() {
        IdentityClaimsService svc = mock(IdentityClaimsService.class);
        when(svc.resolve(any(), any(), any())).thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN));
        Jwt out = new ClaimsEnrichingJwtConverter(svc, new JwtAuthenticationConverter()).enrich(jwt(Map.of("email", "x@y.com", "email_verified", false)));
        assertNull(out.getClaimAsString("https://opesfuel.com/tenant_id"));
    }

    @Test
    void passesThroughTokensThatAlreadyCarryClaims() {
        IdentityClaimsService svc = mock(IdentityClaimsService.class);
        Jwt in = jwt(Map.of("https://opesfuel.com/tenant_id", "ten_y"));
        assertSame(in, new ClaimsEnrichingJwtConverter(svc, new JwtAuthenticationConverter()).enrich(in));
        verifyNoInteractions(svc);
    }
}
