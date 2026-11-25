package com.opesware.opesfuel;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.http.HttpMethod;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Role matrix: every secured endpoint is called as every role. A role that the endpoint's @PreAuthorize rule does not
 * list must be refused (403). Responses that happen before authorization (validation 400/415/422) are inconclusive,
 * never counted as a pass. Anything else (2xx, 404, 409, 5xx) for a forbidden role is a RBAC violation.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RbacMatrixTests {

    private static final List<String> ROLES = List.of("OWNER", "MANAGER", "ATTENDANT", "ACCOUNTANT", "GROUP_CFO", "FLEET_CLIENT");
    private static final Pattern SIMPLE_RULE = Pattern.compile("^\\s*(?:has(?:Any)?Role\\([^)]*\\)|hasAuthority\\('[^']*'\\))(?:\\s+or\\s+(?:has(?:Any)?Role\\([^)]*\\)|hasAuthority\\('[^']*'\\)))*\\s*$");
    private static final Pattern ROLE_NAME = Pattern.compile("'([A-Z_]+)'");

    @Autowired @org.springframework.beans.factory.annotation.Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping mapping;
    @Autowired MockMvc mvc;

    private static String rule(HandlerMethod hm) {
        PreAuthorize pa = AnnotatedElementUtils.findMergedAnnotation(hm.getMethod(), PreAuthorize.class);
        if (pa == null) pa = AnnotatedElementUtils.findMergedAnnotation(hm.getBeanType(), PreAuthorize.class);
        return pa == null ? null : pa.value();
    }

    private static Set<String> allowedRoles(String rule) {
        Set<String> out = new HashSet<>();
        Matcher m = ROLE_NAME.matcher(rule);
        while (m.find()) out.add(m.group(1));
        if (out.contains("PLATFORM_ADMIN")) out.add("OWNER");      // role hierarchy: PLATFORM_ADMIN implies OWNER (not the reverse)
        return out;
    }

    @Test
    void everyRoleIsRefusedWhereTheRuleDoesNotListIt() throws Exception {
        int endpoints = 0, checks = 0, refused = 0, inconclusive = 0;
        List<String> violations = new ArrayList<>(), unchecked = new ArrayList<>();
        for (Map.Entry<RequestMappingInfo, HandlerMethod> e : mapping.getHandlerMethods().entrySet()) {
            HandlerMethod hm = e.getValue();
            if (!hm.getBeanType().getName().startsWith("com.opesware")) continue;
            String rule = rule(hm);
            Set<String> paths = e.getKey().getPathPatternsCondition().getPatternValues();
            Set<org.springframework.web.bind.annotation.RequestMethod> methods = e.getKey().getMethodsCondition().getMethods();
            for (String path : paths) {
                if (path.contains("/public/") || path.startsWith("/api/v1/billing/plans") || path.contains("institutional-fuels")
                    || path.contains("/docs") || path.contains("openapi") || path.equals("/error") || path.contains("/billing/enterprise-licenses")) continue;
                for (var rm : methods.isEmpty() ? EnumSet.of(org.springframework.web.bind.annotation.RequestMethod.GET) : methods) {
                    endpoints++;
                    String label = rm + " " + path + " (" + hm.getBeanType().getSimpleName() + "." + hm.getMethod().getName() + ")";
                    if (rule == null) { unchecked.add(label + " [NO RULE]"); continue; }
                    if (!SIMPLE_RULE.matcher(rule).matches()) { unchecked.add(label + " [complex rule: " + rule + "]"); continue; }
                    Set<String> allowed = allowedRoles(rule);
                    for (String role : ROLES) {
                        if (allowed.contains(role)) continue;
                        checks++;
                        int status = mvc.perform(request(HttpMethod.valueOf(rm.name()), path.replaceAll("\\{[^}]+}", "x"))
                                .contentType("application/json").content("{}")
                                .with(jwt().jwt(j -> j.subject("auth0|matrix_" + role)
                                        .claim("https://opesfuel.com/roles", List.of(role))
                                        .claim("https://opesfuel.com/tenant_id", "ten_opes_cm"))
                                    .authorities(new SimpleGrantedAuthority("ROLE_" + role))))
                            .andReturn().getResponse().getStatus();
                        if (status == 403) refused++;
                        else if (status == 400 || status == 405 || status == 406 || status == 415 || status == 422) inconclusive++;
                        else violations.add(label + " as " + role + " -> HTTP " + status + "  rule: " + rule);
                    }
                }
            }
        }
        System.out.println("RBAC MATRIX: endpoints=" + endpoints + " forbidden-role checks=" + checks + " refused(403)=" + refused
            + " inconclusive(validation first)=" + inconclusive + " violations=" + violations.size() + " unchecked=" + unchecked.size());
        unchecked.forEach(u -> System.out.println("RBAC UNCHECKED: " + u));
        violations.forEach(v -> System.out.println("RBAC VIOLATION: " + v));
        assertTrue(violations.isEmpty(), "RBAC violations:\n" + String.join("\n", violations));
    }
}
