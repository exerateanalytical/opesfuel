package com.opesware.opesfuel.fleet;

import com.opesware.opesfuel.forecourt.ForecourtQueryApi;
import com.opesware.opesfuel.inventory.InventoryQueryApi;
import com.opesware.opesfuel.shared.domain.DomainEnums;
import com.opesware.opesfuel.shared.domain.DomainEnums.FleetStatus;
import com.opesware.opesfuel.shared.domain.DomainEnums.FuelGrade;
import com.opesware.opesfuel.shared.domain.DomainEnums.SettlementMethod;
import com.opesware.opesfuel.shared.events.DomainEvent.FleetAccountSettledEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.FleetVoucherRecordedEvent;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import com.opesware.opesfuel.station.StationCatalogApi;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Entity
@Table(name = "fleet_accounts")
class FleetAccountEntity {
    @Id
    private String id;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId = TenantAccessGuard.DEFAULT_TENANT_ID;
    @Column(name = "company_name", nullable = false)
    private String companyName;
    @Column(name = "tax_id", nullable = false)
    private String taxId;
    @Column(name = "credit_limit_fcfa", nullable = false)
    private long creditLimitFcfa;
    @Column(name = "balance_owed_fcfa", nullable = false)
    private long balanceOwedFcfa;
    @Column(nullable = false)
    private String status;
    @Version
    private long version;

    public static FleetAccountEntity create(String tenantId, String companyName, String taxId, long creditLimitFcfa) {
        FleetAccountEntity f = new FleetAccountEntity();
        f.id = "flt_" + UUID.randomUUID();
        f.tenantId = tenantId;
        f.companyName = companyName.trim();
        f.taxId = taxId.trim().toUpperCase();
        f.creditLimitFcfa = creditLimitFcfa;
        f.balanceOwedFcfa = 0L;
        f.status = FleetStatus.ACTIVE.name();
        return f;
    }

    public void charge(long amountFcfa) {
        if (!FleetStatus.ACTIVE.name().equals(this.status)) {
            throw new IllegalStateException("Fleet account " + this.companyName + " is on " + this.status + " and cannot issue new vouchers.");
        }
        if (amountFcfa <= 0) {
            throw new IllegalArgumentException("Voucher amount must be positive.");
        }
        long nextBalance = Math.addExact(this.balanceOwedFcfa, amountFcfa);
        if (nextBalance > this.creditLimitFcfa) {
            throw new IllegalStateException("Credit limit exceeded for " + this.companyName);
        }
        this.balanceOwedFcfa = nextBalance;
    }

    public void settle(long amountFcfa) {
        if (amountFcfa <= 0 || amountFcfa > this.balanceOwedFcfa) {
            throw new IllegalArgumentException("Settlement amount must be between 1 and balance owed (" + this.balanceOwedFcfa + " FCFA).");
        }
        this.balanceOwedFcfa -= amountFcfa;
    }

    public void updateSettings(Long creditLimitFcfa, String status) {
        if (creditLimitFcfa != null) {
            if (creditLimitFcfa <= 0) {
                throw new IllegalArgumentException("Credit limit must be positive.");
            }
            this.creditLimitFcfa = creditLimitFcfa;
        }
        if (status != null && !status.isBlank()) {
            this.status = DomainEnums.parse(FleetStatus.class, status, "status").name();
        }
    }

    public String getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getCompanyName() { return companyName; }
    public String getTaxId() { return taxId; }
    public long getCreditLimitFcfa() { return creditLimitFcfa; }
    public long getBalanceOwedFcfa() { return balanceOwedFcfa; }
    public String getStatus() { return status; }
}

@Entity
@Table(name = "fleet_vehicles")
class FleetVehicleEntity {
    @Id
    private String id;
    @Column(name = "account_id", nullable = false)
    private String accountId;
    @Column(name = "plate_number", nullable = false)
    private String plateNumber;
    @Column(name = "driver_name", nullable = false)
    private String driverName;
    @Column(name = "allowed_grade")
    private String allowedGrade;
    @Column(name = "monthly_litre_cap")
    private BigDecimal monthlyLitreCap;
    @Column(nullable = false)
    private boolean active = true;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static FleetVehicleEntity create(String accountId, String plateNumber, String driverName, String allowedGrade, BigDecimal monthlyLitreCap) {
        FleetVehicleEntity v = new FleetVehicleEntity();
        v.id = "veh_" + UUID.randomUUID();
        v.accountId = accountId;
        v.plateNumber = plateNumber.trim().toUpperCase();
        v.driverName = driverName.trim();
        v.allowedGrade = (allowedGrade != null && !allowedGrade.isBlank())
            ? DomainEnums.parse(FuelGrade.class, allowedGrade, "allowedGrade").name()
            : null;
        v.monthlyLitreCap = monthlyLitreCap;
        v.active = true;
        v.createdAt = Instant.now();
        return v;
    }

