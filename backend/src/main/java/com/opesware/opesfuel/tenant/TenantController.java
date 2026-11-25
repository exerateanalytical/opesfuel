package com.opesware.opesfuel.tenant;

import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "tenants")
class TenantEntity {
    @Id
    private String id;
    @Column(nullable = false)
    private String name;
    @Column(name = "owner_email", nullable = false)
    private String ownerEmail;
    @Column(name = "default_currency", nullable = false)
    private String defaultCurrency = "FCFA";
    @Column(name = "country_code", nullable = false)
    private String countryCode = "CM";
    @Column(nullable = false)
    private String timezone = "Africa/Douala";
    @Column(nullable = false)
    private String status = "ACTIVE";
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static TenantEntity create(String id, String name, String ownerEmail, String countryCode, String timezone) {
        TenantEntity t = new TenantEntity();
        t.id = id != null && !id.isBlank() ? id : "ten_" + UUID.randomUUID();
        t.name = name.trim();
        t.ownerEmail = ownerEmail.trim().toLowerCase();
        t.defaultCurrency = "FCFA";
        t.countryCode = countryCode != null && !countryCode.isBlank() ? countryCode.trim().toUpperCase() : "CM";
        t.timezone = timezone != null && !timezone.isBlank() ? timezone.trim() : "Africa/Douala";
        t.status = "ACTIVE";
        t.createdAt = Instant.now();
        return t;
    }

    public void updateProfile(String name, String ownerEmail, String countryCode, String timezone) {
        if (name != null && !name.isBlank()) this.name = name.trim();
        if (ownerEmail != null && !ownerEmail.isBlank()) this.ownerEmail = ownerEmail.trim().toLowerCase();
        if (countryCode != null && !countryCode.isBlank()) this.countryCode = countryCode.trim().toUpperCase();
        if (timezone != null && !timezone.isBlank()) this.timezone = timezone.trim();
    }

