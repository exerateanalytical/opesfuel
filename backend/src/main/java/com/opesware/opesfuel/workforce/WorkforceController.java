package com.opesware.opesfuel.workforce;

import com.opesware.opesfuel.shared.domain.DomainEnums;
import com.opesware.opesfuel.shared.domain.DomainEnums.EmployeeRole;
import com.opesware.opesfuel.shared.domain.DomainEnums.ExpensePaymentSource;
import com.opesware.opesfuel.shared.events.DomainEvent.PayrollDisbursedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftClosedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftVoidedEvent;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import com.opesware.opesfuel.station.StationCatalogApi;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Entity
@Table(name = "employees")
class EmployeeEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "auth0_sub")
    private String auth0Sub;
    @Column(name = "full_name", nullable = false)
    private String fullName;
    @Column(nullable = false)
    private String role;
    @Column(nullable = false)
    private String phone;
    @Column(name = "shift_window", nullable = false)
    private String shiftWindow;
    @Column(name = "clocked_in", nullable = false)
    private boolean clockedIn;
    @Column(name = "base_salary_fcfa", nullable = false)
    private long baseSalaryFcfa;
    @Column(name = "cumulative_variance_fcfa", nullable = false)
    private long cumulativeVarianceFcfa;
    @Version
    private long version;

    public static EmployeeEntity create(String stationId, String fullName, String role, String phone, String shiftWindow, long baseSalaryFcfa, String auth0Sub) {
        EmployeeRole validatedRole = DomainEnums.parse(EmployeeRole.class, role, "role");
        EmployeeEntity e = new EmployeeEntity();
        e.id = "emp_" + UUID.randomUUID();
        e.stationId = stationId;
        e.auth0Sub = (auth0Sub != null && !auth0Sub.isBlank()) ? auth0Sub.trim() : null;
        e.fullName = fullName.trim();
        e.role = validatedRole.name();
        e.phone = phone.trim();
        e.shiftWindow = (shiftWindow != null && !shiftWindow.isBlank()) ? shiftWindow.trim() : "06:00 - 14:00";
        e.clockedIn = false;
        e.baseSalaryFcfa = baseSalaryFcfa;
        e.cumulativeVarianceFcfa = 0L;
        return e;
    }

    public void applyShiftVariance(long varianceFcfa) {
        this.cumulativeVarianceFcfa += varianceFcfa;
    }

    public long settlePayrollDeduction() {
        long deduction = Math.min(0L, this.cumulativeVarianceFcfa);
        if (deduction < 0L) {
            this.cumulativeVarianceFcfa = 0L;
        }
        return deduction;
    }

    public void toggleClockIn() {
        this.clockedIn = !this.clockedIn;
    }

    public void updateProfile(String fullName, String role, String phone, String shiftWindow, long baseSalaryFcfa, String auth0Sub) {
        EmployeeRole validatedRole = DomainEnums.parse(EmployeeRole.class, role, "role");
        this.fullName = fullName.trim();
        this.role = validatedRole.name();
        this.phone = phone.trim();
        this.shiftWindow = shiftWindow.trim();
        this.baseSalaryFcfa = baseSalaryFcfa;
        if (auth0Sub != null) {
            this.auth0Sub = auth0Sub.isBlank() ? null : auth0Sub.trim();
        }
    }

    public WorkforceQueryApi.EmployeeSnapshot toSnapshot() {
        return new WorkforceQueryApi.EmployeeSnapshot(id, stationId, fullName, role, auth0Sub);
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getAuth0Sub() { return auth0Sub; }
    public String getFullName() { return fullName; }
    public String getRole() { return role; }
    public String getPhone() { return phone; }
    public String getShiftWindow() { return shiftWindow; }
    public boolean isClockedIn() { return clockedIn; }
    public long getBaseSalaryFcfa() { return baseSalaryFcfa; }
    public long getCumulativeVarianceFcfa() { return cumulativeVarianceFcfa; }
}