    public String getId() { return id; }
    public String getAccountId() { return accountId; }
    public String getPlateNumber() { return plateNumber; }
    public String getDriverName() { return driverName; }
    public String getAllowedGrade() { return allowedGrade; }
    public BigDecimal getMonthlyLitreCap() { return monthlyLitreCap; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
}

@Entity
@Table(name = "fleet_transactions")
class FleetTransactionEntity {
    @Id
    private String id;
    @Column(name = "account_id", nullable = false)
    private String accountId;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "vehicle_plate", nullable = false)
    private String vehiclePlate;
    @Column(name = "driver_name", nullable = false)
    private String driverName;
    @Column(nullable = false)
    private String grade;
    @Column(nullable = false)
    private BigDecimal litres;
    @Column(name = "amount_fcfa", nullable = false)
    private long amountFcfa;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static FleetTransactionEntity create(String accountId, String stationId, String vehiclePlate, String driverName, String grade, BigDecimal litres, long amountFcfa) {
        FleetTransactionEntity tx = new FleetTransactionEntity();
        tx.id = "ftx_" + UUID.randomUUID();
        tx.accountId = accountId;
        tx.stationId = stationId;
        tx.vehiclePlate = vehiclePlate.trim().toUpperCase();
        tx.driverName = driverName.trim();
        tx.grade = grade;
        tx.litres = litres;
        tx.amountFcfa = amountFcfa;
        tx.createdAt = Instant.now();
        return tx;
    }

    public String getId() { return id; }
    public String getAccountId() { return accountId; }
    public String getStationId() { return stationId; }
    public String getVehiclePlate() { return vehiclePlate; }
    public String getDriverName() { return driverName; }
    public String getGrade() { return grade; }
    public BigDecimal getLitres() { return litres; }
    public long getAmountFcfa() { return amountFcfa; }
    public Instant getCreatedAt() { return createdAt; }
}

interface FleetAccountRepository extends JpaRepository<FleetAccountEntity, String> {
    List<FleetAccountEntity> findByTenantIdOrderByCompanyNameAsc(String tenantId);
    boolean existsByTenantIdAndTaxIdIgnoreCase(String tenantId, String taxId);
}

interface FleetVehicleRepository extends JpaRepository<FleetVehicleEntity, String> {
    List<FleetVehicleEntity> findByAccountIdOrderByPlateNumberAsc(String accountId);
    boolean existsByAccountIdAndPlateNumberIgnoreCase(String accountId, String plateNumber);
}

interface FleetTransactionRepository extends JpaRepository<FleetTransactionEntity, String> {
    List<FleetTransactionEntity> findByStationIdInOrderByCreatedAtDesc(List<String> stationIds, PageRequest pageable);
    List<FleetTransactionEntity> findByAccountIdOrderByCreatedAtDesc(String accountId, PageRequest pageable);
    boolean existsByAccountId(String accountId);
}

@Service
class FleetService {
    private static final Map<String, Long> INSTITUTIONAL_DEFAULT_PRICES = Map.of(
        "SUPER", 840L,
        "GASOIL", 828L,
        "KEROSENE", 550L,
        "LPG_BULK", 620L,
        "HEAVY_FUEL", 765L
    );

    private final FleetAccountRepository fleetRepo;
    private final FleetVehicleRepository vehicleRepo;
    private final FleetTransactionRepository txRepo;
    private final StationCatalogApi stationCatalogApi;
    private final ForecourtQueryApi forecourtQueryApi;
    private final InventoryQueryApi inventoryQueryApi;
    private final TenantAccessGuard accessGuard;
    private final ApplicationEventPublisher eventPublisher;

    FleetService(
        FleetAccountRepository fleetRepo,
        FleetVehicleRepository vehicleRepo,
        FleetTransactionRepository txRepo,
        StationCatalogApi stationCatalogApi,
        ForecourtQueryApi forecourtQueryApi,
        InventoryQueryApi inventoryQueryApi,
        TenantAccessGuard accessGuard,
        ApplicationEventPublisher eventPublisher
    ) {
        this.fleetRepo = fleetRepo;
        this.vehicleRepo = vehicleRepo;
        this.txRepo = txRepo;
        this.stationCatalogApi = stationCatalogApi;
        this.forecourtQueryApi = forecourtQueryApi;
        this.inventoryQueryApi = inventoryQueryApi;
        this.accessGuard = accessGuard;
        this.eventPublisher = eventPublisher;
    }

