package com.opesware.opesfuel.tenant;

import com.opesware.opesfuel.notifications.OutboundMessagingService;
import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.lang.management.ManagementFactory;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
class PlatformAdminService {
    private static final Set<String> VALID_LEAD_STATUSES = Set.of(
        "RECEIVED", "CONTACTED", "QUALIFIED", "CONVERTED", "ARCHIVED"
    );
    private static final Set<String> VALID_TICKET_STATUSES = Set.of(
        "OPEN", "IN_PROGRESS", "WAITING_TENANT", "ESCALATED", "RESOLVED", "CLOSED"
    );
    private static final Set<String> VALID_TICKET_PRIORITIES = Set.of(
        "LOW", "MEDIUM", "HIGH", "URGENT"
    );

    private final TenantRepository tenantRepo;
    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder audit;
    private final OutboundMessagingService messagingService;

    PlatformAdminService(
        TenantRepository tenantRepo,
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder audit,
        OutboundMessagingService messagingService
    ) {
        this.tenantRepo = tenantRepo;
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.audit = audit;
        this.messagingService = messagingService;
    }

    private String actorEmail() {
        OpesFuelPrincipal p = accessGuard.currentPrincipal();
        return p.subject() != null && !p.subject().isBlank() ? p.subject() : "superadmin@opesware.com";
    }

