package com.opesware.opesfuel.hr;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

record UpsertContractCommand(
    @NotBlank String stationId,
    @NotBlank String employeeId,
    @NotBlank String employeeName,
    @NotBlank String contractType,
    String cnpsNumber,
    @Min(0) long baseSalaryFcfa,
    @Min(0) long transportAllowanceFcfa,
    @Min(0) long housingAllowanceFcfa,
    String emergencyContactName,
    String emergencyContactPhone,
    @NotBlank String startDate,
    String endDate
) {}

record CreateLeaveCommand(
    @NotBlank String stationId,
    @NotBlank String employeeId,
    @NotBlank String employeeName,
    @NotBlank String leaveType,
    @NotBlank String startDate,
    @NotBlank String endDate,
    @Min(1) int daysCount,
    String reason
) {}

record LeaveDecisionCommand(@NotBlank String status) {}

record CreateCertificationCommand(
    @NotBlank String stationId,
    @NotBlank String employeeId,
    @NotBlank String employeeName,
    @NotBlank String certName,
    @NotBlank String issuer,
    @NotBlank String issuedDate,
    @NotBlank String expiresDate
) {}

record CreateDisciplinaryCommand(
    @NotBlank String stationId,
    @NotBlank String employeeId,
    @NotBlank String employeeName,
    @NotBlank String category,
    @NotBlank String severity,
    @NotBlank String summary,
    @Min(0) long amountFcfa
) {}

@RestController
@RequestMapping("/api/v1/hr")
public class HrController {
    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;

    public HrController(JdbcTemplate jdbcTemplate, TenantAccessGuard accessGuard, AuditTrailRecorder auditRecorder) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_workforce:read')")
    public Map<String, Object> overview() {
        String tenantId = accessGuard.currentTenantId();
        long contracts = count("SELECT COUNT(*) FROM hr_contracts WHERE tenant_id = ? AND status = 'ACTIVE'", tenantId);
        long pendingLeaves = count("SELECT COUNT(*) FROM hr_leave_requests WHERE tenant_id = ? AND status = 'PENDING'", tenantId);
        long approvedLeaves = count("SELECT COUNT(*) FROM hr_leave_requests WHERE tenant_id = ? AND status = 'APPROVED'", tenantId);
        long totalCerts = count("SELECT COUNT(*) FROM hr_training_certs WHERE tenant_id = ?", tenantId);
        long expiringCerts = count("SELECT COUNT(*) FROM hr_training_certs WHERE tenant_id = ? AND status IN ('EXPIRING_SOON','EXPIRED')", tenantId);
        long disciplinaryEvents = count("SELECT COUNT(*) FROM hr_disciplinary_records WHERE tenant_id = ?", tenantId);
        long monthlyAllowances = count("SELECT COALESCE(SUM(transport_allowance_fcfa + housing_allowance_fcfa), 0) FROM hr_contracts WHERE tenant_id = ? AND status = 'ACTIVE'", tenantId);

        return Map.of(
            "activeContracts", contracts,
            "pendingLeaves", pendingLeaves,
            "approvedLeaves", approvedLeaves,
            "safetyCertifications", totalCerts,
            "expiringCertifications", expiringCerts,
            "disciplinaryRecords", disciplinaryEvents,
            "monthlyAllowancesFcfa", monthlyAllowances
        );
    }