@Entity
@Table(name = "payroll_runs")
class PayrollRunEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "period_label", nullable = false)
    private String periodLabel;
    @Column(name = "employee_count", nullable = false)
    private int employeeCount;
    @Column(name = "total_base_fcfa", nullable = false)
    private long totalBaseFcfa;
    @Column(name = "total_deductions_fcfa", nullable = false)
    private long totalDeductionsFcfa;
    @Column(name = "total_net_paid_fcfa", nullable = false)
    private long totalNetPaidFcfa;
    @Column(name = "payment_source", nullable = false)
    private String paymentSource;
    @Column(name = "executed_at", nullable = false)
    private Instant executedAt;

    public static PayrollRunEntity create(
        String stationId, String periodLabel, int employeeCount,
        long totalBaseFcfa, long totalDeductionsFcfa, long totalNetPaidFcfa, String paymentSource
    ) {
        PayrollRunEntity run = new PayrollRunEntity();
        run.id = "pay_" + UUID.randomUUID();
        run.stationId = stationId;
        run.periodLabel = periodLabel.trim();
        run.employeeCount = employeeCount;
        run.totalBaseFcfa = totalBaseFcfa;
        run.totalDeductionsFcfa = totalDeductionsFcfa;
        run.totalNetPaidFcfa = totalNetPaidFcfa;
        run.paymentSource = paymentSource;
        run.executedAt = Instant.now();
        return run;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getPeriodLabel() { return periodLabel; }
    public int getEmployeeCount() { return employeeCount; }
    public long getTotalBaseFcfa() { return totalBaseFcfa; }
    public long getTotalDeductionsFcfa() { return totalDeductionsFcfa; }
    public long getTotalNetPaidFcfa() { return totalNetPaidFcfa; }
    public String getPaymentSource() { return paymentSource; }
    public Instant getExecutedAt() { return executedAt; }
}

@Entity
@Table(name = "attendance_logs")
class AttendanceLogEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "employee_id", nullable = false)
    private String employeeId;
    @Column(name = "clock_in_at", nullable = false)
    private Instant clockInAt;
    @Column(name = "clock_out_at")
    private Instant clockOutAt;
    @Column(name = "worked_minutes")
    private Long workedMinutes;
    @Column(name = "recorded_by", nullable = false)
    private String recordedBy;

    public static AttendanceLogEntity clockIn(String stationId, String employeeId, String recordedBy) {
        AttendanceLogEntity log = new AttendanceLogEntity();
        log.id = "att_" + UUID.randomUUID();
        log.stationId = stationId;
        log.employeeId = employeeId;
        log.clockInAt = Instant.now();
        log.recordedBy = recordedBy;
        return log;
    }

    public void clockOut() {
        this.clockOutAt = Instant.now();
        this.workedMinutes = Math.max(0L, java.time.Duration.between(this.clockInAt, this.clockOutAt).toMinutes());
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getEmployeeId() { return employeeId; }
    public Instant getClockInAt() { return clockInAt; }
    public Instant getClockOutAt() { return clockOutAt; }
    public Long getWorkedMinutes() { return workedMinutes; }
    public String getRecordedBy() { return recordedBy; }
}

interface EmployeeRepository extends JpaRepository<EmployeeEntity, String> {
    List<EmployeeEntity> findByStationIdInOrderByFullNameAsc(List<String> stationIds);
    List<EmployeeEntity> findByStationIdOrderByFullNameAsc(String stationId);
    Optional<EmployeeEntity> findFirstByAuth0Sub(String auth0Sub);
}

interface PayrollRunRepository extends JpaRepository<PayrollRunEntity, String> {
    List<PayrollRunEntity> findByStationIdInOrderByExecutedAtDesc(List<String> stationIds);
}

interface AttendanceLogRepository extends JpaRepository<AttendanceLogEntity, String> {
    List<AttendanceLogEntity> findTop50ByEmployeeIdOrderByClockInAtDesc(String employeeId);
    Optional<AttendanceLogEntity> findFirstByEmployeeIdAndClockOutAtIsNullOrderByClockInAtDesc(String employeeId);
}

@Service
class WorkforceService implements WorkforceQueryApi {
    private final EmployeeRepository repository;
    private final PayrollRunRepository payrollRunRepo;
    private final AttendanceLogRepository attendanceLogRepo;
    private final StationCatalogApi stationCatalogApi;
    private final TenantAccessGuard accessGuard;
    private final JdbcTemplate jdbcTemplate;
    private final ApplicationEventPublisher eventPublisher;