    private long resolveFuelUnitPrice(String stationId, FuelGrade grade) {
        Optional<Long> configured = stationCatalogApi.findLatestFuelPrice(stationId, grade.name());
        if (configured.isPresent() && configured.get() > 0) {
            return configured.get();
        }
        Optional<Long> pumpPrice = forecourtQueryApi.findPumpPriceByStationAndGrade(stationId, grade.name());
        if (pumpPrice.isPresent() && pumpPrice.get() > 0) {
            return pumpPrice.get();
        }
        return INSTITUTIONAL_DEFAULT_PRICES.getOrDefault(grade.name(), 840L);
    }

    @Transactional(readOnly = true)
    public List<FleetAccountEntity> listFleetAccounts() {
        return fleetRepo.findByTenantIdOrderByCompanyNameAsc(accessGuard.currentTenantId());
    }

    @Transactional
    public FleetAccountEntity createFleetAccount(CreateFleetAccountCommand cmd) {
        String tenantId = accessGuard.currentTenantId();
        if (fleetRepo.existsByTenantIdAndTaxIdIgnoreCase(tenantId, cmd.taxId().trim())) {
            throw new IllegalStateException("A fleet account with tax ID " + cmd.taxId().trim().toUpperCase() + " already exists.");
        }
        return fleetRepo.save(FleetAccountEntity.create(tenantId, cmd.companyName(), cmd.taxId(), cmd.creditLimitFcfa()));
    }

    @Transactional
    public FleetAccountEntity patchFleetAccount(String accountId, PatchFleetAccountCommand cmd) {
        FleetAccountEntity acc = fleetRepo.findById(accountId)
            .orElseThrow(() -> new IllegalArgumentException("Fleet account not found: " + accountId));
        accessGuard.assertTenantMatch(acc.getTenantId());
        acc.updateSettings(cmd.creditLimitFcfa(), cmd.status());
        return fleetRepo.save(acc);
    }

    @Transactional
    public void deleteFleetAccount(String accountId) {
        FleetAccountEntity acc = fleetRepo.findById(accountId)
            .orElseThrow(() -> new IllegalArgumentException("Fleet account not found: " + accountId));
        accessGuard.assertTenantMatch(acc.getTenantId());
        if (acc.getBalanceOwedFcfa() > 0) {
            throw new IllegalStateException("Cannot delete fleet account with an outstanding balance (" + acc.getBalanceOwedFcfa() + " FCFA).");
        }
        if (txRepo.existsByAccountId(accountId)) {
            throw new IllegalStateException("Cannot delete fleet account with historical vouchers. Place the account on HOLD instead.");
        }
        fleetRepo.deleteById(accountId);
    }

    @Transactional(readOnly = true)
    public List<FleetVehicleEntity> listVehicles(String accountId) {
        FleetAccountEntity acc = fleetRepo.findById(accountId)
            .orElseThrow(() -> new IllegalArgumentException("Fleet account not found: " + accountId));
        accessGuard.assertTenantMatch(acc.getTenantId());
        return vehicleRepo.findByAccountIdOrderByPlateNumberAsc(accountId);
    }

    @Transactional
    public FleetVehicleEntity registerVehicle(String accountId, RegisterFleetVehicleCommand cmd) {
        FleetAccountEntity acc = fleetRepo.findById(accountId)
            .orElseThrow(() -> new IllegalArgumentException("Fleet account not found: " + accountId));
        accessGuard.assertTenantMatch(acc.getTenantId());
        if (vehicleRepo.existsByAccountIdAndPlateNumberIgnoreCase(accountId, cmd.plateNumber().trim())) {
            throw new IllegalStateException("Vehicle plate " + cmd.plateNumber().trim().toUpperCase() + " is already registered.");
        }
        return vehicleRepo.save(FleetVehicleEntity.create(
            accountId, cmd.plateNumber(), cmd.driverName(), cmd.allowedGrade(), cmd.monthlyLitreCap()
        ));
    }

