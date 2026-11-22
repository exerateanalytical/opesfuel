package com.opesware.opesfuel.tenant;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

record UpdatePlatformSettingsCmd(
    @Positive double xafPerUsdRate,
    @Min(0) int defaultTrialDays,
    @Min(0) int gracePeriodDays,
    boolean selfSignupEnabled,
    boolean maintenanceMode,
    String maintenanceBanner,
    @Min(0) long aiAddonMonthlyFcfa,
    @Min(0) long perpetualLicenseAnnualFcfa
) {}

record UpsertPlatformPlanCmd(
    @NotBlank String planCode,
    @NotBlank String planName,
    @Min(0) long monthlyPriceFcfa,
    @Min(0) double monthlyPriceUsd,
    @Min(1) int maxStations,
    @Min(1) int maxPumps,
    @Min(0) int trialDays,
    boolean active
) {}

record UpdateTenantFeatureFlagsCmd(
    boolean aiCopilotEnabled,
    boolean hardwareBridgeEnabled,
    boolean ocppEvEnabled,
    boolean b2bWholesaleEnabled,
    boolean franchiseModeEnabled,
    boolean whiteLabelBrandingEnabled,
    Long customMonthlyOverrideFcfa
) {}

record ResolveOperatorIdentifierCmd(@NotBlank String identifier) {}

@RestController
@RequestMapping("/api/v1/platform-admin/governance")
public class PlatformAdminGovernanceController {
    private static final String SETTINGS_ID = "global";

    private final JdbcTemplate jdbc;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder audit;

    public PlatformAdminGovernanceController(
        JdbcTemplate jdbc,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder audit
    ) {
        this.jdbc = jdbc;
        this.accessGuard = accessGuard;
        this.audit = audit;
    }