    private String actorRole() {
        return accessGuard.currentPrincipal().roles().toString();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getOverview() {
        long totalTenants = countQuery("SELECT COUNT(*) FROM tenants");
        long activeTenants = countQuery("SELECT COUNT(*) FROM tenants WHERE status = 'ACTIVE'");
        long suspendedTenants = countQuery("SELECT COUNT(*) FROM tenants WHERE status = 'SUSPENDED'");
        long trialTenants = safeCountQuery("SELECT COUNT(*) FROM tenants WHERE trial_ends_at IS NOT NULL AND trial_ends_at > CURRENT_TIMESTAMP");
        long totalStations = countQuery("SELECT COUNT(*) FROM stations");
        long stationMrrFcfa = sumQuery("SELECT COALESCE(SUM(monthly_fee_fcfa), 0) FROM stations");
        long activeAiAddons = safeCountQuery("SELECT COUNT(*) FROM ai_subscriptions WHERE active = TRUE");
        long aiMrrFcfa = safeSumQuery("SELECT COALESCE(SUM(monthly_fee_fcfa), 0) FROM ai_subscriptions WHERE active = TRUE");
        long totalPlatformMrrFcfa = stationMrrFcfa + aiMrrFcfa;
        long totalBilledFcfa = safeSumQuery("SELECT COALESCE(SUM(total_fcfa), 0) FROM billing_invoices WHERE status <> 'VOID'");
        long totalCollectedFcfa = safeSumQuery("SELECT COALESCE(SUM(amount_fcfa), 0) FROM billing_payments");
        long outstandingReceivablesFcfa = Math.max(0L, totalBilledFcfa - totalCollectedFcfa);
        long openLeadsCount = safeCountQuery("SELECT COUNT(*) FROM demo_leads WHERE status IN ('RECEIVED', 'CONTACTED', 'QUALIFIED')");
        long totalEmployees = safeCountQuery("SELECT COUNT(*) FROM employees");
        long openSupportTickets = safeCountQuery("SELECT COUNT(*) FROM platform_support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS', 'WAITING_TENANT', 'ESCALATED')");
        long urgentSupportTickets = safeCountQuery("SELECT COUNT(*) FROM platform_support_tickets WHERE status IN ('OPEN', 'IN_PROGRESS', 'ESCALATED') AND priority IN ('HIGH', 'URGENT')");
        long edgeDevicesTotal = safeCountQuery("SELECT COUNT(*) FROM edge_devices WHERE revoked = FALSE");
        long edgeDevicesOnline = safeCountQuery("SELECT COUNT(*) FROM edge_devices WHERE revoked = FALSE AND status = 'ONLINE'");
        long failedWebhooks24h = safeCountQuery("SELECT COUNT(*) FROM webhook_deliveries WHERE success = FALSE");
        long momoSettledVolumeFcfa = safeSumQuery("SELECT COALESCE(SUM(amount_fcfa), 0) FROM momo_transactions WHERE status = 'SUCCESSFUL'");
        long momoSettledCount = safeCountQuery("SELECT COUNT(*) FROM momo_transactions WHERE status = 'SUCCESSFUL'");
        long activeLicensesCount = safeCountQuery("SELECT COUNT(*) FROM platform_enterprise_licenses WHERE status = 'ACTIVE'");

        double collectionRatePct = totalBilledFcfa > 0
            ? Math.min(100.0, Math.round((totalCollectedFcfa * 1000.0) / totalBilledFcfa) / 10.0)
            : 100.0;
        long arpuFcfa = activeTenants > 0 ? Math.round((double) totalPlatformMrrFcfa / activeTenants) : 0L;
        double churnRatePct = totalTenants > 0
            ? Math.round((suspendedTenants * 1000.0) / totalTenants) / 10.0
            : 0.0;

        // Real plan tier revenue breakdown computed from actual tenants & stations
        List<Map<String, Object>> planRows = safeQueryForList("""
            SELECT COALESCE(LOWER(t.plan_code), 'growth') AS plan_code,
                   COUNT(DISTINCT t.id) AS tenant_count,
                   COUNT(DISTINCT s.id) AS station_count,
                   COALESCE(SUM(s.monthly_fee_fcfa), 0) AS mrr_fcfa
            FROM tenants t
            LEFT JOIN stations s ON s.tenant_id = t.id
            GROUP BY COALESCE(LOWER(t.plan_code), 'growth')
            """);
        Map<String, Map<String, Object>> byCode = new LinkedHashMap<>();
        for (Map<String, Object> r : planRows) {
            String code = String.valueOf(r.getOrDefault("plan_code", "growth")).toLowerCase();
            byCode.put(code, r);
        }
        List<Map<String, Object>> tierBreakdown = new ArrayList<>();
        for (String[] def : new String[][]{
            {"starter", "Starter Station"},
            {"growth", "Multi-Pump Pro"},
            {"enterprise", "Network Enterprise"}
        }) {
            Map<String, Object> found = byCode.get(def[0]);
            long tCount = found != null ? toLong(found.get("tenant_count")) : 0L;
            long sCount = found != null ? toLong(found.get("station_count")) : 0L;
            long mrr = found != null ? toLong(found.get("mrr_fcfa")) : 0L;
            double sharePct = stationMrrFcfa > 0 ? Math.round((mrr * 1000.0) / stationMrrFcfa) / 10.0 : 0.0;
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("planCode", def[0]);
            entry.put("planName", def[1]);
            entry.put("tenantCount", tCount);
            entry.put("stationCount", sCount);
            entry.put("mrrFcfa", mrr);
            entry.put("sharePct", sharePct);
            tierBreakdown.add(entry);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("totalTenants", totalTenants);
        out.put("activeTenants", activeTenants);
        out.put("suspendedTenants", suspendedTenants);
        out.put("trialTenants", trialTenants);
        out.put("totalStations", totalStations);
        out.put("totalPlatformMrrFcfa", totalPlatformMrrFcfa);
        out.put("stationMrrFcfa", stationMrrFcfa);
        out.put("aiAddonMrrFcfa", aiMrrFcfa);
        out.put("activeAiAddons", activeAiAddons);
        out.put("totalBilledFcfa", totalBilledFcfa);
        out.put("totalCollectedFcfa", totalCollectedFcfa);
        out.put("outstandingReceivablesFcfa", outstandingReceivablesFcfa);
        out.put("collectionRatePct", collectionRatePct);
        out.put("arpuFcfa", arpuFcfa);
        out.put("churnRatePct", churnRatePct);
        out.put("openLeadsCount", openLeadsCount);
        out.put("totalEmployees", totalEmployees);
        out.put("openSupportTickets", openSupportTickets);
        out.put("urgentSupportTickets", urgentSupportTickets);
        out.put("edgeDevicesTotal", edgeDevicesTotal);
        out.put("edgeDevicesOnline", edgeDevicesOnline);
        out.put("failedWebhooks24h", failedWebhooks24h);
        out.put("momoSettledVolumeFcfa", momoSettledVolumeFcfa);
        out.put("momoSettledCount", momoSettledCount);
        out.put("activeLicensesCount", activeLicensesCount);
        out.put("planTierBreakdown", tierBreakdown);
        out.put("generatedAt", Instant.now().toString());
        return out;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listAllTenants() {
        List<Map<String, Object>> rows;
        try {
            rows = jdbcTemplate.queryForList("""
                SELECT id, name, owner_email, country_code, timezone, status,
                       COALESCE(plan_code, 'growth') AS plan_code,
                       trial_ends_at,
                       COALESCE(billing_status, 'CURRENT') AS billing_status,
                       created_at
                FROM tenants
                ORDER BY created_at DESC
                """);
        } catch (Exception ex) {
            rows = jdbcTemplate.queryForList("""
                SELECT id, name, owner_email, country_code, timezone, status, created_at
                FROM tenants
                ORDER BY created_at DESC
                """);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            String tid = String.valueOf(r.get("id"));
            long stations = countQuery("SELECT COUNT(*) FROM stations WHERE tenant_id = ?", tid);
            long mrr = sumQuery("SELECT COALESCE(SUM(monthly_fee_fcfa), 0) FROM stations WHERE tenant_id = ?", tid);
            long users = countQuery(
                "SELECT COUNT(*) FROM employees WHERE station_id IN (SELECT id FROM stations WHERE tenant_id = ?)",
                tid
            );
            long openTickets = safeCountQuery(
                "SELECT COUNT(*) FROM platform_support_tickets WHERE tenant_id = ? AND status IN ('OPEN','IN_PROGRESS','WAITING_TENANT','ESCALATED')",
                tid
            );
            long edgeOnline = safeCountQuery(
                "SELECT COUNT(*) FROM edge_devices WHERE tenant_id = ? AND revoked = FALSE AND status = 'ONLINE'",
                tid
            );
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", tid);
            item.put("name", r.get("name"));
            item.put("ownerEmail", r.get("owner_email"));
            item.put("countryCode", r.get("country_code"));
            item.put("timezone", r.get("timezone"));
            item.put("status", r.get("status"));
            item.put("planCode", r.get("plan_code"));
            item.put("trialEndsAt", formatTs(r.get("trial_ends_at")));
            item.put("billingStatus", r.get("billing_status"));
            item.put("stationCount", stations);
            item.put("employeeCount", users);
            item.put("monthlyMrrFcfa", mrr);
            item.put("openTicketsCount", openTickets);
            item.put("edgeDevicesOnline", edgeOnline);
            item.put("createdAt", formatTs(r.get("created_at")));
            result.add(item);
        }
        return result;
    }

    @Transactional
    public Map<String, Object> createTenant(CreatePlatformTenantCmd cmd) {
        String id = "ten_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String name = cmd.name().trim();
        String ownerEmail = cmd.ownerEmail().trim().toLowerCase();
        String country = cmd.countryCode() != null && !cmd.countryCode().isBlank() ? cmd.countryCode().trim().toUpperCase() : "CM";
        String timezone = cmd.timezone() != null && !cmd.timezone().isBlank() ? cmd.timezone().trim() : "Africa/Douala";
        String planCode = normalizePlanCode(cmd.planCode());
        int stationCount = Math.max(1, cmd.initialStations());
        long perStationFee = resolvePlanFeeFcfa(planCode);
        int trialDays = cmd.trialDays() != null ? Math.max(0, cmd.trialDays()) : 14;
        Instant trialEnds = trialDays > 0 ? Instant.now().plus(trialDays, ChronoUnit.DAYS) : null;

        TenantEntity entity = TenantEntity.create(id, name, ownerEmail, country, timezone);
        tenantRepo.saveAndFlush(entity);
        jdbcTemplate.update(
            "UPDATE tenants SET plan_code = ?, trial_ends_at = ?, billing_status = ? WHERE id = ?",
            planCode, trialEnds != null ? Timestamp.from(trialEnds) : null, trialDays > 0 ? "TRIAL" : "CURRENT", id
        );

        String planLabel = planDisplayName(planCode);
        String city = cmd.city() != null && !cmd.city().isBlank() ? cmd.city().trim() : "Douala";
        Timestamp now = Timestamp.from(Instant.now());
        for (int i = 1; i <= stationCount; i++) {
            String stId = "st_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
            String stCode = "ST-" + id.substring(4, Math.min(id.length(), 8)).toUpperCase() + "-" + i;
            String stName = stationCount == 1 ? name + " Main Station" : name + " Station #" + i;
            jdbcTemplate.update("""
                INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
                VALUES (?, ?, ?, ?, ?, 'FCFA', ?, ?, 0.1925, ?, ?)
                """, stId, id, stCode, stName, city, planLabel, perStationFee, timezone, now);
        }

        jdbcTemplate.update("""
            INSERT INTO tenant_feature_flags (tenant_id, ai_copilot_enabled, hardware_bridge_enabled, ocpp_ev_enabled, b2b_wholesale_enabled, franchise_mode_enabled, white_label_branding_enabled, updated_by, updated_at)
            VALUES (?, TRUE, TRUE, TRUE, TRUE, ?, TRUE, ?, CURRENT_TIMESTAMP)
            """, id, "enterprise".equals(planCode), actorEmail());

        audit.record("PLATFORM", null, actorEmail(), actorRole(),
            "PLATFORM_TENANT_PROVISIONED", "TENANT", id,
            "Provisioned tenant " + name + " (" + ownerEmail + ") on plan=" + planCode + " with " + stationCount + " station(s)");

        return getTenantDetail(id);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getTenantDetail(String tenantId) {
        List<Map<String, Object>> rows;
        try {
            rows = jdbcTemplate.queryForList("""
                SELECT id, name, owner_email, default_currency, country_code, timezone, status,
                       COALESCE(plan_code, 'growth') AS plan_code,
                       trial_ends_at,
                       COALESCE(billing_status, 'CURRENT') AS billing_status,
                       created_at
                FROM tenants WHERE id = ?
                """, tenantId);
        } catch (Exception ex) {
            rows = jdbcTemplate.queryForList("""
                SELECT id, name, owner_email, default_currency, country_code, timezone, status, created_at
                FROM tenants WHERE id = ?
                """, tenantId);
        }
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId);
        }
        Map<String, Object> t = rows.get(0);

        List<Map<String, Object>> stations = jdbcTemplate.queryForList("""
            SELECT s.id, s.code, s.name, s.city, s.plan_name, s.monthly_fee_fcfa, s.created_at,
                   (SELECT COUNT(*) FROM pumps p WHERE p.station_id = s.id) AS pump_count,
                   (SELECT COUNT(*) FROM fuel_tanks ft WHERE ft.station_id = s.id) AS tank_count
            FROM stations s WHERE s.tenant_id = ? ORDER BY s.created_at ASC
            """, tenantId);

        List<Map<String, Object>> users = safeQueryForList("""
            SELECT id, full_name, email, phone, role, assigned_station_id, created_at
            FROM user_accounts WHERE tenant_id = ? ORDER BY created_at DESC
            """, tenantId);

        List<Map<String, Object>> employees = safeQueryForList("""
            SELECT e.id, e.full_name, e.role, e.phone, e.station_id, e.clocked_in
            FROM employees e
            WHERE e.station_id IN (SELECT id FROM stations WHERE tenant_id = ?)
            ORDER BY e.full_name ASC
            """, tenantId);

        List<Map<String, Object>> invoices = safeQueryForList("""
            SELECT bi.id, bi.invoice_number, bi.period_label, bi.station_count, bi.total_fcfa, bi.status, bi.due_date, bi.paid_at, bi.created_at,
                   COALESCE((SELECT SUM(bp.amount_fcfa) FROM billing_payments bp WHERE bp.invoice_id = bi.id), 0) AS paid_fcfa
            FROM billing_invoices bi WHERE bi.tenant_id = ? ORDER BY bi.created_at DESC LIMIT 25
            """, tenantId);

        List<Map<String, Object>> momoTx = safeQueryForList("""
            SELECT id, provider, msisdn, amount_fcfa, status, reference_id, provider_tx_id, target_type, created_at, settled_at
            FROM momo_transactions WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20
            """, tenantId);

        List<Map<String, Object>> edgeDevices = safeQueryForList("""
            SELECT id, station_id, device_name, key_prefix, agent_version, hostname, status, outbox_depth, last_heartbeat_at
            FROM edge_devices WHERE tenant_id = ? AND revoked = FALSE ORDER BY created_at DESC
            """, tenantId);

        List<Map<String, Object>> tickets = safeQueryForList("""
            SELECT id, ticket_number, subject, category, priority, status, requester_email, assigned_to, created_at, updated_at
            FROM platform_support_tickets WHERE tenant_id = ? ORDER BY created_at DESC LIMIT 20
            """, tenantId);

        List<Map<String, Object>> auditLogs = safeQueryForList("""
            SELECT id, actor_email, actor_role, action, entity_type, entity_id, summary, created_at
            FROM audit_logs WHERE tenant_id = ? OR entity_id = ? ORDER BY created_at DESC LIMIT 25
            """, tenantId, tenantId);

        List<Map<String, Object>> brandingRows = safeQueryForList(
            "SELECT legal_name, trading_name, tax_id_niu, rccm_number, cnps_employer_id, city, phone, email, address FROM tenant_branding_profiles WHERE tenant_id = ?",
            tenantId
        );
        List<Map<String, Object>> flagRows = safeQueryForList(
            "SELECT * FROM tenant_feature_flags WHERE tenant_id = ?",
            tenantId
        );

        long monthlyMrr = stations.stream().mapToLong(s -> toLong(s.get("monthly_fee_fcfa"))).sum();

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", t.get("id"));
        out.put("name", t.get("name"));
        out.put("ownerEmail", t.get("owner_email"));
        out.put("countryCode", t.get("country_code"));
        out.put("timezone", t.get("timezone"));
        out.put("status", t.get("status"));
        out.put("planCode", t.get("plan_code"));
        out.put("planName", planDisplayName(String.valueOf(t.get("plan_code"))));
        out.put("trialEndsAt", formatTs(t.get("trial_ends_at")));
        out.put("billingStatus", t.get("billing_status"));
        out.put("stationCount", stations.size());
        out.put("employeeCount", employees.size());
        out.put("monthlyMrrFcfa", monthlyMrr);
        out.put("createdAt", formatTs(t.get("created_at")));
        out.put("branding", brandingRows.isEmpty() ? null : brandingRows.get(0));
        out.put("featureFlags", flagRows.isEmpty() ? null : flagRows.get(0));
        out.put("stations", stations);
        out.put("users", users);
        out.put("employees", employees);
        out.put("invoices", invoices);
        out.put("momoTransactions", momoTx);
        out.put("edgeDevices", edgeDevices);
        out.put("supportTickets", tickets);
        out.put("recentAuditLogs", auditLogs);
        return out;
    }

    @Transactional
    public Map<String, Object> updateTenantStatus(String tenantId, String nextStatus) {
        TenantEntity tenant = tenantRepo.findById(tenantId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));
        tenant.updateStatus(nextStatus);
        tenantRepo.saveAndFlush(tenant);
        audit.record("PLATFORM", null, actorEmail(), actorRole(),
            "TENANT_STATUS_" + tenant.getStatus(), "TENANT", tenantId,
            "Changed tenant " + tenant.getName() + " status to " + tenant.getStatus());
        return getTenantDetail(tenantId);
    }

    @Transactional
    public Map<String, Object> updateTenantPlan(String tenantId, UpdateTenantPlanCmd cmd) {
        TenantEntity tenant = tenantRepo.findById(tenantId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));
        String planCode = normalizePlanCode(cmd.planCode());
        long fee = cmd.customMonthlyFeePerStationFcfa() != null && cmd.customMonthlyFeePerStationFcfa() > 0
            ? cmd.customMonthlyFeePerStationFcfa()
            : resolvePlanFeeFcfa(planCode);
        String planLabel = planDisplayName(planCode);
        jdbcTemplate.update(
            "UPDATE tenants SET plan_code = ?, billing_status = 'CURRENT' WHERE id = ?",
            planCode, tenantId
        );
        jdbcTemplate.update(
            "UPDATE stations SET plan_name = ?, monthly_fee_fcfa = ? WHERE tenant_id = ?",
            planLabel, fee, tenantId
        );
        audit.record("PLATFORM", null, actorEmail(), actorRole(),
            "TENANT_PLAN_CHANGED", "TENANT", tenantId,
            "Changed " + tenant.getName() + " plan to " + planLabel + " (" + fee + " FCFA/station/mo)");
        return getTenantDetail(tenantId);
    }

