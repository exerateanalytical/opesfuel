package com.opesware.opesfuel.shared.security;

import com.opesware.opesfuel.shared.web.IdempotencyFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.access.expression.method.MethodSecurityExpressionHandler;
import org.springframework.security.access.hierarchicalroles.RoleHierarchy;
import org.springframework.security.access.hierarchicalroles.RoleHierarchyImpl;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Value("${opesfuel.cors.allowed-origins:http://localhost:3000,http://localhost:8081}")
    private List<String> allowedOrigins;

    @Value("${opesfuel.idempotency.ttl-hours:24}")
    private long idempotencyTtlHours;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http, JdbcTemplate jdbcTemplate) throws Exception {
        ApiKeyAuthFilter apiKeyAuthFilter = new ApiKeyAuthFilter(jdbcTemplate);
        FleetPortalAuthFilter fleetPortalAuthFilter = new FleetPortalAuthFilter(jdbcTemplate);
        IdempotencyFilter idempotencyFilter = new IdempotencyFilter(jdbcTemplate, idempotencyTtlHours);

        http
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    HttpMethod.GET,
                    "/api/v1/billing/plans",
                    "/api/v1/billing/enterprise-licenses",
                    "/api/v1/catalog/institutional-fuels",
                    "/api/v1/public/verify/**",
                    "/api/v1/public/loyalty/pass/**",
                    "/api/v1/openapi.json",
                    "/api/v1/docs/**"
                ).permitAll()
                .requestMatchers(
                    HttpMethod.POST,
                    "/api/v1/public/leads",
                    "/api/v1/public/webhooks/payments/**",
                    "/api/v1/public/webhooks/momo/**",
                    "/api/v1/public/auth/**",
                    "/api/v1/public/fleet-portal/login",
                    "/api/v1/public/edge/**"
                ).permitAll()
                .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(apiKeyAuthFilter, BearerTokenAuthenticationFilter.class)
            .addFilterBefore(fleetPortalAuthFilter, BearerTokenAuthenticationFilter.class)
            .addFilterAfter(idempotencyFilter, BearerTokenAuthenticationFilter.class)
            .oauth2ResourceServer(oauth2 -> oauth2
                .jwt(jwt -> jwt.jwtAuthenticationConverter(auth0RoleConverter()))
            );
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(allowedOrigins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type", "Idempotency-Key", "X-API-Key", "X-Fleet-Token", "X-Edge-Key"));
        config.setExposedHeaders(List.of("Idempotency-Replayed"));
        config.setAllowCredentials(true);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/v1/**", config);
        return source;
    }

    @Bean
    public JwtAuthenticationConverter auth0RoleConverter() {
        JwtAuthenticationConverter converter = new JwtAuthenticationConverter();
        converter.setJwtGrantedAuthoritiesConverter(jwt -> {
            List<String> roles = jwt.getClaimAsStringList("https://opesfuel.com/roles");
            if (roles == null || roles.isEmpty()) {
                roles = List.of("ATTENDANT");
            }
            Collection<GrantedAuthority> authorities = roles.stream()
                .map(role -> new SimpleGrantedAuthority("ROLE_" + role.trim().toUpperCase()))
                .collect(Collectors.toList());
            return authorities;
        });
        return converter;
    }

    @Bean
    public RoleHierarchy roleHierarchy() {
        return RoleHierarchyImpl.withDefaultRolePrefix()
            .role("PLATFORM_ADMIN").implies("OWNER")
            .build();
    }

    @Bean
    public MethodSecurityExpressionHandler methodSecurityExpressionHandler(RoleHierarchy roleHierarchy) {
        DefaultMethodSecurityExpressionHandler handler = new DefaultMethodSecurityExpressionHandler();
        handler.setRoleHierarchy(roleHierarchy);
        return handler;
    }
}