    @GetMapping("/settings")
    @PreAuthorize("hasRole('PLATFORM_ADMIN') or hasAuthority('SCOPE_platform:admin')")
    public Map<String, Object> getGlobalSettings() {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM platform_global_settings WHERE id = ?",
            SETTINGS_ID
        );
        if (rows.isEmpty()) {
            Map<String, Object> defaults = new LinkedHashMap<>();
            defaults.put("xafPerUsdRate", 605.0);
            defaults.put("defaultTrialDays", 14);
            defaults.put("gracePeriodDays", 7);
            defaults.put("selfSignupEnabled", true);
            defaults.put("maintenanceMode", false);
            defaults.put("maintenanceBanner", "");
            defaults.put("aiAddonMonthlyFcfa", 30000L);
            defaults.put("perpetualLicenseAnnualFcfa", 5000000L);
            return defaults;
        }
        Map<String, Object> r = rows.get(0);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("xafPerUsdRate", r.get("xaf_per_usd_rate"));
        out.put("defaultTrialDays", r.get("default_trial_days"));
        out.put("gracePeriodDays", r.get("grace_period_days"));
        out.put("selfSignupEnabled", r.get("self_signup_enabled"));
        out.put("maintenanceMode", r.get("maintenance_mode"));
        out.put("maintenanceBanner", r.get("maintenance_banner"));
        out.put("aiAddonMonthlyFcfa", r.get("ai_addon_monthly_fcfa"));
        out.put("perpetualLicenseAnnualFcfa", r.get("perpetual_license_annual_fcfa"));
        out.put("updatedBy", r.get("updated_by"));
        out.put("updatedAt", r.get("updated_at"));
        return out;
    }

    @PutMapping("/settings")
    @PreAuthorize("hasRole('PLATFORM_ADMIN') or hasAuthority('SCOPE_platform:admin')")
    @Transactional
    public Map<String, Object> updateGlobalSettings(@Valid @RequestBody UpdatePlatformSettingsCmd cmd) {
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        Timestamp now = Timestamp.from(Instant.now());
        Integer exists = jdbc.queryForObject(
            "SELECT COUNT(*) FROM platform_global_settings WHERE id = ?",
            Integer.class, SETTINGS_ID
        );
        if (exists != null && exists > 0) {
            jdbc.update("""
                UPDATE platform_global_settings SET
                    xaf_per_usd_rate = ?, default_trial_days = ?, grace_period_days = ?,
                    self_signup_enabled = ?, maintenance_mode = ?, maintenance_banner = ?,
                    ai_addon_monthly_fcfa = ?, perpetual_license_annual_fcfa = ?,
                    updated_by = ?, updated_at = ?
                WHERE id = ?
                """,
                cmd.xafPerUsdRate(), cmd.defaultTrialDays(), cmd.gracePeriodDays(),
                cmd.selfSignupEnabled(), cmd.maintenanceMode(), cmd.maintenanceBanner() != null ? cmd.maintenanceBanner() : "",
                cmd.aiAddonMonthlyFcfa(), cmd.perpetualLicenseAnnualFcfa(),
                actor.subject(), now, SETTINGS_ID
            );
        } else {
            jdbc.update("""
                INSERT INTO platform_global_settings (
                    id, xaf_per_usd_rate, default_trial_days, grace_period_days,
                    self_signup_enabled, maintenance_mode, maintenance_banner,
                    ai_addon_monthly_fcfa, perpetual_license_annual_fcfa, updated_by, updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
                """,
                SETTINGS_ID, cmd.xafPerUsdRate(), cmd.defaultTrialDays(), cmd.gracePeriodDays(),
                cmd.selfSignupEnabled(), cmd.maintenanceMode(), cmd.maintenanceBanner() != null ? cmd.maintenanceBanner() : "",
                cmd.aiAddonMonthlyFcfa(), cmd.perpetualLicenseAnnualFcfa(), actor.subject(), now
            );
        }
        audit.record("PLATFORM", null, actor.subject(), actor.roles().toString(),
            "PLATFORM_SETTINGS_UPDATED", "PLATFORM_SETTINGS", SETTINGS_ID,
            "Updated global FX=" + cmd.xafPerUsdRate() + ", maintenance=" + cmd.maintenanceMode() + ", selfSignup=" + cmd.selfSignupEnabled());
        return getGlobalSettings();
    }

    @GetMapping("/plans")
    @PreAuthorize("hasRole('PLATFORM_ADMIN') or hasAuthority('SCOPE_platform:admin')")
    public List<Map<String, Object>> listPlatformPlans() {
        return jdbc.queryForList("SELECT * FROM platform_subscription_plans ORDER BY monthly_price_fcfa ASC");
    }

    @PutMapping("/plans")
    @PreAuthorize("hasRole('PLATFORM_ADMIN') or hasAuthority('SCOPE_platform:admin')")
    @Transactional
    public Map<String, Object> upsertPlatformPlan(@Valid @RequestBody UpsertPlatformPlanCmd cmd) {
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        String code = cmd.planCode().trim().toLowerCase();
        Timestamp now = Timestamp.from(Instant.now());
        Integer exists = jdbc.queryForObject(
            "SELECT COUNT(*) FROM platform_subscription_plans WHERE plan_code = ?",
            Integer.class, code
        );
        if (exists != null && exists > 0) {
            jdbc.update("""
                UPDATE platform_subscription_plans SET
                    plan_name = ?, monthly_price_fcfa = ?, monthly_price_usd = ?,
                    max_stations = ?, max_pumps = ?, trial_days = ?, active = ?, updated_at = ?
                WHERE plan_code = ?
                """,
                cmd.planName().trim(), cmd.monthlyPriceFcfa(), cmd.monthlyPriceUsd(),
                cmd.maxStations(), cmd.maxPumps(), cmd.trialDays(), cmd.active(), now, code
            );
        } else {
            jdbc.update("""
                INSERT INTO platform_subscription_plans (
                    plan_code, plan_name, monthly_price_fcfa, monthly_price_usd,
                    max_stations, max_pumps, trial_days, active, updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?)
                """,
                code, cmd.planName().trim(), cmd.monthlyPriceFcfa(), cmd.monthlyPriceUsd(),
                cmd.maxStations(), cmd.maxPumps(), cmd.trialDays(), cmd.active(), now
            );
        }
        audit.record("PLATFORM", null, actor.subject(), actor.roles().toString(),
            "SAAS_PLAN_PRICE_UPDATED", "SAAS_PLAN", code,
            cmd.planName() + " = " + cmd.monthlyPriceFcfa() + " FCFA / $" + cmd.monthlyPriceUsd() + " USD");
        return Map.of(
            "planCode", code,
            "planName", cmd.planName().trim(),
            "monthlyPriceFcfa", cmd.monthlyPriceFcfa(),
            "monthlyPriceUsd", cmd.monthlyPriceUsd(),
            "active", cmd.active()
        );
    }

    @GetMapping("/tenants/{tenantId}/features")
    @PreAuthorize("hasRole('PLATFORM_ADMIN') or hasAuthority('SCOPE_platform:admin')")
    public Map<String, Object> getTenantFeatures(@PathVariable String tenantId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM tenant_feature_flags WHERE tenant_id = ?",
            tenantId
        );
        if (rows.isEmpty()) {
            Map<String, Object> def = new LinkedHashMap<>();
            def.put("tenantId", tenantId);
            def.put("aiCopilotEnabled", true);
            def.put("hardwareBridgeEnabled", true);
            def.put("ocppEvEnabled", true);
            def.put("b2bWholesaleEnabled", true);
            def.put("franchiseModeEnabled", false);
            def.put("whiteLabelBrandingEnabled", true);
            def.put("customMonthlyOverrideFcfa", null);
            return def;
        }
        Map<String, Object> r = rows.get(0);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tenantId", tenantId);
        out.put("aiCopilotEnabled", r.get("ai_copilot_enabled"));
        out.put("hardwareBridgeEnabled", r.get("hardware_bridge_enabled"));
        out.put("ocppEvEnabled", r.get("ocpp_ev_enabled"));
        out.put("b2bWholesaleEnabled", r.get("b2b_wholesale_enabled"));
        out.put("franchiseModeEnabled", r.get("franchise_mode_enabled"));
        out.put("whiteLabelBrandingEnabled", r.get("white_label_branding_enabled"));
        out.put("customMonthlyOverrideFcfa", r.get("custom_monthly_override_fcfa"));
        return out;
    }

    @PatchMapping("/tenants/{tenantId}/features")
    @PreAuthorize("hasRole('PLATFORM_ADMIN') or hasAuthority('SCOPE_platform:admin')")
    @Transactional
    public Map<String, Object> updateTenantFeatures(
        @PathVariable String tenantId,
        @Valid @RequestBody UpdateTenantFeatureFlagsCmd cmd
    ) {
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        Timestamp now = Timestamp.from(Instant.now());
        Integer exists = jdbc.queryForObject(
            "SELECT COUNT(*) FROM tenant_feature_flags WHERE tenant_id = ?",
            Integer.class, tenantId
        );
        if (exists != null && exists > 0) {
            jdbc.update("""
                UPDATE tenant_feature_flags SET
                    ai_copilot_enabled = ?, hardware_bridge_enabled = ?, ocpp_ev_enabled = ?,
                    b2b_wholesale_enabled = ?, franchise_mode_enabled = ?, white_label_branding_enabled = ?,
                    custom_monthly_override_fcfa = ?, updated_by = ?, updated_at = ?
                WHERE tenant_id = ?
                """,
                cmd.aiCopilotEnabled(), cmd.hardwareBridgeEnabled(), cmd.ocppEvEnabled(),
                cmd.b2bWholesaleEnabled(), cmd.franchiseModeEnabled(), cmd.whiteLabelBrandingEnabled(),
                cmd.customMonthlyOverrideFcfa(), actor.subject(), now, tenantId
            );
        } else {
            jdbc.update("""
                INSERT INTO tenant_feature_flags (
                    tenant_id, ai_copilot_enabled, hardware_bridge_enabled, ocpp_ev_enabled,
                    b2b_wholesale_enabled, franchise_mode_enabled, white_label_branding_enabled,
                    custom_monthly_override_fcfa, updated_by, updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?)
                """,
                tenantId, cmd.aiCopilotEnabled(), cmd.hardwareBridgeEnabled(), cmd.ocppEvEnabled(),
                cmd.b2bWholesaleEnabled(), cmd.franchiseModeEnabled(), cmd.whiteLabelBrandingEnabled(),
                cmd.customMonthlyOverrideFcfa(), actor.subject(), now
            );
        }
        audit.record("PLATFORM", null, actor.subject(), actor.roles().toString(),
            "TENANT_FEATURE_FLAGS_UPDATED", "TENANT", tenantId,
            "Updated feature entitlements & custom override=" + cmd.customMonthlyOverrideFcfa());
        return getTenantFeatures(tenantId);
    }

    @PostMapping("/directory/resolve")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> resolveOperatorIdentifier(@Valid @RequestBody ResolveOperatorIdentifierCmd cmd) {
        String raw = cmd.identifier().trim();
        String normLower = raw.toLowerCase();
        String normUpper = raw.toUpperCase();
        String normPhone = raw.replaceAll("[\\s\\-()]", "");
        List<Map<String, Object>> rows = jdbc.queryForList("""
            SELECT member_id, email, phone_number, full_name, role, station_id, tenant_id, active
            FROM operator_directory_credentials
            WHERE LOWER(email) = ? OR UPPER(member_id) = ? OR REPLACE(REPLACE(REPLACE(phone_number, ' ', ''), '-', ''), '(', '') = ?
            LIMIT 1
            """,
            normLower, normUpper, normPhone
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No operator account matched that email, phone number, or Member ID.");
        }
        Map<String, Object> r = rows.get(0);
        if (!Boolean.TRUE.equals(r.get("active"))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Operator account is suspended.");
        }
        return Map.of(
            "memberId", r.get("member_id"),
            "email", r.get("email"),
            "phoneNumber", r.get("phone_number"),
            "fullName", r.get("full_name"),
            "role", r.get("role"),
            "tenantId", r.get("tenant_id")
        );
    }
}