    public void updateStatus(String nextStatus) {
        String normalized = nextStatus == null ? "" : nextStatus.trim().toUpperCase();
        if (!"ACTIVE".equals(normalized) && !"SUSPENDED".equals(normalized)) {
            throw new IllegalArgumentException("Tenant status must be ACTIVE or SUSPENDED.");
        }
        this.status = normalized;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getOwnerEmail() { return ownerEmail; }
    public String getDefaultCurrency() { return defaultCurrency; }
    public String getCountryCode() { return countryCode; }
    public String getTimezone() { return timezone; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
}

interface TenantRepository extends JpaRepository<TenantEntity, String> {}

@Service
class TenantService {
    private final TenantRepository tenantRepo;
    private final TenantAccessGuard accessGuard;
    private final JdbcTemplate jdbcTemplate;

    TenantService(TenantRepository tenantRepo, TenantAccessGuard accessGuard, JdbcTemplate jdbcTemplate) {
        this.tenantRepo = tenantRepo;
        this.accessGuard = accessGuard;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public TenantWorkspaceDto getCurrentTenant() {
        String tenantId = accessGuard.currentTenantId();
        TenantEntity tenant = tenantRepo.findById(tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Tenant workspace not found: " + tenantId));
        Integer stationCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM stations WHERE tenant_id = ?", Integer.class, tenantId
        );
        Long monthlyCommitment = jdbcTemplate.queryForObject(
            "SELECT COALESCE(SUM(monthly_fee_fcfa), 0) FROM stations WHERE tenant_id = ?", Long.class, tenantId
        );
        return new TenantWorkspaceDto(
            tenant.getId(), tenant.getName(), tenant.getOwnerEmail(),
            tenant.getDefaultCurrency(), tenant.getCountryCode(), tenant.getTimezone(),
            stationCount != null ? stationCount : 0,
            monthlyCommitment != null ? monthlyCommitment : 0L,
            tenant.getCreatedAt()
        );
    }

    @Transactional
    public TenantEntity updateCurrentTenant(UpdateTenantCommand cmd) {
        String tenantId = accessGuard.currentTenantId();
        TenantEntity tenant = tenantRepo.findById(tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Tenant workspace not found: " + tenantId));
        tenant.updateProfile(cmd.name(), cmd.ownerEmail(), cmd.countryCode(), cmd.timezone());
        return tenantRepo.save(tenant);
    }

    @Transactional
    public OnboardTenantResponse onboardTenantWorkspace(OnboardTenantCommand cmd) {
        var principal = accessGuard.currentPrincipal();
        if (!principal.hasRole("OWNER") && !principal.hasScope("platform:admin")) {
            String sub = principal.auth0Sub();
            Integer existingBindings = sub == null ? 0 : jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM employees WHERE auth0_sub = ?",
                Integer.class,
                sub
            );
            if (existingBindings != null && existingBindings > 0) {
                throw new org.springframework.security.access.AccessDeniedException(
                    "Existing non-owner staff accounts cannot provision a new SaaS tenant workspace."
                );
            }
        }
        TenantEntity tenant = tenantRepo.save(TenantEntity.create(
            null, cmd.organizationName(), cmd.ownerEmail(), cmd.countryCode(), cmd.timezone()
        ));
        String stationId = "st_" + UUID.randomUUID();
        String stationCode = cmd.stationCode().trim().toUpperCase();
        String planName = cmd.planName() != null && !cmd.planName().isBlank() ? cmd.planName().trim() : "Starter Station";
        long fee = Math.max(25_000L, cmd.monthlyFeeFcfa());
        Instant now = Instant.now();

        jdbcTemplate.update(
            "INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at) VALUES (?, ?, ?, ?, ?, 'FCFA', ?, ?, 0.1925, ?, ?)",
            stationId, tenant.getId(), stationCode, cmd.stationName().trim(), cmd.city().trim(),
            planName, fee, tenant.getTimezone(), Timestamp.from(now)
        );

        String ownerEmpId = "emp_" + UUID.randomUUID();
        jdbcTemplate.update(
            "INSERT INTO employees (id, station_id, auth0_sub, full_name, role, phone, shift_window, clocked_in, base_salary_fcfa, cumulative_variance_fcfa, version) VALUES (?, ?, ?, ?, 'OWNER', ?, '08:00 - 17:00', FALSE, 450000, 0, 0)",
            ownerEmpId, stationId, accessGuard.currentPrincipal().auth0Sub(),
            cmd.ownerName().trim(), cmd.ownerPhone() != null && !cmd.ownerPhone().isBlank() ? cmd.ownerPhone().trim() : "+237 600 00 00 00"
        );

        return new OnboardTenantResponse(tenant.getId(), tenant.getName(), stationId, stationCode, ownerEmpId, now);
    }

    @Transactional
    public Map<String, Object> resetDemoDataForCurrentTenant() {
        String tenantId = accessGuard.currentTenantId();
        List<String> stationIds = jdbcTemplate.queryForList(
            "SELECT id FROM stations WHERE tenant_id = ? ORDER BY created_at ASC", String.class, tenantId
        );
        if (stationIds.isEmpty()) {
            throw new IllegalStateException("No stations exist in tenant workspace.");
        }
        String primaryStationId = stationIds.get(0);

        for (String stId : stationIds) {
            jdbcTemplate.update("DELETE FROM journal_lines WHERE journal_entry_id IN (SELECT id FROM journal_entries WHERE station_id = ?)", stId);
            jdbcTemplate.update("DELETE FROM journal_entries WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM expenses WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM treasury_deposits WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM shop_sales WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM shop_items WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM fleet_transactions WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM shift_records WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM pumps WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM dipstick_readings WHERE tank_id IN (SELECT id FROM fuel_tanks WHERE station_id = ?)", stId);
            jdbcTemplate.update("DELETE FROM tank_deliveries WHERE tank_id IN (SELECT id FROM fuel_tanks WHERE station_id = ?)", stId);
            jdbcTemplate.update("DELETE FROM purchase_orders WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM fuel_tanks WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM attendance_logs WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM payroll_runs WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM employees WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM station_onboarding_steps WHERE station_id = ?", stId);
            jdbcTemplate.update("DELETE FROM fiscal_periods WHERE station_id = ?", stId);
            if (!stId.equals(primaryStationId)) {
                jdbcTemplate.update("DELETE FROM fuel_prices WHERE station_id = ?", stId);
                jdbcTemplate.update("DELETE FROM ai_subscriptions WHERE station_id = ?", stId);
                jdbcTemplate.update("DELETE FROM stations WHERE id = ?", stId);
            }
        }
        jdbcTemplate.update("DELETE FROM fleet_vehicles WHERE account_id IN (SELECT id FROM fleet_accounts WHERE tenant_id = ?)", tenantId);
        jdbcTemplate.update("DELETE FROM fleet_accounts WHERE tenant_id = ?", tenantId);

        return Map.of(
            "tenantId", tenantId,
            "retainedStationId", primaryStationId,
            "status", "WORKSPACE_RESET_CLEAN",
            "resetAt", Instant.now().toString()
        );
    }
}

record TenantWorkspaceDto(
    String id,
    String name,
    String ownerEmail,
    String defaultCurrency,
    String countryCode,
    String timezone,
    int stationCount,
    long monthlyCommitmentFcfa,
    Instant createdAt
) {}

record UpdateTenantCommand(String name, @Email String ownerEmail, String countryCode, String timezone) {}

record OnboardTenantCommand(
    @NotBlank String organizationName,
    @NotBlank String ownerName,
    @Email @NotBlank String ownerEmail,
    String ownerPhone,
    @NotBlank String stationCode,
    @NotBlank String stationName,
    @NotBlank String city,
    String planName,
    @Min(25000) long monthlyFeeFcfa,
    String countryCode,
    String timezone
) {}

record OnboardTenantResponse(
    String tenantId,
    String organizationName,
    String primaryStationId,
    String primaryStationCode,
    String ownerEmployeeId,
    Instant provisionedAt
) {}

@RestController
@RequestMapping("/api/v1/tenants")
public class TenantController {
    private final TenantService service;

    public TenantController(TenantService service) {
        this.service = service;
    }

    @GetMapping("/current")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_stations:read')")
    public TenantWorkspaceDto getCurrentTenant() {
        return service.getCurrentTenant();
    }

    @PatchMapping("/current")
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_stations:write')")
    public TenantEntity updateCurrentTenant(@Valid @RequestBody UpdateTenantCommand cmd) {
        return service.updateCurrentTenant(cmd);
    }

    @PostMapping("/onboard")
    @ResponseStatus(HttpStatus.CREATED)
    // Creating a company is an owner/platform action; staff, accountants and fleet clients may not provision tenants.
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER') or hasAuthority('SCOPE_platform:admin')")
    public OnboardTenantResponse onboardTenant(@Valid @RequestBody OnboardTenantCommand cmd) {
        return service.onboardTenantWorkspace(cmd);
    }

    @PostMapping("/current/reset-demo")
    @PreAuthorize("hasRole('OWNER')")
    public Map<String, Object> resetDemoWorkspace() {
        return service.resetDemoDataForCurrentTenant();
    }
}