    @Transactional
    public void removeVehicle(String accountId, String vehicleId) {
        FleetAccountEntity acc = fleetRepo.findById(accountId)
            .orElseThrow(() -> new IllegalArgumentException("Fleet account not found: " + accountId));
        accessGuard.assertTenantMatch(acc.getTenantId());
        FleetVehicleEntity veh = vehicleRepo.findById(vehicleId)
            .orElseThrow(() -> new IllegalArgumentException("Fleet vehicle not found: " + vehicleId));
        if (!veh.getAccountId().equals(accountId)) {
            throw new IllegalArgumentException("Vehicle does not belong to fleet account " + accountId);
        }
        vehicleRepo.deleteById(vehicleId);
    }

    @Transactional(readOnly = true)
    public FleetStatementDto buildAccountStatement(String accountId, int limit) {
        FleetAccountEntity acc = fleetRepo.findById(accountId)
            .orElseThrow(() -> new IllegalArgumentException("Fleet account not found: " + accountId));
        accessGuard.assertTenantMatch(acc.getTenantId());
        List<FleetTransactionEntity> txs = txRepo.findByAccountIdOrderByCreatedAtDesc(accountId, PageRequest.of(0, Math.max(1, Math.min(limit, 200))));
        BigDecimal totalLitres = txs.stream().map(FleetTransactionEntity::getLitres).reduce(BigDecimal.ZERO, BigDecimal::add);
        long totalBilled = txs.stream().mapToLong(FleetTransactionEntity::getAmountFcfa).sum();
        long availableCredit = Math.max(0L, acc.getCreditLimitFcfa() - acc.getBalanceOwedFcfa());
        return new FleetStatementDto(
            acc.getId(), acc.getCompanyName(), acc.getTaxId(), acc.getStatus(),
            acc.getCreditLimitFcfa(), acc.getBalanceOwedFcfa(), availableCredit,
            totalLitres, totalBilled, txs, Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public List<FleetTransactionEntity> listFleetVouchers(String stationId, int limit) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return txRepo.findByStationIdInOrderByCreatedAtDesc(stationIds, PageRequest.of(0, Math.max(1, Math.min(limit, 200))));
    }

    @Transactional
    public FleetTransactionEntity recordVoucher(RecordFleetVoucherCommand cmd) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(cmd.stationId());
        FuelGrade grade = DomainEnums.parse(FuelGrade.class, cmd.grade(), "grade");
        FleetAccountEntity acc = fleetRepo.findById(cmd.accountId())
            .orElseThrow(() -> new IllegalArgumentException("Fleet account not found: " + cmd.accountId()));
        accessGuard.assertTenantMatch(acc.getTenantId());

        long unitPrice = resolveFuelUnitPrice(cmd.stationId(), grade);
        long amountFcfa = cmd.litres().multiply(BigDecimal.valueOf(unitPrice)).setScale(0, RoundingMode.HALF_UP).longValue();
        acc.charge(amountFcfa);
        fleetRepo.save(acc);

        boolean standaloneSale = Boolean.TRUE.equals(cmd.standaloneSale());
        long cogsFcfa = 0L;
        if (standaloneSale) {
            InventoryQueryApi.TankSnapshot tank = inventoryQueryApi.findPrimaryTankByStationAndGrade(cmd.stationId(), grade.name())
                .orElseThrow(() -> new IllegalStateException("No fuel tank found for standalone " + grade + " sale at station " + cmd.stationId()));
            inventoryQueryApi.deductStandaloneFuelSale(tank.id(), cmd.litres());
            cogsFcfa = cmd.litres().multiply(BigDecimal.valueOf(tank.unitCostFcfa())).setScale(0, RoundingMode.HALF_UP).longValue();
        }

        FleetTransactionEntity tx = txRepo.save(FleetTransactionEntity.create(
            acc.getId(), cmd.stationId(), cmd.vehiclePlate(), cmd.driverName(), grade.name(), cmd.litres(), amountFcfa
        ));
        eventPublisher.publishEvent(new FleetVoucherRecordedEvent(
            UUID.randomUUID().toString(), tx.getId(), station.tenantId(), cmd.stationId(), acc.getCompanyName(),
            tx.getVehiclePlate(), tx.getLitres(), tx.getAmountFcfa(), standaloneSale, cogsFcfa, tx.getCreatedAt()
        ));
        return tx;
    }

    @Transactional
    public FleetAccountEntity settleAccount(String accountId, SettleFleetCommand cmd) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(cmd.stationId());
        SettlementMethod method = DomainEnums.parse(SettlementMethod.class, cmd.method(), "method");
        FleetAccountEntity acc = fleetRepo.findById(accountId)
            .orElseThrow(() -> new IllegalArgumentException("Fleet account not found: " + accountId));
        accessGuard.assertTenantMatch(acc.getTenantId());

