package com.opesware.opesfuel.workforce;

import com.opesware.opesfuel.shared.events.DomainEvent.ShiftClosedEvent;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "employees")
class EmployeeEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
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

    public static EmployeeEntity create(String stationId, String fullName, String role, String phone, String shiftWindow, long baseSalaryFcfa) {
        EmployeeEntity e = new EmployeeEntity();
        e.id = "emp_" + UUID.randomUUID().toString().substring(0, 8);
        e.stationId = stationId;
        e.fullName = fullName;
        e.role = role;
        e.phone = phone;
        e.shiftWindow = shiftWindow != null ? shiftWindow : "06:00 - 14:00";
        e.clockedIn = false;
        e.baseSalaryFcfa = baseSalaryFcfa;
        e.cumulativeVarianceFcfa = 0;
        return e;
    }

    public void applyShiftVariance(long varianceFcfa) {
        this.cumulativeVarianceFcfa += varianceFcfa;
    }

    public void toggleClockIn() {
        this.clockedIn = !this.clockedIn;
    }

    public void updateProfile(String fullName, String role, String phone, String shiftWindow, long baseSalaryFcfa) {
        this.fullName = fullName;
        this.role = role;
        this.phone = phone;
        this.shiftWindow = shiftWindow;
        this.baseSalaryFcfa = baseSalaryFcfa;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getFullName() { return fullName; }
    public String getRole() { return role; }
    public String getPhone() { return phone; }
    public String getShiftWindow() { return shiftWindow; }
    public boolean isClockedIn() { return clockedIn; }
    public long getBaseSalaryFcfa() { return baseSalaryFcfa; }
    public long getCumulativeVarianceFcfa() { return cumulativeVarianceFcfa; }
}

interface EmployeeRepository extends JpaRepository<EmployeeEntity, String> {
    List<EmployeeEntity> findByStationIdOrderByFullNameAsc(String stationId);
}

@Service
class WorkforceService {
    private final EmployeeRepository repository;

    WorkforceService(EmployeeRepository repository) {
        this.repository = repository;
    }

    @ApplicationModuleListener
    public void onShiftClosed(ShiftClosedEvent event) {
        if (event.varianceFcfa() == 0) return;
        repository.findById(event.attendantId()).ifPresent(emp -> {
            emp.applyShiftVariance(event.varianceFcfa());
            repository.save(emp);
        });
    }

    @Transactional
    public EmployeeEntity create(CreateEmployeeCommand cmd) {
        return repository.save(EmployeeEntity.create(
            cmd.stationId(), cmd.fullName(), cmd.role(), cmd.phone(), cmd.shiftWindow(), cmd.baseSalaryFcfa()
        ));
    }

    @Transactional
    public EmployeeEntity toggleAttendance(String employeeId) {
        EmployeeEntity emp = repository.findById(employeeId)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + employeeId));
        emp.toggleClockIn();
        return repository.save(emp);
    }

    @Transactional
    public EmployeeEntity update(String employeeId, UpdateEmployeeCommand cmd) {
        EmployeeEntity emp = repository.findById(employeeId)
            .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + employeeId));
        emp.updateProfile(cmd.fullName(), cmd.role(), cmd.phone(), cmd.shiftWindow(), cmd.baseSalaryFcfa());
        return repository.save(emp);
    }

    @Transactional
    public void delete(String employeeId) {
        repository.deleteById(employeeId);
    }
}

record CreateEmployeeCommand(
    @NotBlank String stationId,
    @NotBlank String fullName,
    @NotBlank String role,
    @NotBlank String phone,
    String shiftWindow,
    @Positive long baseSalaryFcfa
) {}

record UpdateEmployeeCommand(
    @NotBlank String fullName,
    @NotBlank String role,
    @NotBlank String phone,
    @NotBlank String shiftWindow,
    @Positive long baseSalaryFcfa
) {}

record PayrollLineDto(
    String employeeId,
    String fullName,
    String role,
    long baseSalaryFcfa,
    long varianceAdjustmentFcfa,
    long netPayableFcfa
) {}

@RestController
@RequestMapping("/api/v1/workforce")
public class WorkforceController {
    private final EmployeeRepository repository;
    private final WorkforceService service;

    public WorkforceController(EmployeeRepository repository, WorkforceService service) {
        this.repository = repository;
        this.service = service;
    }

    @GetMapping("/employees")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public List<EmployeeEntity> listEmployees(@RequestParam String stationId) {
        return "ALL".equalsIgnoreCase(stationId) ? repository.findAll() : repository.findByStationIdOrderByFullNameAsc(stationId);
    }

    @GetMapping("/payroll")
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT')")
    public List<PayrollLineDto> getPayrollSummary(@RequestParam String stationId) {
        List<EmployeeEntity> staff = "ALL".equalsIgnoreCase(stationId)
            ? repository.findAll()
            : repository.findByStationIdOrderByFullNameAsc(stationId);
        return staff.stream()
            .map(e -> new PayrollLineDto(
                e.getId(), e.getFullName(), e.getRole(),
                e.getBaseSalaryFcfa(), e.getCumulativeVarianceFcfa(),
                Math.max(0L, e.getBaseSalaryFcfa() + e.getCumulativeVarianceFcfa())
            ))
            .toList();
    }

    @PostMapping("/employees")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public EmployeeEntity createEmployee(@Valid @RequestBody CreateEmployeeCommand cmd) {
        return service.create(cmd);
    }

    @PutMapping("/employees/{employeeId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public EmployeeEntity updateEmployee(@PathVariable String employeeId, @Valid @RequestBody UpdateEmployeeCommand cmd) {
        return service.update(employeeId, cmd);
    }

    @DeleteMapping("/employees/{employeeId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public void deleteEmployee(@PathVariable String employeeId) {
        service.delete(employeeId);
    }

    @PostMapping("/employees/{employeeId}/attendance")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT')")
    public EmployeeEntity toggleAttendance(@PathVariable String employeeId) {
        return service.toggleAttendance(employeeId);
    }
}