    WorkforceService(
        EmployeeRepository repository,
        PayrollRunRepository payrollRunRepo,
        AttendanceLogRepository attendanceLogRepo,
        StationCatalogApi stationCatalogApi,
        TenantAccessGuard accessGuard,
        JdbcTemplate jdbcTemplate,
        ApplicationEventPublisher eventPublisher
    ) {
        this.repository = repository;
        this.payrollRunRepo = payrollRunRepo;
        this.attendanceLogRepo = attendanceLogRepo;
        this.stationCatalogApi = stationCatalogApi;
        this.accessGuard = accessGuard;
        this.jdbcTemplate = jdbcTemplate;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<EmployeeSnapshot> findEmployee(String employeeId) {
        return repository.findById(employeeId).map(EmployeeEntity::toSnapshot);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<EmployeeSnapshot> findByAuth0Sub(String auth0Sub) {
        if (auth0Sub == null || auth0Sub.isBlank()) return Optional.empty();
        return repository.findFirstByAuth0Sub(auth0Sub).map(EmployeeEntity::toSnapshot);
    }

    @Override
    @Transactional
    public void linkAuth0Sub(String employeeId, String auth0Sub) {
        EmployeeEntity emp = repository.findById(employeeId)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + employeeId));
        emp.updateProfile(emp.getFullName(), emp.getRole(), emp.getPhone(), emp.getShiftWindow(), emp.getBaseSalaryFcfa(), auth0Sub);
        repository.save(emp);
    }

    @ApplicationModuleListener
    public void onShiftClosed(ShiftClosedEvent event) {
        if (event.varianceFcfa() == 0) return;
        repository.findById(event.attendantId()).ifPresent(emp -> {
            emp.applyShiftVariance(event.varianceFcfa());
            repository.save(emp);
        });
    }

    @ApplicationModuleListener
    public void onShiftVoided(ShiftVoidedEvent event) {
        if (event.varianceFcfa() == 0) return;
        repository.findById(event.attendantId()).ifPresent(emp -> {
            emp.applyShiftVariance(-event.varianceFcfa());
            repository.save(emp);
        });
    }