    @Transactional
    public Map<String, Object> extendTenantTrial(String tenantId, ExtendTrialCmd cmd) {
        TenantEntity tenant = tenantRepo.findById(tenantId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));
        int days = Math.max(1, Math.min(365, cmd.days()));
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("SELECT trial_ends_at FROM tenants WHERE id = ?", tenantId);
        Instant base = Instant.now();
        if (!rows.isEmpty() && rows.get(0).get("trial_ends_at") instanceof Timestamp ts && ts.toInstant().isAfter(base)) {
            base = ts.toInstant();
        }
        Instant nextEnd = base.plus(days, ChronoUnit.DAYS);
        jdbcTemplate.update(
            "UPDATE tenants SET trial_ends_at = ?, billing_status = 'TRIAL' WHERE id = ?",
            Timestamp.from(nextEnd), tenantId
        );
        audit.record("PLATFORM", null, actorEmail(), actorRole(),
            "TENANT_TRIAL_EXTENDED", "TENANT", tenantId,
            "Extended trial for " + tenant.getName() + " by +" + days + " day(s) until " + nextEnd + (cmd.reason() != null ? " (" + cmd.reason() + ")" : ""));
        return getTenantDetail(tenantId);
    }

    @Transactional
    public Map<String, Object> resendTenantOwnerAccess(String tenantId) {
        TenantEntity tenant = tenantRepo.findById(tenantId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));
        String otpCode = String.format("%06d", new Random().nextInt(1_000_000));
        Map<String, Object> dispatch = messagingService.dispatch(
            tenantId,
            actorEmail(),
            "EMAIL",
            tenant.getOwnerEmail(),
            "OpesFuel Workspace Access & Recovery Code — " + tenant.getName(),
            "Hello,\n\nAn OpesFuel Platform Support Engineer triggered a workspace access recovery for " + tenant.getName()
                + ".\nVerification Code: " + otpCode + "\nSign in at: https://app.opesfuel.com/#/login\n\n— OpesFuel Support Desk",
            "SUPPORT_ACCESS_RECOVERY"
        );
        audit.record("PLATFORM", null, actorEmail(), actorRole(),
            "TENANT_ACCESS_RECOVERY_SENT", "TENANT", tenantId,
            "Dispatched owner access recovery email to " + tenant.getOwnerEmail() + " (status=" + dispatch.get("status") + ")");
        return Map.of(
            "tenantId", tenantId,
            "ownerEmail", tenant.getOwnerEmail(),
            "deliveryStatus", dispatch.getOrDefault("status", "QUEUED"),
            "sentAt", Instant.now().toString()
        );
    }

    // --- Support Desk Tickets & Audited Impersonation ---

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listSupportTickets(String status, String tenantId, String priority) {
        StringBuilder sql = new StringBuilder("""
            SELECT t.id, t.ticket_number, t.tenant_id, t.tenant_name, t.station_id, t.requester_email,
                   t.subject, t.category, t.priority, t.status, t.assigned_to, t.sla_due_at, t.resolved_at,
                   t.created_at, t.updated_at,
                   (SELECT COUNT(*) FROM platform_support_messages m WHERE m.ticket_id = t.id) AS message_count
            FROM platform_support_tickets t WHERE 1=1
            """);
        List<Object> params = new ArrayList<>();
        if (status != null && !status.isBlank() && !"ALL".equalsIgnoreCase(status)) {
            sql.append(" AND t.status = ?");
            params.add(status.trim().toUpperCase());
        }
        if (tenantId != null && !tenantId.isBlank()) {
            sql.append(" AND t.tenant_id = ?");
            params.add(tenantId.trim());
        }
        if (priority != null && !priority.isBlank() && !"ALL".equalsIgnoreCase(priority)) {
            sql.append(" AND t.priority = ?");
            params.add(priority.trim().toUpperCase());
        }
        sql.append(" ORDER BY CASE t.priority WHEN 'URGENT' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, t.created_at DESC");
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(sql.toString(), params.toArray());
        return rows.stream().map(this::normalizeTicketRow).toList();
    }

    @Transactional
    public Map<String, Object> createSupportTicket(CreateSupportTicketCmd cmd, String fallbackTenantId) {
        String tenantId = cmd.tenantId() != null && !cmd.tenantId().isBlank() ? cmd.tenantId().trim() : fallbackTenantId;
        String tenantName = tenantRepo.findById(tenantId).map(TenantEntity::getName).orElse(cmd.tenantName() != null ? cmd.tenantName().trim() : tenantId);
        String priority = cmd.priority() != null && VALID_TICKET_PRIORITIES.contains(cmd.priority().trim().toUpperCase())
            ? cmd.priority().trim().toUpperCase() : "MEDIUM";
        String category = cmd.category() != null && !cmd.category().isBlank() ? cmd.category().trim().toUpperCase() : "TECHNICAL";
        String requester = cmd.requesterEmail() != null && !cmd.requesterEmail().isBlank() ? cmd.requesterEmail().trim().toLowerCase() : actorEmail();
        String id = "tkt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String ticketNumber = "SUP-" + java.time.Year.now().getValue() + "-" + String.format("%04d", 1000 + new Random().nextInt(9000));
        long slaHours = switch (priority) {
            case "URGENT" -> 2L;
            case "HIGH" -> 6L;
            case "MEDIUM" -> 24L;
            default -> 48L;
        };
        Instant now = Instant.now();
        Instant slaDue = now.plus(slaHours, ChronoUnit.HOURS);

        jdbcTemplate.update("""
            INSERT INTO platform_support_tickets (
                id, ticket_number, tenant_id, tenant_name, station_id, requester_email,
                subject, category, priority, status, assigned_to, sla_due_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?, ?, ?, ?)
            """,
            id, ticketNumber, tenantId, tenantName, cmd.stationId(), requester,
            cmd.subject().trim(), category, priority, "superadmin@opesware.com",
            Timestamp.from(slaDue), Timestamp.from(now), Timestamp.from(now)
        );

        String msgId = "tmsg_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        jdbcTemplate.update("""
            INSERT INTO platform_support_messages (id, ticket_id, sender_email, sender_role, internal_note, body, created_at)
            VALUES (?, ?, ?, ?, FALSE, ?, ?)
            """, msgId, id, requester, actorRole(), cmd.description().trim(), Timestamp.from(now));

        audit.record(tenantId, cmd.stationId(), actorEmail(), actorRole(),
            "SUPPORT_TICKET_CREATED", "SUPPORT_TICKET", id,
            ticketNumber + " [" + priority + "] " + cmd.subject().trim());

        List<Map<String, Object>> created = jdbcTemplate.queryForList("""
            SELECT t.*, (SELECT COUNT(*) FROM platform_support_messages m WHERE m.ticket_id = t.id) AS message_count
            FROM platform_support_tickets t WHERE t.id = ?
            """, id);
        return normalizeTicketRow(created.get(0));
    }

    @Transactional
    public Map<String, Object> updateSupportTicket(String ticketId, UpdateSupportTicketCmd cmd) {
        List<Map<String, Object>> existing = jdbcTemplate.queryForList("SELECT * FROM platform_support_tickets WHERE id = ?", ticketId);
        if (existing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Support ticket not found: " + ticketId);
        }
        String nextStatus = cmd.status() != null && !cmd.status().isBlank()
            ? cmd.status().trim().toUpperCase()
            : String.valueOf(existing.get(0).get("status"));
        if (!VALID_TICKET_STATUSES.contains(nextStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ticket status: " + nextStatus);
        }
        String nextPriority = cmd.priority() != null && !cmd.priority().isBlank()
            ? cmd.priority().trim().toUpperCase()
            : String.valueOf(existing.get(0).get("priority"));
        if (!VALID_TICKET_PRIORITIES.contains(nextPriority)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid ticket priority: " + nextPriority);
        }
        String nextAssignee = cmd.assignedTo() != null && !cmd.assignedTo().isBlank()
            ? cmd.assignedTo().trim()
            : (existing.get(0).get("assigned_to") != null ? String.valueOf(existing.get(0).get("assigned_to")) : actorEmail());
        Timestamp resolvedAt = ("RESOLVED".equals(nextStatus) || "CLOSED".equals(nextStatus))
            ? Timestamp.from(Instant.now())
            : (existing.get(0).get("resolved_at") instanceof Timestamp ts ? ts : null);

        jdbcTemplate.update("""
            UPDATE platform_support_tickets
            SET status = ?, priority = ?, assigned_to = ?, resolved_at = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """, nextStatus, nextPriority, nextAssignee, resolvedAt, ticketId);

        audit.record("PLATFORM", null, actorEmail(), actorRole(),
            "SUPPORT_TICKET_UPDATED", "SUPPORT_TICKET", ticketId,
            "Updated ticket " + existing.get(0).get("ticket_number") + " -> status=" + nextStatus + ", priority=" + nextPriority);

        List<Map<String, Object>> updated = jdbcTemplate.queryForList("""
            SELECT t.*, (SELECT COUNT(*) FROM platform_support_messages m WHERE m.ticket_id = t.id) AS message_count
            FROM platform_support_tickets t WHERE t.id = ?
            """, ticketId);
        return normalizeTicketRow(updated.get(0));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listTicketMessages(String ticketId) {
        return jdbcTemplate.queryForList("""
            SELECT id, ticket_id, sender_email, sender_role, internal_note, body, created_at
            FROM platform_support_messages WHERE ticket_id = ? ORDER BY created_at ASC
            """, ticketId).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("ticketId", r.get("ticket_id"));
            m.put("senderEmail", r.get("sender_email"));
            m.put("senderRole", r.get("sender_role"));
            m.put("internalNote", Boolean.TRUE.equals(r.get("internal_note")));
            m.put("body", r.get("body"));
            m.put("createdAt", formatTs(r.get("created_at")));
            return m;
        }).toList();
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listTenantTicketMessages(String tenantId, String ticketId) {
        List<Map<String, Object>> owned = jdbcTemplate.queryForList(
            "SELECT id FROM platform_support_tickets WHERE id = ? AND tenant_id = ?",
            ticketId, tenantId
        );
        if (owned.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Support ticket not found for tenant.");
        }
        return jdbcTemplate.queryForList("""
            SELECT id, ticket_id, sender_email, sender_role, internal_note, body, created_at
            FROM platform_support_messages
            WHERE ticket_id = ? AND internal_note = FALSE
            ORDER BY created_at ASC
            """, ticketId).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("ticketId", r.get("ticket_id"));
            m.put("senderEmail", r.get("sender_email"));
            m.put("senderRole", r.get("sender_role"));
            m.put("internalNote", false);
            m.put("body", r.get("body"));
            m.put("createdAt", formatTs(r.get("created_at")));
            return m;
        }).toList();
    }

    @Transactional
    public Map<String, Object> postTenantTicketReply(String tenantId, String ticketId, String body) {
        List<Map<String, Object>> owned = jdbcTemplate.queryForList(
            "SELECT id, status FROM platform_support_tickets WHERE id = ? AND tenant_id = ?",
            ticketId, tenantId
        );
        if (owned.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Support ticket not found for tenant.");
        }
        String msgId = "tmsg_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update("""
            INSERT INTO platform_support_messages (id, ticket_id, sender_email, sender_role, internal_note, body, created_at)
            VALUES (?, ?, ?, ?, FALSE, ?, ?)
            """, msgId, ticketId, actorEmail(), actorRole(), body.trim(), now);
        // If ticket was waiting on tenant, transition back to OPEN for support attention
        String curStatus = String.valueOf(owned.get(0).get("status"));
        if ("WAITING_TENANT".equalsIgnoreCase(curStatus)) {
            jdbcTemplate.update("UPDATE platform_support_tickets SET status = 'OPEN', updated_at = ? WHERE id = ?", now, ticketId);
        } else {
            jdbcTemplate.update("UPDATE platform_support_tickets SET updated_at = ? WHERE id = ?", now, ticketId);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", msgId);
        m.put("ticketId", ticketId);
        m.put("senderEmail", actorEmail());
        m.put("senderRole", actorRole());
        m.put("internalNote", false);
        m.put("body", body.trim());
        m.put("createdAt", now.toInstant().toString());
        return m;
    }

    @Transactional
    public Map<String, Object> postTicketMessage(String ticketId, PostSupportMessageCmd cmd) {
        List<Map<String, Object>> tickets = jdbcTemplate.queryForList("SELECT * FROM platform_support_tickets WHERE id = ?", ticketId);
        if (tickets.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Support ticket not found: " + ticketId);
        }
        Map<String, Object> t = tickets.get(0);
        String msgId = "tmsg_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update("""
            INSERT INTO platform_support_messages (id, ticket_id, sender_email, sender_role, internal_note, body, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """, msgId, ticketId, actorEmail(), "PLATFORM_ADMIN", cmd.internalNote(), cmd.body().trim(), now);
        jdbcTemplate.update("UPDATE platform_support_tickets SET updated_at = ? WHERE id = ?", now, ticketId);

        if (!cmd.internalNote() && cmd.notifyRequester()) {
            String requester = String.valueOf(t.get("requester_email"));
            String ticketNo = String.valueOf(t.get("ticket_number"));
            messagingService.dispatch(
                String.valueOf(t.get("tenant_id")),
                actorEmail(),
                "EMAIL",
                requester,
                "[" + ticketNo + "] Reply from OpesFuel Support: " + t.get("subject"),
                cmd.body().trim(),
                "SUPPORT_TICKET_REPLY"
            );
        }

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", msgId);
        m.put("ticketId", ticketId);
        m.put("senderEmail", actorEmail());
        m.put("senderRole", "PLATFORM_ADMIN");
        m.put("internalNote", cmd.internalNote());
        m.put("body", cmd.body().trim());
        m.put("createdAt", now.toInstant().toString());
        return m;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listImpersonationSessions() {
        return jdbcTemplate.queryForList("""
            SELECT id, admin_email, tenant_id, tenant_name, ticket_id, reason, status, started_at, ended_at
            FROM platform_impersonation_sessions ORDER BY started_at DESC LIMIT 50
            """).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("adminEmail", r.get("admin_email"));
            m.put("tenantId", r.get("tenant_id"));
            m.put("tenantName", r.get("tenant_name"));
            m.put("ticketId", r.get("ticket_id"));
            m.put("reason", r.get("reason"));
            m.put("status", r.get("status"));
            m.put("startedAt", formatTs(r.get("started_at")));
            m.put("endedAt", formatTs(r.get("ended_at")));
            return m;
        }).toList();
    }

    @Transactional
    public Map<String, Object> startImpersonation(StartImpersonationCmd cmd) {
        String tenantId = cmd.tenantId().trim();
        String tenantName = tenantRepo.findById(tenantId)
            .map(TenantEntity::getName)
            .orElse(cmd.tenantName() != null && !cmd.tenantName().isBlank() ? cmd.tenantName().trim() : tenantId);
        String id = "imp_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update("""
            INSERT INTO platform_impersonation_sessions (id, admin_email, tenant_id, tenant_name, ticket_id, reason, status, started_at)
            VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
            """, id, actorEmail(), tenantId, tenantName, cmd.ticketId(), cmd.reason().trim(), now);
        audit.record(tenantId, null, actorEmail(), actorRole(),
            "PLATFORM_IMPERSONATION_STARTED", "IMPERSONATION_SESSION", id,
            "Super-Admin entered support view for " + tenantName + " — Reason: " + cmd.reason().trim());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("adminEmail", actorEmail());
        m.put("tenantId", tenantId);
        m.put("tenantName", tenantName);
        m.put("ticketId", cmd.ticketId());
        m.put("reason", cmd.reason().trim());
        m.put("status", "ACTIVE");
        m.put("startedAt", now.toInstant().toString());
        return m;
    }

    @Transactional
    public Map<String, Object> endImpersonation(String sessionId) {
        Timestamp now = Timestamp.from(Instant.now());
        int updated = jdbcTemplate.update(
            "UPDATE platform_impersonation_sessions SET status = 'ENDED', ended_at = ? WHERE id = ?",
            now, sessionId
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Impersonation session not found: " + sessionId);
        }
        audit.record("PLATFORM", null, actorEmail(), actorRole(),
            "PLATFORM_IMPERSONATION_ENDED", "IMPERSONATION_SESSION", sessionId,
            "Super-Admin exited tenant support impersonation session " + sessionId);
        return Map.of("id", sessionId, "status", "ENDED", "endedAt", now.toInstant().toString());
    }

    // --- Global Cross-Tenant Billing & Cameroon MoMo Settlement Ledger ---

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listGlobalInvoices() {
        return jdbcTemplate.queryForList("""
            SELECT bi.id, bi.tenant_id, COALESCE(t.name, bi.tenant_id) AS tenant_name,
                   bi.invoice_number, bi.period_label, bi.station_count, bi.subtotal_fcfa, bi.ai_addon_fcfa,
                   bi.total_fcfa, bi.currency, bi.status, bi.due_date, bi.paid_at, bi.created_at,
                   COALESCE((SELECT SUM(bp.amount_fcfa) FROM billing_payments bp WHERE bp.invoice_id = bi.id), 0) AS paid_fcfa,
                   COALESCE((SELECT bp.payment_channel FROM billing_payments bp WHERE bp.invoice_id = bi.id ORDER BY bp.paid_at DESC LIMIT 1), 'UNSETTLED') AS payment_channel
            FROM billing_invoices bi
            LEFT JOIN tenants t ON t.id = bi.tenant_id
            ORDER BY bi.created_at DESC
            LIMIT 100
            """).stream().map(r -> {
            long total = toLong(r.get("total_fcfa"));
            long paid = toLong(r.get("paid_fcfa"));
            String rawStatus = String.valueOf(r.getOrDefault("status", "ISSUED"));
            String effectiveStatus = rawStatus;
            if ("ISSUED".equals(rawStatus) && r.get("due_date") instanceof Timestamp ts && ts.toInstant().isBefore(Instant.now())) {
                effectiveStatus = "OVERDUE";
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("tenantId", r.get("tenant_id"));
            m.put("tenantName", r.get("tenant_name"));
            m.put("invoiceNumber", r.get("invoice_number"));
            m.put("periodLabel", r.get("period_label"));
            m.put("stationCount", r.get("station_count"));
            m.put("totalFcfa", total);
            m.put("paidFcfa", paid);
            m.put("status", effectiveStatus);
            m.put("channel", r.get("payment_channel"));
            m.put("dueDate", formatTs(r.get("due_date")));
            m.put("paidAt", formatTs(r.get("paid_at")));
            m.put("createdAt", formatTs(r.get("created_at")));
            return m;
        }).toList();
    }

    @Transactional
    public Map<String, Object> issueGlobalInvoice(IssueGlobalInvoiceCmd cmd) {
        String tenantId = cmd.tenantId().trim();
        TenantEntity tenant = tenantRepo.findById(tenantId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));
        String id = "inv_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String invNumber = "OPF-SAAS-" + cmd.periodLabel().trim() + "-" + String.format("%03d", 100 + new Random().nextInt(900));
        long stations = Math.max(1L, countQuery("SELECT COUNT(*) FROM stations WHERE tenant_id = ?", tenantId));
        Instant now = Instant.now();
        Instant due = now.plus(14, ChronoUnit.DAYS);
        jdbcTemplate.update("""
            INSERT INTO billing_invoices (id, tenant_id, invoice_number, period_label, station_count, subtotal_fcfa, ai_addon_fcfa, total_fcfa, currency, status, due_date, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'FCFA', 'ISSUED', ?, ?)
            """, id, tenantId, invNumber, cmd.periodLabel().trim(), stations, cmd.totalFcfa(), cmd.totalFcfa(), Timestamp.from(due), Timestamp.from(now));

        audit.record(tenantId, null, actorEmail(), actorRole(),
            "SAAS_INVOICE_ISSUED", "BILLING_INVOICE", id,
            "Issued SaaS invoice " + invNumber + " for " + tenant.getName() + " (" + cmd.totalFcfa() + " FCFA)");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("tenantId", tenantId);
        out.put("tenantName", tenant.getName());
        out.put("invoiceNumber", invNumber);
        out.put("periodLabel", cmd.periodLabel().trim());
        out.put("totalFcfa", cmd.totalFcfa());
        out.put("paidFcfa", 0L);
        out.put("status", "ISSUED");
        out.put("channel", cmd.channel() != null ? cmd.channel().trim().toUpperCase() : "BANK_TRANSFER");
        out.put("dueDate", due.toString());
        return out;
    }

    @Transactional
    public Map<String, Object> markGlobalInvoicePaid(String invoiceId, MarkInvoicePaidCmd cmd) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT id, tenant_id, invoice_number, total_fcfa, status FROM billing_invoices WHERE id = ?",
            invoiceId
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found: " + invoiceId);
        }
        Map<String, Object> inv = rows.get(0);
        String tenantId = String.valueOf(inv.get("tenant_id"));
        long totalFcfa = toLong(inv.get("total_fcfa"));
        long alreadyPaid = sumQuery("SELECT COALESCE(SUM(amount_fcfa), 0) FROM billing_payments WHERE invoice_id = ?", invoiceId);
        long remaining = Math.max(1L, totalFcfa - alreadyPaid);
        String channel = cmd != null && cmd.paymentChannel() != null && !cmd.paymentChannel().isBlank()
            ? cmd.paymentChannel().trim().toUpperCase() : "MTN_MOMO";
        String ref = cmd != null && cmd.providerReference() != null && !cmd.providerReference().isBlank()
            ? cmd.providerReference().trim() : "SETTLE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        Timestamp now = Timestamp.from(Instant.now());

        if (!"PAID".equalsIgnoreCase(String.valueOf(inv.get("status")))) {
            jdbcTemplate.update("""
                INSERT INTO billing_payments (id, invoice_id, tenant_id, amount_fcfa, payment_channel, provider_reference, paid_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """, "pay_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10),
                invoiceId, tenantId, remaining, channel, ref, now);
            jdbcTemplate.update(
                "UPDATE billing_invoices SET status = 'PAID', paid_at = ? WHERE id = ?",
                now, invoiceId
            );
            audit.record(tenantId, null, actorEmail(), actorRole(),
                "SAAS_INVOICE_SETTLED", "BILLING_INVOICE", invoiceId,
                "Settled invoice " + inv.get("invoice_number") + " (" + remaining + " FCFA via " + channel + ", ref=" + ref + ")");
        }
        return Map.of("id", invoiceId, "status", "PAID", "paidFcfa", totalFcfa, "channel", channel, "paidAt", now.toInstant().toString());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listGlobalMomoSettlements() {
        return safeQueryForList("""
            SELECT m.id, m.tenant_id, COALESCE(t.name, m.tenant_id) AS tenant_name,
                   m.target_type, m.target_id, m.provider, m.environment, m.msisdn,
                   m.amount_fcfa, m.api_currency, m.reference_id, m.provider_tx_id,
                   m.status, m.failure_reason, m.created_at, m.settled_at
            FROM momo_transactions m
            LEFT JOIN tenants t ON t.id = m.tenant_id
            ORDER BY m.created_at DESC
            LIMIT 100
            """).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("tenantId", r.get("tenant_id"));
            m.put("tenantName", r.get("tenant_name"));
            m.put("targetType", r.get("target_type"));
            m.put("targetId", r.get("target_id"));
            m.put("provider", r.get("provider"));
            m.put("environment", r.get("environment"));
            m.put("msisdn", r.get("msisdn"));
            m.put("amountFcfa", toLong(r.get("amount_fcfa")));
            m.put("referenceId", r.get("reference_id"));
            m.put("providerTxId", r.get("provider_tx_id"));
            m.put("status", r.get("status"));
            m.put("failureReason", r.get("failure_reason"));
            m.put("createdAt", formatTs(r.get("created_at")));
            m.put("settledAt", formatTs(r.get("settled_at")));
            return m;
        }).toList();
    }

    // --- Persisted Enterprise Licenses (Issue & Revoke) ---

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listEnterpriseLicenses() {
        return jdbcTemplate.queryForList("""
            SELECT id, license_key, tenant_id, organization_name, tier_name, max_stations,
                   annual_fee_fcfa, expires_at, status, revoked_reason, revoked_at, issued_by, issued_at
            FROM platform_enterprise_licenses ORDER BY issued_at DESC
            """).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("licenseKey", r.get("license_key"));
            m.put("tenantId", r.get("tenant_id"));
            m.put("organizationName", r.get("organization_name"));
            m.put("tierName", r.get("tier_name"));
            m.put("maxStations", r.get("max_stations"));
            m.put("annualFeeFcfa", toLong(r.get("annual_fee_fcfa")));
            m.put("expiresAt", r.get("expires_at"));
            m.put("status", r.get("status"));
            m.put("revokedReason", r.get("revoked_reason"));
            m.put("revokedAt", formatTs(r.get("revoked_at")));
            m.put("issuedBy", r.get("issued_by"));
            m.put("issuedAt", formatTs(r.get("issued_at")));
            return m;
        }).toList();
    }

    @Transactional
    public Map<String, Object> issueEnterpriseLicense(IssueEnterpriseLicenseCmd cmd) {
        String id = "lic_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        String key = "OPF-ENT-" + java.time.Year.now().getValue() + "-" + String.format("%04d", 1000 + new Random().nextInt(9000)) + "-CMR";
        String expiresAt = cmd.expiresAt() != null && !cmd.expiresAt().isBlank()
            ? cmd.expiresAt().trim()
            : java.time.LocalDate.now().plusYears(1).toString();
        Timestamp now = Timestamp.from(Instant.now());
        jdbcTemplate.update("""
            INSERT INTO platform_enterprise_licenses (
                id, license_key, tenant_id, organization_name, tier_name, max_stations,
                annual_fee_fcfa, expires_at, status, issued_by, issued_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
            """,
            id, key, cmd.tenantId(), cmd.organizationName().trim(),
            cmd.tierName() != null && !cmd.tierName().isBlank() ? cmd.tierName().trim() : "Enterprise Perpetual License",
            Math.max(1, cmd.maxStations()), Math.max(0L, cmd.annualFeeFcfa()), expiresAt, actorEmail(), now
        );
        audit.record("PLATFORM", null, actorEmail(), actorRole(),
            "ENTERPRISE_LICENSE_ISSUED", "ENTERPRISE_LICENSE", id,
            "Issued license " + key + " to " + cmd.organizationName().trim() + " (max " + cmd.maxStations() + " stations)");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("licenseKey", key);
        out.put("tenantId", cmd.tenantId());
        out.put("organizationName", cmd.organizationName().trim());
        out.put("tierName", cmd.tierName() != null && !cmd.tierName().isBlank() ? cmd.tierName().trim() : "Enterprise Perpetual License");
        out.put("maxStations", Math.max(1, cmd.maxStations()));
        out.put("annualFeeFcfa", Math.max(0L, cmd.annualFeeFcfa()));
        out.put("expiresAt", expiresAt);
        out.put("status", "ACTIVE");
        out.put("issuedBy", actorEmail());
        out.put("issuedAt", now.toInstant().toString());
        return out;
    }

    @Transactional
    public Map<String, Object> revokeEnterpriseLicense(String licenseId, RevokeLicenseCmd cmd) {
        String reason = cmd != null && cmd.reason() != null && !cmd.reason().isBlank()
            ? cmd.reason().trim() : "Revoked by SaaS Super-Admin";
        Timestamp now = Timestamp.from(Instant.now());
        int updated = jdbcTemplate.update(
            "UPDATE platform_enterprise_licenses SET status = 'REVOKED', revoked_reason = ?, revoked_at = ? WHERE id = ?",
            reason, now, licenseId
        );
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Enterprise license not found: " + licenseId);
        }
        audit.record("PLATFORM", null, actorEmail(), actorRole(),
            "ENTERPRISE_LICENSE_REVOKED", "ENTERPRISE_LICENSE", licenseId,
            "Revoked enterprise license " + licenseId + " — Reason: " + reason);
        return Map.of("id", licenseId, "status", "REVOKED", "revokedReason", reason, "revokedAt", now.toInstant().toString());
    }

    // --- Persisted Broadcasts Wired to Real OutboundMessagingService & In-App Alerts ---

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listBroadcasts() {
        return jdbcTemplate.queryForList("""
            SELECT id, channel, audience, title, message, recipient_count, dispatched_count, sent_by, sent_at
            FROM platform_broadcasts ORDER BY sent_at DESC LIMIT 50
            """).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("channel", r.get("channel"));
            m.put("audience", r.get("audience"));
            m.put("title", r.get("title"));
            m.put("message", r.get("message"));
            m.put("recipientCount", r.get("recipient_count"));
            m.put("dispatchedCount", r.get("dispatched_count"));
            m.put("sentBy", r.get("sent_by"));
            m.put("sentAt", formatTs(r.get("sent_at")));
            return m;
        }).toList();
    }

    @Transactional
    public Map<String, Object> sendBroadcast(SendPlatformBroadcastCmd cmd) {
        String channel = cmd.channel() != null ? cmd.channel().trim().toUpperCase() : "IN_APP";
        String audience = cmd.audience() != null && !cmd.audience().isBlank() ? cmd.audience().trim() : "ALL_ACTIVE";
        List<TenantEntity> targets = tenantRepo.findAll().stream()
            .filter(t -> !"ALL_ACTIVE".equalsIgnoreCase(audience) || "ACTIVE".equalsIgnoreCase(t.getStatus()))
            .toList();

        int dispatched = 0;
        Timestamp now = Timestamp.from(Instant.now());
        for (TenantEntity t : targets) {
            if ("IN_APP".equals(channel)) {
                jdbcTemplate.update("""
                    INSERT INTO alert_notifications (id, tenant_id, station_id, severity, category, title, message, read_flag, created_at)
                    VALUES (?, ?, NULL, 'INFO', 'PLATFORM_BROADCAST', ?, ?, FALSE, ?)
                    """, "alrt_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12),
                    t.getId(), cmd.title().trim(), cmd.message().trim(), now);
                dispatched++;
            } else {
                try {
                    messagingService.dispatch(
                        t.getId(), actorEmail(), channel, t.getOwnerEmail(),
                        cmd.title().trim(), cmd.message().trim(), "PLATFORM_BROADCAST"
                    );
                    dispatched++;
                } catch (Exception ignored) {
                    // Record broadcast even if individual provider fails
                }
            }
        }

        String id = "bc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        jdbcTemplate.update("""
            INSERT INTO platform_broadcasts (id, channel, audience, title, message, recipient_count, dispatched_count, sent_by, sent_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, id, channel, audience, cmd.title().trim(), cmd.message().trim(), targets.size(), dispatched, actorEmail(), now);

        audit.record("PLATFORM", null, actorEmail(), actorRole(),
            "PLATFORM_BROADCAST_SENT", "BROADCAST", id,
            "Sent " + channel + " broadcast '" + cmd.title().trim() + "' to " + dispatched + "/" + targets.size() + " tenants");

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("id", id);
        out.put("channel", channel);
        out.put("audience", audience);
        out.put("title", cmd.title().trim());
        out.put("message", cmd.message().trim());
        out.put("recipientCount", targets.size());
        out.put("dispatchedCount", dispatched);
        out.put("sentBy", actorEmail());
        out.put("sentAt", now.toInstant().toString());
        return out;
    }

    // --- Live Infrastructure & Platform Health Telemetry ---

    @Transactional(readOnly = true)
    public Map<String, Object> getHealthTelemetry() {
        long startNs = System.nanoTime();
        Integer dbPing = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
        long dbLatencyMs = Math.max(1L, (System.nanoTime() - startNs) / 1_000_000L);

        String flywayVersion = "V24";
        long flywayMigrationCount = 24L;
        try {
            List<Map<String, Object>> fw = jdbcTemplate.queryForList(
                "SELECT version FROM flyway_schema_history WHERE success = TRUE ORDER BY installed_rank DESC LIMIT 1"
            );
            if (!fw.isEmpty() && fw.get(0).get("version") != null) {
                flywayVersion = "V" + fw.get(0).get("version");
            }
            flywayMigrationCount = safeCountQuery("SELECT COUNT(*) FROM flyway_schema_history WHERE success = TRUE");
        } catch (Exception ignored) {}

        long edgeTotal = safeCountQuery("SELECT COUNT(*) FROM edge_devices WHERE revoked = FALSE");
        long edgeOnline = safeCountQuery("SELECT COUNT(*) FROM edge_devices WHERE revoked = FALSE AND status = 'ONLINE'");
        long webhooksTotal = safeCountQuery("SELECT COUNT(*) FROM webhook_deliveries");
        long webhooksFailed = safeCountQuery("SELECT COUNT(*) FROM webhook_deliveries WHERE success = FALSE");
        double webhookSuccessPct = webhooksTotal > 0
            ? Math.round(((webhooksTotal - webhooksFailed) * 1000.0) / webhooksTotal) / 10.0
            : 100.0;
        long connectorsConfigured = safeCountQuery("SELECT COUNT(*) FROM integration_connectors WHERE scope = 'GLOBAL' AND enabled = TRUE");
        long connectorsVerified = safeCountQuery("SELECT COUNT(*) FROM integration_connectors WHERE scope = 'GLOBAL' AND last_test_status = 'VERIFIED'");
        long momoPending = safeCountQuery("SELECT COUNT(*) FROM momo_transactions WHERE status = 'PENDING'");
        long momoFailed = safeCountQuery("SELECT COUNT(*) FROM momo_transactions WHERE status = 'FAILED'");

        Runtime rt = Runtime.getRuntime();
        long heapUsedMb = (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
        long heapMaxMb = rt.maxMemory() / (1024 * 1024);
        long uptimeSeconds = ManagementFactory.getRuntimeMXBean().getUptime() / 1000L;

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("status", dbPing != null && dbPing == 1 ? "HEALTHY" : "DEGRADED");
        out.put("databaseStatus", dbPing != null && dbPing == 1 ? "UP" : "DOWN");
        out.put("databaseLatencyMs", dbLatencyMs);
        out.put("flywaySchemaVersion", flywayVersion);
        out.put("flywayMigrationsApplied", flywayMigrationCount);
        out.put("javaVersion", System.getProperty("java.version"));
        out.put("heapUsedMb", heapUsedMb);
        out.put("heapMaxMb", heapMaxMb);
        out.put("uptimeSeconds", uptimeSeconds);
        out.put("edgeDevicesTotal", edgeTotal);
        out.put("edgeDevicesOnline", edgeOnline);
        out.put("webhooksTotal", webhooksTotal);
        out.put("webhooksFailed", webhooksFailed);
        out.put("webhookSuccessRatePct", webhookSuccessPct);
        out.put("connectorsConfigured", connectorsConfigured);
        out.put("connectorsVerified", connectorsVerified);
        out.put("momoPendingCount", momoPending);
        out.put("momoFailedCount", momoFailed);
        out.put("messagingProviders", messagingService.providerStatus());
        out.put("checkedAt", Instant.now().toString());
        return out;
    }

    // --- Cross-Tenant Platform Security & Super-Admin Audit Log ---

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPlatformAuditLogs(String tenantId, String actionFilter, int limit) {
        int safeLimit = Math.max(10, Math.min(250, limit));
        StringBuilder sql = new StringBuilder("""
            SELECT id, tenant_id, station_id, actor_email, actor_role, action, entity_type, entity_id, summary, created_at
            FROM audit_logs WHERE 1=1
            """);
        List<Object> params = new ArrayList<>();
        if (tenantId != null && !tenantId.isBlank() && !"ALL".equalsIgnoreCase(tenantId)) {
            sql.append(" AND tenant_id = ?");
            params.add(tenantId.trim());
        }
        if (actionFilter != null && !actionFilter.isBlank()) {
            sql.append(" AND UPPER(action) LIKE ?");
            params.add("%" + actionFilter.trim().toUpperCase() + "%");
        }
        sql.append(" ORDER BY created_at DESC LIMIT ").append(safeLimit);
        return jdbcTemplate.queryForList(sql.toString(), params.toArray()).stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id", r.get("id"));
            m.put("tenantId", r.get("tenant_id"));
            m.put("stationId", r.get("station_id"));
            m.put("actorEmail", r.get("actor_email"));
            m.put("actorRole", r.get("actor_role"));
            m.put("action", r.get("action"));
            m.put("entityType", r.get("entity_type"));
            m.put("entityId", r.get("entity_id"));
            m.put("summary", r.get("summary"));
            m.put("createdAt", formatTs(r.get("created_at")));
            return m;
        }).toList();
    }

    // --- Leads ---

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
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Lead not found: " + leadId);
        }
        return Map.of("id", leadId, "status", normalized, "updatedAt", Instant.now().toString());
    }

    // --- Helpers ---

    private Map<String, Object> normalizeTicketRow(Map<String, Object> r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.get("id"));
        m.put("ticketNumber", r.get("ticket_number"));
        m.put("tenantId", r.get("tenant_id"));
        m.put("tenantName", r.get("tenant_name"));
        m.put("stationId", r.get("station_id"));
        m.put("requesterEmail", r.get("requester_email"));
        m.put("subject", r.get("subject"));
        m.put("category", r.get("category"));
        m.put("priority", r.get("priority"));
        m.put("status", r.get("status"));
        m.put("assignedTo", r.get("assigned_to"));
        m.put("slaDueAt", formatTs(r.get("sla_due_at")));
        m.put("resolvedAt", formatTs(r.get("resolved_at")));
        m.put("messageCount", toLong(r.get("message_count")));
        m.put("createdAt", formatTs(r.get("created_at")));
        m.put("updatedAt", formatTs(r.get("updated_at")));
        return m;
    }

    private String normalizePlanCode(String raw) {
        if (raw == null || raw.isBlank()) return "growth";
        String low = raw.trim().toLowerCase();
        if (low.contains("start")) return "starter";
        if (low.contains("ent")) return "enterprise";
        return "growth";
    }

    private String planDisplayName(String code) {
        return switch (normalizePlanCode(code)) {
            case "starter" -> "Starter Station";
            case "enterprise" -> "Network Enterprise";
            default -> "Multi-Pump Pro";
        };
    }

    private long resolvePlanFeeFcfa(String code) {
        try {
            Long dbPrice = jdbcTemplate.queryForObject(
                "SELECT monthly_price_fcfa FROM platform_subscription_plans WHERE plan_code = ?",
                Long.class, normalizePlanCode(code)
            );
            if (dbPrice != null && dbPrice > 0) return dbPrice;
        } catch (Exception ignored) {}
        return switch (normalizePlanCode(code)) {
            case "starter" -> 25000L;
            case "enterprise" -> 120000L;
            default -> 55000L;
        };
    }

    private String formatTs(Object val) {
        if (val == null) return null;
        if (val instanceof Timestamp ts) return ts.toInstant().toString();
        return String.valueOf(val);
    }

    private long toLong(Object val) {
        if (val instanceof Number n) return n.longValue();
        if (val == null) return 0L;
        try { return Long.parseLong(String.valueOf(val)); } catch (Exception e) { return 0L; }
    }

    private long countQuery(String sql, Object... args) {
        Long val = jdbcTemplate.queryForObject(sql, Long.class, args);
        return val != null ? val : 0L;
    }

    private long sumQuery(String sql, Object... args) {
        Long val = jdbcTemplate.queryForObject(sql, Long.class, args);
        return val != null ? val : 0L;
    }

    private long safeCountQuery(String sql, Object... args) {
        try {
            return countQuery(sql, args);
        } catch (Exception e) {
            return 0L;
        }
    }

    private long safeSumQuery(String sql, Object... args) {
        try {
            return sumQuery(sql, args);
        } catch (Exception e) {
            return 0L;
        }
    }

    private List<Map<String, Object>> safeQueryForList(String sql, Object... args) {
        try {
            return jdbcTemplate.queryForList(sql, args);
        } catch (Exception e) {
            return List.of();
        }
    }
}