    @GetMapping("/contracts")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_workforce:read')")
    public List<Map<String, Object>> listContracts(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        boolean filterStation = stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId);
        String sql = filterStation
            ? "SELECT * FROM hr_contracts WHERE tenant_id = ? AND station_id = ? ORDER BY updated_at DESC"
            : "SELECT * FROM hr_contracts WHERE tenant_id = ? ORDER BY updated_at DESC";
        Object[] args = filterStation ? new Object[]{tenantId, stationId} : new Object[]{tenantId};
        return jdbcTemplate.query(sql, (rs, idx) -> Map.<String, Object>ofEntries(
            Map.entry("id", rs.getString("id")),
            Map.entry("stationId", rs.getString("station_id")),
            Map.entry("employeeId", rs.getString("employee_id")),
            Map.entry("employeeName", rs.getString("employee_name")),
            Map.entry("contractType", rs.getString("contract_type")),
            Map.entry("cnpsNumber", rs.getString("cnps_number") != null ? rs.getString("cnps_number") : ""),
            Map.entry("baseSalaryFcfa", rs.getLong("base_salary_fcfa")),
            Map.entry("transportAllowanceFcfa", rs.getLong("transport_allowance_fcfa")),
            Map.entry("housingAllowanceFcfa", rs.getLong("housing_allowance_fcfa")),
            Map.entry("emergencyContactName", rs.getString("emergency_contact_name") != null ? rs.getString("emergency_contact_name") : ""),
            Map.entry("emergencyContactPhone", rs.getString("emergency_contact_phone") != null ? rs.getString("emergency_contact_phone") : ""),
            Map.entry("startDate", rs.getString("start_date")),
            Map.entry("endDate", rs.getString("end_date") != null ? rs.getString("end_date") : ""),
            Map.entry("status", rs.getString("status"))
        ), args);
    }

    @PostMapping("/contracts")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER') or hasAuthority('SCOPE_workforce:write')")
    public Map<String, Object> createContract(@Valid @RequestBody UpsertContractCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String id = "hrc_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO hr_contracts (
                id, tenant_id, station_id, employee_id, employee_name, contract_type, cnps_number,
                base_salary_fcfa, transport_allowance_fcfa, housing_allowance_fcfa,
                emergency_contact_name, emergency_contact_phone, start_date, end_date, status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
            """,
            id, principal.tenantId(), cmd.stationId(), cmd.employeeId(), cmd.employeeName(),
            cmd.contractType().trim().toUpperCase(), cmd.cnpsNumber(),
            cmd.baseSalaryFcfa(), cmd.transportAllowanceFcfa(), cmd.housingAllowanceFcfa(),
            cmd.emergencyContactName(), cmd.emergencyContactPhone(),
            cmd.startDate(), cmd.endDate(), Timestamp.from(Instant.now())
        );
        auditRecorder.record(
            principal.tenantId(), cmd.stationId(), principal.subject(),
            principal.roles().stream().findFirst().orElse("MANAGER"),
            "HR_CONTRACT_CREATED", "HR_CONTRACT", id,
            "Recorded " + cmd.contractType() + " contract for " + cmd.employeeName() + " (" + cmd.baseSalaryFcfa() + " FCFA base)"
        );
        return Map.of("id", id, "employeeName", cmd.employeeName(), "contractType", cmd.contractType().toUpperCase(), "status", "ACTIVE");
    }

    @GetMapping("/leaves")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT') or hasAuthority('SCOPE_workforce:read')")
    public List<Map<String, Object>> listLeaves(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        boolean filterStation = stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId);
        String sql = filterStation
            ? "SELECT * FROM hr_leave_requests WHERE tenant_id = ? AND station_id = ? ORDER BY created_at DESC"
            : "SELECT * FROM hr_leave_requests WHERE tenant_id = ? ORDER BY created_at DESC";
        Object[] args = filterStation ? new Object[]{tenantId, stationId} : new Object[]{tenantId};
        return jdbcTemplate.query(sql, (rs, idx) -> Map.<String, Object>ofEntries(
            Map.entry("id", rs.getString("id")),
            Map.entry("stationId", rs.getString("station_id")),
            Map.entry("employeeId", rs.getString("employee_id")),
            Map.entry("employeeName", rs.getString("employee_name")),
            Map.entry("leaveType", rs.getString("leave_type")),
            Map.entry("startDate", rs.getString("start_date")),
            Map.entry("endDate", rs.getString("end_date")),
            Map.entry("daysCount", rs.getInt("days_count")),
            Map.entry("reason", rs.getString("reason") != null ? rs.getString("reason") : ""),
            Map.entry("status", rs.getString("status")),
            Map.entry("reviewedBy", rs.getString("reviewed_by") != null ? rs.getString("reviewed_by") : "")
        ), args);
    }

    @PostMapping("/leaves")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT') or hasAuthority('SCOPE_workforce:write')")
    public Map<String, Object> createLeave(@Valid @RequestBody CreateLeaveCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String id = "hrl_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO hr_leave_requests (
                id, tenant_id, station_id, employee_id, employee_name, leave_type,
                start_date, end_date, days_count, reason, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
            """,
            id, principal.tenantId(), cmd.stationId(), cmd.employeeId(), cmd.employeeName(),
            cmd.leaveType().trim().toUpperCase(), cmd.startDate(), cmd.endDate(),
            cmd.daysCount(), cmd.reason(), Timestamp.from(Instant.now())
        );
        return Map.of("id", id, "status", "PENDING", "daysCount", cmd.daysCount());
    }

    @PatchMapping("/leaves/{leaveId}/decision")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER') or hasAuthority('SCOPE_workforce:write')")
    public Map<String, Object> decideLeave(@PathVariable String leaveId, @Valid @RequestBody LeaveDecisionCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String normalized = cmd.status().trim().toUpperCase();
        if (!"APPROVED".equals(normalized) && !"REJECTED".equals(normalized)) {
            throw new IllegalArgumentException("Leave status must be APPROVED or REJECTED.");
        }
        int updated = jdbcTemplate.update(
            "UPDATE hr_leave_requests SET status = ?, reviewed_by = ? WHERE id = ? AND tenant_id = ?",
            normalized, principal.subject(), leaveId, principal.tenantId()
        );
        if (updated == 0) {
            throw new IllegalArgumentException("Leave request not found: " + leaveId);
        }
        auditRecorder.record(
            principal.tenantId(), null, principal.subject(),
            principal.roles().stream().findFirst().orElse("MANAGER"),
            "HR_LEAVE_" + normalized, "HR_LEAVE", leaveId,
            "Leave request " + leaveId + " marked " + normalized
        );
        return Map.of("id", leaveId, "status", normalized, "reviewedBy", principal.subject());
    }

    @GetMapping("/certifications")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_workforce:read')")
    public List<Map<String, Object>> listCertifications(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        boolean filterStation = stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId);
        String sql = filterStation
            ? "SELECT * FROM hr_training_certs WHERE tenant_id = ? AND station_id = ? ORDER BY expires_date ASC"
            : "SELECT * FROM hr_training_certs WHERE tenant_id = ? ORDER BY expires_date ASC";
        Object[] args = filterStation ? new Object[]{tenantId, stationId} : new Object[]{tenantId};
        return jdbcTemplate.query(sql, (rs, idx) -> Map.<String, Object>of(
            "id", rs.getString("id"),
            "stationId", rs.getString("station_id"),
            "employeeId", rs.getString("employee_id"),
            "employeeName", rs.getString("employee_name"),
            "certName", rs.getString("cert_name"),
            "issuer", rs.getString("issuer"),
            "issuedDate", rs.getString("issued_date"),
            "expiresDate", rs.getString("expires_date"),
            "status", rs.getString("status")
        ), args);
    }

    @PostMapping("/certifications")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER') or hasAuthority('SCOPE_workforce:write')")
    public Map<String, Object> createCertification(@Valid @RequestBody CreateCertificationCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String id = "hrcert_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO hr_training_certs (id, tenant_id, station_id, employee_id, employee_name, cert_name, issuer, issued_date, expires_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'VALID')
            """,
            id, principal.tenantId(), cmd.stationId(), cmd.employeeId(), cmd.employeeName(),
            cmd.certName(), cmd.issuer(), cmd.issuedDate(), cmd.expiresDate()
        );
        return Map.of("id", id, "certName", cmd.certName(), "status", "VALID");
    }

    @GetMapping("/disciplinary")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_workforce:read')")
    public List<Map<String, Object>> listDisciplinary(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        boolean filterStation = stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId);
        String sql = filterStation
            ? "SELECT * FROM hr_disciplinary_records WHERE tenant_id = ? AND station_id = ? ORDER BY recorded_at DESC"
            : "SELECT * FROM hr_disciplinary_records WHERE tenant_id = ? ORDER BY recorded_at DESC";
        Object[] args = filterStation ? new Object[]{tenantId, stationId} : new Object[]{tenantId};
        return jdbcTemplate.query(sql, (rs, idx) -> Map.<String, Object>of(
            "id", rs.getString("id"),
            "stationId", rs.getString("station_id"),
            "employeeId", rs.getString("employee_id"),
            "employeeName", rs.getString("employee_name"),
            "category", rs.getString("category"),
            "severity", rs.getString("severity"),
            "summary", rs.getString("summary"),
            "amountFcfa", rs.getLong("amount_fcfa"),
            "recordedBy", rs.getString("recorded_by"),
            "recordedAt", rs.getTimestamp("recorded_at").toInstant().toString()
        ), args);
    }

    @PostMapping("/disciplinary")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER') or hasAuthority('SCOPE_workforce:write')")
    public Map<String, Object> createDisciplinary(@Valid @RequestBody CreateDisciplinaryCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String id = "hrd_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO hr_disciplinary_records (
                id, tenant_id, station_id, employee_id, employee_name, category, severity, summary, amount_fcfa, recorded_by, recorded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id, principal.tenantId(), cmd.stationId(), cmd.employeeId(), cmd.employeeName(),
            cmd.category().trim().toUpperCase(), cmd.severity().trim().toUpperCase(),
            cmd.summary(), cmd.amountFcfa(), principal.subject(), Timestamp.from(Instant.now())
        );
        auditRecorder.record(
            principal.tenantId(), cmd.stationId(), principal.subject(),
            principal.roles().stream().findFirst().orElse("MANAGER"),
            "HR_DISCIPLINARY_LOGGED", "HR_DISCIPLINARY", id,
            cmd.severity() + " (" + cmd.category() + ") logged for " + cmd.employeeName()
        );
        return Map.of("id", id, "category", cmd.category().toUpperCase(), "severity", cmd.severity().toUpperCase());
    }

    private long count(String sql, Object... args) {
        Long val = jdbcTemplate.queryForObject(sql, Long.class, args);
        return val != null ? val : 0L;
    }
}