    /** The caller's own employee profile (no salary data). Used by the mobile app to open/close the caller's own shifts. */
    @Transactional(readOnly = true)
    public java.util.Map<String, Object> getMyProfile() {
        String sub = accessGuard.currentPrincipal().auth0Sub();
        EmployeeEntity emp = repository.findFirstByAuth0Sub(sub == null ? "" : sub)
            .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(
                HttpStatus.NOT_FOUND, "No employee record is linked to this login."));
        stationCatalogApi.requireAccessibleStation(emp.getStationId());
        java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("id", emp.getId());
        out.put("stationId", emp.getStationId());
        out.put("fullName", emp.getFullName());
        out.put("role", emp.getRole());
        out.put("clockedIn", emp.isClockedIn());
        out.put("shiftWindow", emp.getShiftWindow());
        return out;
    }

    @Transactional(readOnly = true)
    public List<EmployeeEntity> listEmployees(String stationId) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return repository.findByStationIdInOrderByFullNameAsc(stationIds);
    }

    @Transactional(readOnly = true)
    public List<PayrollLineDto> getPayrollSummary(String stationId) {
        List<EmployeeEntity> staff = listEmployees(stationId);
        return staff.stream()
            .map(e -> {
                long shortageDeduction = Math.min(0L, e.getCumulativeVarianceFcfa());
                long netPayable = Math.max(0L, e.getBaseSalaryFcfa() + shortageDeduction);
                return new PayrollLineDto(
                    e.getId(), e.getFullName(), e.getRole(),
                    e.getBaseSalaryFcfa(), shortageDeduction, netPayable
                );
            })
            .toList();
    }

    @Transactional(readOnly = true)
    public PayslipDto buildPayslip(String employeeId) {
        EmployeeEntity emp = repository.findById(employeeId)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + employeeId));
        stationCatalogApi.requireAccessibleStation(emp.getStationId());
        long base = emp.getBaseSalaryFcfa();
        long shortage = Math.min(0L, emp.getCumulativeVarianceFcfa());
        // Standard CEMAC employee social security estimate (CNPS 4.2% employee share)
        long cnpsEmployeeFcfa = Math.round(base * 0.042);
        long netAfterShortage = Math.max(0L, base + shortage);
        long netTakeHomeFcfa = Math.max(0L, netAfterShortage - cnpsEmployeeFcfa);
        long loggedMinutes = attendanceLogRepo.findTop50ByEmployeeIdOrderByClockInAtDesc(employeeId).stream()
            .mapToLong(l -> l.getWorkedMinutes() != null ? l.getWorkedMinutes() : 0L)
            .sum();
        return new PayslipDto(
            emp.getId(), emp.getStationId(), emp.getFullName(), emp.getRole(),
            base, shortage, cnpsEmployeeFcfa, netAfterShortage, netTakeHomeFcfa, loggedMinutes, Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public List<AttendanceLogEntity> listAttendanceLogs(String employeeId) {
        EmployeeEntity emp = repository.findById(employeeId)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + employeeId));
        stationCatalogApi.requireAccessibleStation(emp.getStationId());
        return attendanceLogRepo.findTop50ByEmployeeIdOrderByClockInAtDesc(employeeId);
    }

    @Transactional
    public PayrollRunEntity executePayrollRun(ExecutePayrollRunCommand cmd) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(cmd.stationId());
        ExpensePaymentSource source = DomainEnums.parse(ExpensePaymentSource.class, cmd.paymentSource(), "paymentSource");
        List<EmployeeEntity> staff = repository.findByStationIdOrderByFullNameAsc(cmd.stationId());
        if (staff.isEmpty()) {
            throw new IllegalStateException("No active employees found for station " + cmd.stationId());
        }

        long totalBase = 0L;
        long totalDeductions = 0L;
        long totalNetPaid = 0L;
        for (EmployeeEntity emp : staff) {
            long base = emp.getBaseSalaryFcfa();
            long deduction = emp.settlePayrollDeduction();
            long net = Math.max(0L, base + deduction);
            totalBase += base;
            totalDeductions += Math.abs(deduction);
            totalNetPaid += net;
        }
        repository.saveAll(staff);

        PayrollRunEntity run = payrollRunRepo.save(PayrollRunEntity.create(
            cmd.stationId(), cmd.periodLabel(), staff.size(), totalBase, totalDeductions, totalNetPaid, source.name()
        ));

        if (totalNetPaid > 0) {
            eventPublisher.publishEvent(new PayrollDisbursedEvent(
                UUID.randomUUID().toString(), run.getId(), station.tenantId(), cmd.stationId(),
                run.getPeriodLabel(), totalNetPaid, source.name(), run.getExecutedAt()
            ));
        }
        return run;
    }

    @Transactional(readOnly = true)
    public List<PayrollRunEntity> listPayrollRuns(String stationId) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return payrollRunRepo.findByStationIdInOrderByExecutedAtDesc(stationIds);
    }

    @Transactional
    public EmployeeEntity create(CreateEmployeeCommand cmd) {
        stationCatalogApi.requireAccessibleStation(cmd.stationId());
        return repository.save(EmployeeEntity.create(
            cmd.stationId(), cmd.fullName(), cmd.role(), cmd.phone(), cmd.shiftWindow(), cmd.baseSalaryFcfa(), cmd.auth0Sub()
        ));
    }

    @Transactional
    public EmployeeEntity toggleAttendance(String employeeId) {
        EmployeeEntity emp = repository.findById(employeeId)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + employeeId));
        stationCatalogApi.requireAccessibleStation(emp.getStationId());
        accessGuard.assertSelfOrManager(emp.getAuth0Sub());
        emp.toggleClockIn();
        EmployeeEntity saved = repository.save(emp);

        String actor = accessGuard.currentPrincipal().principalId();
        if (saved.isClockedIn()) {
            attendanceLogRepo.save(AttendanceLogEntity.clockIn(saved.getStationId(), saved.getId(), actor));
        } else {
            attendanceLogRepo.findFirstByEmployeeIdAndClockOutAtIsNullOrderByClockInAtDesc(saved.getId())
                .ifPresent(openLog -> {
                    openLog.clockOut();
                    attendanceLogRepo.save(openLog);
                });
        }
        return saved;
    }

    @Transactional
    public EmployeeEntity update(String employeeId, UpdateEmployeeCommand cmd) {
        EmployeeEntity emp = repository.findById(employeeId)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + employeeId));
        stationCatalogApi.requireAccessibleStation(emp.getStationId());
        emp.updateProfile(cmd.fullName(), cmd.role(), cmd.phone(), cmd.shiftWindow(), cmd.baseSalaryFcfa(), cmd.auth0Sub());
        return repository.save(emp);
    }

    @Transactional
    public void delete(String employeeId) {
        EmployeeEntity emp = repository.findById(employeeId)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + employeeId));
        stationCatalogApi.requireAccessibleStation(emp.getStationId());
        Integer shiftCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM shift_records WHERE attendant_id = ?", Integer.class, employeeId
        );
        if (shiftCount != null && shiftCount > 0) {
            throw new IllegalStateException("Cannot delete employee " + emp.getFullName() + " who has recorded shift history.");
        }
        repository.deleteById(employeeId);
    }
}

