package com.opesware.opesfuel.identity;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

record UpdateProfileCommand(
    @NotBlank String fullName,
    String phone,
    @NotBlank String preferredLanguage,
    boolean emailAlertsEnabled
) {}

@RestController
@RequestMapping("/api/v1/identity")
public class UserProfileController {
    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;

    public UserProfileController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping("/accounts")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listTenantAccounts() {
        String tenantId = accessGuard.currentTenantId();
        return jdbcTemplate.query(
            "SELECT * FROM user_accounts WHERE tenant_id = ? ORDER BY role, full_name",
            (rs, idx) -> Map.<String, Object>ofEntries(
                Map.entry("id", rs.getString("id")),
                Map.entry("fullName", rs.getString("full_name")),
                Map.entry("email", rs.getString("email")),
                Map.entry("phone", rs.getString("phone") != null ? rs.getString("phone") : ""),
                Map.entry("role", rs.getString("role")),
                Map.entry("assignedStationId", rs.getString("assigned_station_id") != null ? rs.getString("assigned_station_id") : "ALL"),
                Map.entry("preferredLanguage", rs.getString("preferred_language")),
                Map.entry("emailAlertsEnabled", rs.getBoolean("email_alerts_enabled")),
                Map.entry("status", rs.getString("status"))
            ),
            tenantId
        );
    }

    @GetMapping("/profile")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> getProfile() {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String role = principal.roles().stream().findFirst().orElse("OWNER");
        List<Map<String, Object>> rows = jdbcTemplate.query(
            "SELECT * FROM user_accounts WHERE tenant_id = ? AND (auth0_sub = ? OR role = ?) LIMIT 1",
            (rs, idx) -> Map.<String, Object>ofEntries(
                Map.entry("id", rs.getString("id")),
                Map.entry("fullName", rs.getString("full_name")),
                Map.entry("email", rs.getString("email")),
                Map.entry("phone", rs.getString("phone") != null ? rs.getString("phone") : ""),
                Map.entry("role", rs.getString("role")),
                Map.entry("preferredLanguage", rs.getString("preferred_language")),
                Map.entry("emailAlertsEnabled", rs.getBoolean("email_alerts_enabled")),
                Map.entry("status", rs.getString("status"))
            ),
            principal.tenantId(), principal.auth0Sub(), role
        );
        if (!rows.isEmpty()) {
            return rows.get(0);
        }
        return Map.of(
            "id", "usr_current",
            "fullName", principal.subject(),
            "email", principal.subject(),
            "phone", "",
            "role", role,
            "preferredLanguage", "en",
            "emailAlertsEnabled", true,
            "status", "ACTIVE"
        );
    }

    @PatchMapping("/profile")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> updateProfile(@Valid @RequestBody UpdateProfileCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String lang = "fr".equalsIgnoreCase(cmd.preferredLanguage()) ? "fr" : "en";
        String role = principal.roles().stream().findFirst().orElse("OWNER");
        jdbcTemplate.update(
            """
            UPDATE user_accounts
            SET full_name = ?, phone = ?, preferred_language = ?, email_alerts_enabled = ?
            WHERE tenant_id = ? AND (auth0_sub = ? OR role = ?)
            """,
            cmd.fullName().trim(), cmd.phone(), lang, cmd.emailAlertsEnabled(),
            principal.tenantId(), principal.auth0Sub(), role
        );
        auditRecorder.record(
            principal.tenantId(), null, principal.subject(), role,
            "PROFILE_UPDATED", "USER_ACCOUNT", principal.subject(),
            "Updated profile settings (language=" + lang + ", emailAlerts=" + cmd.emailAlertsEnabled() + ")"
        );
        return Map.of(
            "fullName", cmd.fullName().trim(),
            "phone", cmd.phone() != null ? cmd.phone() : "",
            "preferredLanguage", lang,
            "emailAlertsEnabled", cmd.emailAlertsEnabled()
        );
    }
}
