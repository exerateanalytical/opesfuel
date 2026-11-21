package com.opesware.opesfuel.tenant;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
class PlatformAdminService {
    private static final Set<String> VALID_LEAD_STATUSES = Set.of(
        "RECEIVED", "CONTACTED", "QUALIFIED", "CONVERTED", "ARCHIVED"
    );

    private final TenantRepository tenantRepo;
    private final JdbcTemplate jdbcTemplate;

    PlatformAdminService(TenantRepository tenantRepo, JdbcTemplate jdbcTemplate) {
        this.tenantRepo = tenantRepo;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public PlatformAdminOverviewDto getOverview() {
        long totalTenants = countQuery("SELECT COUNT(*) FROM tenants");
        long activeTenants = countQuery("SELECT COUNT(*) FROM tenants WHERE status = 'ACTIVE'");
        long suspendedTenants = countQuery("SELECT COUNT(*) FROM tenants WHERE status = 'SUSPENDED'");
        long totalStations = countQuery("SELECT COUNT(*) FROM stations");
        long stationMrrFcfa = sumQuery("SELECT COALESCE(SUM(monthly_fee_fcfa), 0) FROM stations");
        long activeAiAddons = countQuery("SELECT COUNT(*) FROM ai_subscriptions WHERE active = TRUE");
        long aiMrrFcfa = sumQuery("SELECT COALESCE(SUM(monthly_fee_fcfa), 0) FROM ai_subscriptions WHERE active = TRUE");
        long totalBilledFcfa = sumQuery("SELECT COALESCE(SUM(total_fcfa), 0) FROM billing_invoices WHERE status <> 'VOID'");
        long totalCollectedFcfa = sumQuery("SELECT COALESCE(SUM(amount_fcfa), 0) FROM billing_payments");
        long openLeadsCount = countQuery("SELECT COUNT(*) FROM demo_leads WHERE status IN ('RECEIVED', 'CONTACTED', 'QUALIFIED')");
        long totalEmployees = countQuery("SELECT COUNT(*) FROM employees");

        return new PlatformAdminOverviewDto(
            totalTenants,
            activeTenants,
            suspendedTenants,
            totalStations,
            stationMrrFcfa + aiMrrFcfa,
            stationMrrFcfa,
            aiMrrFcfa,
            activeAiAddons,
            totalBilledFcfa,
            totalCollectedFcfa,
            Math.max(0L, totalBilledFcfa - totalCollectedFcfa),
            openLeadsCount,
            totalEmployees,
            Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public List<PlatformTenantSummaryDto> listAllTenants() {
        List<TenantEntity> tenants = tenantRepo.findAll();
        return tenants.stream()
            .sorted((a, b) -> b.getCreatedAt().compareTo(a.getCreatedAt()))
            .map(t -> {
                long stations = countQuery("SELECT COUNT(*) FROM stations WHERE tenant_id = ?", t.getId());
                long mrr = sumQuery("SELECT COALESCE(SUM(monthly_fee_fcfa), 0) FROM stations WHERE tenant_id = ?", t.getId());
                long users = countQuery(
                    "SELECT COUNT(*) FROM employees WHERE station_id IN (SELECT id FROM stations WHERE tenant_id = ?)",
                    t.getId()
                );
                return new PlatformTenantSummaryDto(
                    t.getId(),
                    t.getName(),
                    t.getOwnerEmail(),
                    t.getCountryCode(),
                    t.getTimezone(),
                    t.getStatus(),
                    stations,
                    users,
                    mrr,
                    t.getCreatedAt()
                );
            })
            .toList();
    }

    @Transactional
    public PlatformTenantSummaryDto updateTenantStatus(String tenantId, String nextStatus) {
        TenantEntity tenant = tenantRepo.findById(tenantId)
            .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + tenantId));
        tenant.updateStatus(nextStatus);
        TenantEntity saved = tenantRepo.save(tenant);
        long stations = countQuery("SELECT COUNT(*) FROM stations WHERE tenant_id = ?", saved.getId());
        long mrr = sumQuery("SELECT COALESCE(SUM(monthly_fee_fcfa), 0) FROM stations WHERE tenant_id = ?", saved.getId());
        long users = countQuery(
            "SELECT COUNT(*) FROM employees WHERE station_id IN (SELECT id FROM stations WHERE tenant_id = ?)",
            saved.getId()
        );
        return new PlatformTenantSummaryDto(
            saved.getId(), saved.getName(), saved.getOwnerEmail(), saved.getCountryCode(),
            saved.getTimezone(), saved.getStatus(), stations, users, mrr, saved.getCreatedAt()
        );
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listInboundLeads() {
        return jdbcTemplate.query(
            "SELECT id, reference_id, full_name, station_name, email, phone, pump_count, selected_plan, status, created_at FROM demo_leads ORDER BY created_at DESC",
            (rs, rowNum) -> {
                Timestamp ts = rs.getTimestamp("created_at");
                return Map.<String, Object>of(
                    "id", rs.getString("id"),
                    "referenceId", rs.getString("reference_id"),
                    "fullName", rs.getString("full_name"),
                    "stationName", rs.getString("station_name"),
                    "email", rs.getString("email"),
                    "phone", rs.getString("phone"),
                    "pumpCount", rs.getInt("pump_count"),
                    "selectedPlan", rs.getString("selected_plan") != null ? rs.getString("selected_plan") : "Starter Station",
                    "status", rs.getString("status"),
                    "createdAt", ts != null ? ts.toInstant().toString() : Instant.now().toString()
                );
            }
        );
    }

    @Transactional
    public Map<String, Object> updateLeadStatus(String leadId, String nextStatus) {
        String normalized = nextStatus == null ? "" : nextStatus.trim().toUpperCase();
        if (!VALID_LEAD_STATUSES.contains(normalized)) {
            throw new IllegalArgumentException("Invalid lead status: " + nextStatus);
        }
        int updated = jdbcTemplate.update("UPDATE demo_leads SET status = ? WHERE id = ?", normalized, leadId);
        if (updated == 0) {
            throw new IllegalArgumentException("Lead not found: " + leadId);
        }
        return Map.of("id", leadId, "status", normalized, "updatedAt", Instant.now().toString());
    }

    private long countQuery(String sql, Object... args) {
        Long val = jdbcTemplate.queryForObject(sql, Long.class, args);
        return val != null ? val : 0L;
    }

    private long sumQuery(String sql, Object... args) {
        Long val = jdbcTemplate.queryForObject(sql, Long.class, args);
        return val != null ? val : 0L;
    }
}

record PlatformAdminOverviewDto(
    long totalTenants,
    long activeTenants,
    long suspendedTenants,
    long totalStations,
    long totalPlatformMrrFcfa,
    long stationMrrFcfa,
    long aiAddonMrrFcfa,
    long activeAiAddons,
    long totalBilledFcfa,
    long totalCollectedFcfa,
    long outstandingReceivablesFcfa,
    long openLeadsCount,
    long totalEmployees,
    Instant generatedAt
) {}

record PlatformTenantSummaryDto(
    String id,
    String name,
    String ownerEmail,
    String countryCode,
    String timezone,
    String status,
    long stationCount,
    long employeeCount,
    long monthlyMrrFcfa,
    Instant createdAt
) {}

record UpdateStatusCommand(@NotBlank String status) {}

@RestController
@RequestMapping("/api/v1/platform-admin")
@PreAuthorize("hasRole('PLATFORM_ADMIN') or hasAuthority('SCOPE_platform:admin')")
public class PlatformAdminController {
    private final PlatformAdminService service;

    public PlatformAdminController(PlatformAdminService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public PlatformAdminOverviewDto overview() {
        return service.getOverview();
    }

    @GetMapping("/tenants")
    public List<PlatformTenantSummaryDto> listTenants() {
        return service.listAllTenants();
    }

    @PatchMapping("/tenants/{tenantId}/status")
    public PlatformTenantSummaryDto updateTenantStatus(
        @PathVariable String tenantId,
        @Valid @RequestBody UpdateStatusCommand cmd
    ) {
        return service.updateTenantStatus(tenantId, cmd.status());
    }

    @GetMapping("/leads")
    public List<Map<String, Object>> listLeads() {
        return service.listInboundLeads();
    }

    @PatchMapping("/leads/{leadId}/status")
    public Map<String, Object> updateLeadStatus(
        @PathVariable String leadId,
        @Valid @RequestBody UpdateStatusCommand cmd
    ) {
        return service.updateLeadStatus(leadId, cmd.status());
    }
}