record CreateEmployeeCommand(
    @NotBlank String stationId,
    @NotBlank String fullName,
    @NotBlank String role,
    @NotBlank String phone,
    String shiftWindow,
    @Positive long baseSalaryFcfa,
    String auth0Sub
) {}

record UpdateEmployeeCommand(
    @NotBlank String fullName,
    @NotBlank String role,
    @NotBlank String phone,
    @NotBlank String shiftWindow,
    @Positive long baseSalaryFcfa,
    String auth0Sub
) {}

record ExecutePayrollRunCommand(
    @NotBlank String stationId,
    @NotBlank String periodLabel,
    @NotBlank String paymentSource
) {}

record PayrollLineDto(
    String employeeId,
    String fullName,
    String role,
    long baseSalaryFcfa,
    long varianceAdjustmentFcfa,
    long netPayableFcfa
) {}

record PayslipDto(
    String employeeId,
    String stationId,
    String fullName,
    String role,
    long baseSalaryFcfa,
    long shortageDeductionFcfa,
    long cnpsEmployeeFcfa,
    long grossAfterShortageFcfa,
    long netTakeHomeFcfa,
    long recentLoggedMinutes,
    Instant generatedAt
) {}

@RestController
@RequestMapping("/api/v1/workforce")
public class WorkforceController {
    private final WorkforceService service;

    public WorkforceController(WorkforceService service) {
        this.service = service;
    }

    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public java.util.Map<String, Object> myEmployeeProfile() {
        return service.getMyProfile();
    }

    @GetMapping("/employees")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_workforce:read')")
    public List<EmployeeEntity> listEmployees(@RequestParam(required = false, defaultValue = "ALL") String stationId) {
        return service.listEmployees(stationId);
    }

    @GetMapping("/payroll")
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_workforce:read')")
    public List<PayrollLineDto> getPayrollSummary(@RequestParam(required = false, defaultValue = "ALL") String stationId) {
        return service.getPayrollSummary(stationId);
    }

    @GetMapping("/payroll/payslips/{employeeId}")
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_workforce:read')")
    public PayslipDto getPayslip(@PathVariable String employeeId) {
        return service.buildPayslip(employeeId);
    }

    @GetMapping("/payroll/runs")
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_workforce:read')")
    public List<PayrollRunEntity> listPayrollRuns(@RequestParam(required = false, defaultValue = "ALL") String stationId) {
        return service.listPayrollRuns(stationId);
    }

    @PostMapping("/payroll/run")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_workforce:write')")
    public PayrollRunEntity executePayrollRun(@Valid @RequestBody ExecutePayrollRunCommand cmd) {
        return service.executePayrollRun(cmd);
    }

    @PostMapping("/employees")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_workforce:write')")
    public EmployeeEntity createEmployee(@Valid @RequestBody CreateEmployeeCommand cmd) {
        return service.create(cmd);
    }

    @PutMapping("/employees/{employeeId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_workforce:write')")
    public EmployeeEntity updateEmployee(@PathVariable String employeeId, @Valid @RequestBody UpdateEmployeeCommand cmd) {
        return service.update(employeeId, cmd);
    }

    @DeleteMapping("/employees/{employeeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_workforce:write')")
    public void deleteEmployee(@PathVariable String employeeId) {
        service.delete(employeeId);
    }

    @PostMapping("/employees/{employeeId}/attendance")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT') or hasAuthority('SCOPE_workforce:write')")
    public EmployeeEntity toggleAttendance(@PathVariable String employeeId) {
        return service.toggleAttendance(employeeId);
    }

    @GetMapping("/employees/{employeeId}/attendance-logs")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_workforce:read')")
    public List<AttendanceLogEntity> listAttendanceLogs(@PathVariable String employeeId) {
        return service.listAttendanceLogs(employeeId);
    }
}