record UpdateStatusCommand(@NotBlank String status) {}

record CreatePlatformTenantCmd(
    @NotBlank String name,
    @NotBlank @Email String ownerEmail,
    String countryCode,
    String timezone,
    String city,
    String planCode,
    @Min(1) int initialStations,
    Integer trialDays
) {}

record UpdateTenantPlanCmd(
    @NotBlank String planCode,
    Long customMonthlyFeePerStationFcfa
) {}

record ExtendTrialCmd(
    @Min(1) int days,
    String reason
) {}

record CreateSupportTicketCmd(
    String tenantId,
    String tenantName,
    String stationId,
    String requesterEmail,
    @NotBlank String subject,
    @NotBlank String description,
    String category,
    String priority
) {}

record UpdateSupportTicketCmd(
    String status,
    String priority,
    String assignedTo
) {}

record PostSupportMessageCmd(
    @NotBlank String body,
    boolean internalNote,
    boolean notifyRequester
) {}

record StartImpersonationCmd(
    @NotBlank String tenantId,
    String tenantName,
    String ticketId,
    @NotBlank String reason
) {}

record IssueGlobalInvoiceCmd(
    @NotBlank String tenantId,
    @NotBlank String periodLabel,
    @Min(1) long totalFcfa,
    String channel
) {}