        acc.settle(cmd.amountFcfa());
        fleetRepo.save(acc);
        eventPublisher.publishEvent(new FleetAccountSettledEvent(
            UUID.randomUUID().toString(), acc.getId(), station.tenantId(), station.id(),
            acc.getCompanyName(), cmd.amountFcfa(), method.name(), Instant.now()
        ));
        return acc;
    }
}

record CreateFleetAccountCommand(@NotBlank String companyName, @NotBlank String taxId, @Positive long creditLimitFcfa) {}
record PatchFleetAccountCommand(Long creditLimitFcfa, String status) {}
record RegisterFleetVehicleCommand(@NotBlank String plateNumber, @NotBlank String driverName, String allowedGrade, @Positive BigDecimal monthlyLitreCap) {}
record RecordFleetVoucherCommand(
    @NotBlank String accountId,
    @NotBlank String stationId,
    @NotBlank String vehiclePlate,
    @NotBlank String driverName,
    @NotBlank String grade,
    @NotNull @Positive BigDecimal litres,
    Boolean standaloneSale
) {}
record SettleFleetCommand(@NotBlank String stationId, @Positive long amountFcfa, @NotBlank String method) {}
record FleetStatementDto(
    String accountId,
    String companyName,
    String taxId,
    String status,
    long creditLimitFcfa,
    long balanceOwedFcfa,
    long availableCreditFcfa,
    BigDecimal recentLitresDispensed,
    long recentVouchersTotalFcfa,
    List<FleetTransactionEntity> transactions,
    Instant generatedAt
) {}

@RestController
@RequestMapping("/api/v1/fleet")
public class FleetController {
    private final FleetService service;

    public FleetController(FleetService service) {
        this.service = service;
    }

    @GetMapping("/accounts")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_fleet:read')")
    public List<FleetAccountEntity> listFleetAccounts() {
        return service.listFleetAccounts();
    }

    @PostMapping("/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_fleet:write')")
    public FleetAccountEntity createFleetAccount(@Valid @RequestBody CreateFleetAccountCommand cmd) {
        return service.createFleetAccount(cmd);
    }

    @PatchMapping("/accounts/{accountId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_fleet:write')")
    public FleetAccountEntity patchFleetAccount(@PathVariable String accountId, @RequestBody PatchFleetAccountCommand cmd) {
        return service.patchFleetAccount(accountId, cmd);
    }

    @DeleteMapping("/accounts/{accountId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_fleet:write')")
    public void deleteFleetAccount(@PathVariable String accountId) {
        service.deleteFleetAccount(accountId);
    }

    @GetMapping("/accounts/{accountId}/vehicles")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_fleet:read')")
    public List<FleetVehicleEntity> listVehicles(@PathVariable String accountId) {
        return service.listVehicles(accountId);
    }

    @PostMapping("/accounts/{accountId}/vehicles")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_fleet:write')")
    public FleetVehicleEntity registerVehicle(@PathVariable String accountId, @Valid @RequestBody RegisterFleetVehicleCommand cmd) {
        return service.registerVehicle(accountId, cmd);
    }

    @DeleteMapping("/accounts/{accountId}/vehicles/{vehicleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_fleet:write')")
    public void removeVehicle(@PathVariable String accountId, @PathVariable String vehicleId) {
        service.removeVehicle(accountId, vehicleId);
    }

    @GetMapping("/accounts/{accountId}/statement")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_fleet:read')")
    public FleetStatementDto getAccountStatement(
        @PathVariable String accountId,
        @RequestParam(required = false, defaultValue = "100") int limit
    ) {
        return service.buildAccountStatement(accountId, limit);
    }

    @GetMapping("/vouchers")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_fleet:read')")
    public List<FleetTransactionEntity> listFleetVouchers(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return service.listFleetVouchers(stationId, limit);
    }

    @PostMapping("/vouchers")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT') or hasAuthority('SCOPE_fleet:write')")
    public FleetTransactionEntity recordVoucher(@Valid @RequestBody RecordFleetVoucherCommand cmd) {
        return service.recordVoucher(cmd);
    }

    @PostMapping("/accounts/{accountId}/settle")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_fleet:write')")
    public FleetAccountEntity settleAccount(@PathVariable String accountId, @Valid @RequestBody SettleFleetCommand cmd) {
        return service.settleAccount(accountId, cmd);
    }
}