record MarkInvoicePaidCmd(
    String paymentChannel,
    String providerReference
) {}

record IssueEnterpriseLicenseCmd(
    String tenantId,
    @NotBlank String organizationName,
    String tierName,
    @Min(1) int maxStations,
    @Min(0) long annualFeeFcfa,
    String expiresAt
) {}

record RevokeLicenseCmd(String reason) {}

record SendPlatformBroadcastCmd(
    @NotBlank String channel,
    @NotBlank String audience,
    @NotBlank String title,
    @NotBlank String message
) {}

@RestController
@RequestMapping("/api/v1/platform-admin")
@PreAuthorize("hasRole('PLATFORM_ADMIN') or hasAuthority('SCOPE_platform:admin')")
public class PlatformAdminController {
    private final PlatformAdminService service;

    public PlatformAdminController(PlatformAdminService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    public Map<String, Object> overview() {
        return service.getOverview();
    }

    @GetMapping("/tenants")
    public List<Map<String, Object>> listTenants() {
        return service.listAllTenants();
    }

    @PostMapping("/tenants")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createTenant(@Valid @RequestBody CreatePlatformTenantCmd cmd) {
        return service.createTenant(cmd);
    }

    @GetMapping("/tenants/{tenantId}")
    public Map<String, Object> getTenantDetail(@PathVariable String tenantId) {
        return service.getTenantDetail(tenantId);
    }

    @PatchMapping("/tenants/{tenantId}/status")
    public Map<String, Object> updateTenantStatus(
        @PathVariable String tenantId,
        @Valid @RequestBody UpdateStatusCommand cmd
    ) {
        return service.updateTenantStatus(tenantId, cmd.status());
    }

    @PatchMapping("/tenants/{tenantId}/plan")
    public Map<String, Object> updateTenantPlan(
        @PathVariable String tenantId,
        @Valid @RequestBody UpdateTenantPlanCmd cmd
    ) {
        return service.updateTenantPlan(tenantId, cmd);
    }

    @PatchMapping("/tenants/{tenantId}/trial")
    public Map<String, Object> extendTenantTrial(
        @PathVariable String tenantId,
        @Valid @RequestBody ExtendTrialCmd cmd
    ) {
        return service.extendTenantTrial(tenantId, cmd);
    }

    @PostMapping("/tenants/{tenantId}/resend-access")
    public Map<String, Object> resendOwnerAccess(@PathVariable String tenantId) {
        return service.resendTenantOwnerAccess(tenantId);
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

    // --- Support Desk & Audited Impersonation ---

    @GetMapping("/support/tickets")
    public List<Map<String, Object>> listSupportTickets(
        @RequestParam(required = false) String status,
        @RequestParam(required = false) String tenantId,
        @RequestParam(required = false) String priority
    ) {
        return service.listSupportTickets(status, tenantId, priority);
    }

    @PostMapping("/support/tickets")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> createSupportTicket(@Valid @RequestBody CreateSupportTicketCmd cmd) {
        return service.createSupportTicket(cmd, "ten_opes_cm");
    }

    @PatchMapping("/support/tickets/{ticketId}")
    public Map<String, Object> updateSupportTicket(
        @PathVariable String ticketId,
        @RequestBody UpdateSupportTicketCmd cmd
    ) {
        return service.updateSupportTicket(ticketId, cmd);
    }

    @GetMapping("/support/tickets/{ticketId}/messages")
    public List<Map<String, Object>> listTicketMessages(@PathVariable String ticketId) {
        return service.listTicketMessages(ticketId);
    }

    @PostMapping("/support/tickets/{ticketId}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> postTicketMessage(
        @PathVariable String ticketId,
        @Valid @RequestBody PostSupportMessageCmd cmd
    ) {
        return service.postTicketMessage(ticketId, cmd);
    }

    @GetMapping("/support/impersonations")
    public List<Map<String, Object>> listImpersonationSessions() {
        return service.listImpersonationSessions();
    }

    @PostMapping("/support/impersonations")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> startImpersonation(@Valid @RequestBody StartImpersonationCmd cmd) {
        return service.startImpersonation(cmd);
    }

    @PostMapping("/support/impersonations/{sessionId}/end")
    public Map<String, Object> endImpersonation(@PathVariable String sessionId) {
        return service.endImpersonation(sessionId);
    }

    // --- Global Billing & Cameroon MoMo Settlement Ledger ---

    @GetMapping("/invoices")
    public List<Map<String, Object>> listGlobalInvoices() {
        return service.listGlobalInvoices();
    }

    @PostMapping("/invoices")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> issueGlobalInvoice(@Valid @RequestBody IssueGlobalInvoiceCmd cmd) {
        return service.issueGlobalInvoice(cmd);
    }

    @PostMapping("/invoices/{invoiceId}/mark-paid")
    public Map<String, Object> markGlobalInvoicePaid(
        @PathVariable String invoiceId,
        @RequestBody(required = false) MarkInvoicePaidCmd cmd
    ) {
        return service.markGlobalInvoicePaid(invoiceId, cmd);
    }

    @GetMapping("/momo-settlements")
    public List<Map<String, Object>> listGlobalMomoSettlements() {
        return service.listGlobalMomoSettlements();
    }

    // --- Enterprise Licenses ---

    @GetMapping("/licenses")
    public List<Map<String, Object>> listEnterpriseLicenses() {
        return service.listEnterpriseLicenses();
    }

    @PostMapping("/licenses")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> issueEnterpriseLicense(@Valid @RequestBody IssueEnterpriseLicenseCmd cmd) {
        return service.issueEnterpriseLicense(cmd);
    }

    @PostMapping("/licenses/{licenseId}/revoke")
    public Map<String, Object> revokeEnterpriseLicense(
        @PathVariable String licenseId,
        @RequestBody(required = false) RevokeLicenseCmd cmd
    ) {
        return service.revokeEnterpriseLicense(licenseId, cmd);
    }

    // --- Broadcasts, Live Health & Platform Audit ---

    @GetMapping("/broadcasts")
    public List<Map<String, Object>> listBroadcasts() {
        return service.listBroadcasts();
    }

    @PostMapping("/broadcasts")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> sendBroadcast(@Valid @RequestBody SendPlatformBroadcastCmd cmd) {
        return service.sendBroadcast(cmd);
    }

    @GetMapping("/health-telemetry")
    public Map<String, Object> getHealthTelemetry() {
        return service.getHealthTelemetry();
    }

    @GetMapping("/audit-logs")
    public List<Map<String, Object>> listPlatformAuditLogs(
        @RequestParam(required = false) String tenantId,
        @RequestParam(required = false) String action,
        @RequestParam(defaultValue = "80") int limit
    ) {
        return service.listPlatformAuditLogs(tenantId, action, limit);
    }
}

@RestController
@RequestMapping("/api/v1/support/tickets")
@PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO','OWNER','MANAGER','ACCOUNTANT')")
class TenantSupportTicketController {
    private final PlatformAdminService service;
    private final TenantAccessGuard accessGuard;

    TenantSupportTicketController(PlatformAdminService service, TenantAccessGuard accessGuard) {
        this.service = service;
        this.accessGuard = accessGuard;
    }

    @GetMapping
    public List<Map<String, Object>> listMyTenantTickets() {
        return service.listSupportTickets(null, accessGuard.currentTenantId(), null);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> submitTicket(@Valid @RequestBody CreateSupportTicketCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        CreateSupportTicketCmd scoped = new CreateSupportTicketCmd(
            tenantId,
            cmd.tenantName(),
            cmd.stationId(),
            cmd.requesterEmail(),
            cmd.subject(),
            cmd.description(),
            cmd.category(),
            cmd.priority()
        );
        return service.createSupportTicket(scoped, tenantId);
    }

    @GetMapping("/{ticketId}/messages")
    public List<Map<String, Object>> listMyTicketMessages(@PathVariable String ticketId) {
        return service.listTenantTicketMessages(accessGuard.currentTenantId(), ticketId);
    }

    @PostMapping("/{ticketId}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, Object> replyToMyTicket(
        @PathVariable String ticketId,
        @Valid @RequestBody TenantTicketReplyCmd cmd
    ) {
        return service.postTenantTicketReply(accessGuard.currentTenantId(), ticketId, cmd.body());
    }
}

record TenantTicketReplyCmd(@NotBlank String body) {}

