package com.opesware.opesfuel.station;

import com.opesware.opesfuel.shared.domain.DomainEnums;
import com.opesware.opesfuel.shared.domain.DomainEnums.FuelGrade;
import com.opesware.opesfuel.shared.events.DomainEvent.FuelPriceUpdatedEvent;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Entity
@Table(name = "stations")
class StationEntity {
    @Id
    private String id;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId = TenantAccessGuard.DEFAULT_TENANT_ID;
    @Column(nullable = false, unique = true)
    private String code;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String city;
    @Column(nullable = false)
    private String currency = "FCFA";
    @Column(name = "plan_name", nullable = false)
    private String planName = "Starter Station";
    @Column(name = "monthly_fee_fcfa", nullable = false)
    private long monthlyFeeFcfa = 25000L;
    @Column(name = "address")
    private String address;
    @Column(name = "vat_rate", nullable = false)
    private java.math.BigDecimal vatRate = new java.math.BigDecimal("0.1925");
    @Column(nullable = false)
    private String timezone = "Africa/Douala";
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static StationEntity create(String tenantId, String code, String name, String city, String planName, long monthlyFeeFcfa) {
        StationEntity s = new StationEntity();
        s.id = "st_" + UUID.randomUUID();
        s.tenantId = tenantId != null && !tenantId.isBlank() ? tenantId : TenantAccessGuard.DEFAULT_TENANT_ID;
        s.code = code.trim().toUpperCase();
        s.name = name.trim();
        s.city = city.trim();
        s.planName = planName != null && !planName.isBlank() ? planName.trim() : "Starter Station";
        s.monthlyFeeFcfa = monthlyFeeFcfa >= 25000L ? monthlyFeeFcfa : 25000L;
        s.vatRate = new java.math.BigDecimal("0.1925");
        s.timezone = "Africa/Douala";
        s.createdAt = Instant.now();
        return s;
    }

    public void updateSubscription(String planName, long monthlyFeeFcfa) {
        this.planName = planName.trim();
        this.monthlyFeeFcfa = monthlyFeeFcfa;
    }

    public void updateProfile(String code, String name, String city, String address, java.math.BigDecimal vatRate, String timezone) {
        if (code != null && !code.isBlank()) {
            this.code = code.trim().toUpperCase();
        }
        if (name != null && !name.isBlank()) {
            this.name = name.trim();
        }
        if (city != null && !city.isBlank()) {
            this.city = city.trim();
        }
        if (address != null) {
            this.address = address.isBlank() ? null : address.trim();
        }
        if (vatRate != null) {
            if (vatRate.compareTo(java.math.BigDecimal.ZERO) < 0 || vatRate.compareTo(java.math.BigDecimal.ONE) >= 0) {
                throw new IllegalArgumentException("vatRate must be between 0 and 0.9999.");
            }
            this.vatRate = vatRate;
        }
        if (timezone != null && !timezone.isBlank()) {
            this.timezone = timezone.trim();
        }
    }

    public StationCatalogApi.StationSnapshot toSnapshot() {
        return new StationCatalogApi.StationSnapshot(id, tenantId, code, name, city, planName, monthlyFeeFcfa);
    }

    public String getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getCity() { return city; }
    public String getCurrency() { return currency; }
    public String getPlanName() { return planName; }
    public long getMonthlyFeeFcfa() { return monthlyFeeFcfa; }
    public String getAddress() { return address; }
    public java.math.BigDecimal getVatRate() { return vatRate; }
    public String getTimezone() { return timezone; }
    public Instant getCreatedAt() { return createdAt; }
}

@Entity
@Table(name = "fuel_prices")
class FuelPriceEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(nullable = false)
    private String grade;
    @Column(name = "price_per_litre_fcfa", nullable = false)
    private long pricePerLitreFcfa;
    @Column(name = "effective_at", nullable = false)
    private Instant effectiveAt;

    public static FuelPriceEntity create(String stationId, String grade, long pricePerLitreFcfa) {
        FuelGrade validated = DomainEnums.parse(FuelGrade.class, grade, "grade");
        FuelPriceEntity fp = new FuelPriceEntity();
        fp.id = "fp_" + UUID.randomUUID();
        fp.stationId = stationId;
        fp.grade = validated.name();
        fp.pricePerLitreFcfa = pricePerLitreFcfa;
        fp.effectiveAt = Instant.now();
        return fp;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getGrade() { return grade; }
    public long getPricePerLitreFcfa() { return pricePerLitreFcfa; }
    public Instant getEffectiveAt() { return effectiveAt; }
}

interface StationRepository extends JpaRepository<StationEntity, String> {
    List<StationEntity> findByTenantIdOrderByNameAsc(String tenantId);
    boolean existsByCodeIgnoreCase(String code);
    long countByTenantId(String tenantId);
}

interface FuelPriceRepository extends JpaRepository<FuelPriceEntity, String> {
    List<FuelPriceEntity> findByStationIdOrderByEffectiveAtDesc(String stationId);
    Optional<FuelPriceEntity> findFirstByStationIdAndGradeOrderByEffectiveAtDesc(String stationId, String grade);
}

@Service
class StationCommandService implements StationCatalogApi {
    private static final long ENTERPRISE_MONTHLY_THRESHOLD_FCFA = 120_000L;

    private final StationRepository stationRepo;
    private final FuelPriceRepository priceRepo;
    private final TenantAccessGuard accessGuard;
    private final JdbcTemplate jdbcTemplate;
    private final ApplicationEventPublisher eventPublisher;

    StationCommandService(
        StationRepository stationRepo,
        FuelPriceRepository priceRepo,
        TenantAccessGuard accessGuard,
        JdbcTemplate jdbcTemplate,
        ApplicationEventPublisher eventPublisher
    ) {
        this.stationRepo = stationRepo;
        this.priceRepo = priceRepo;
        this.accessGuard = accessGuard;
        this.jdbcTemplate = jdbcTemplate;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional(readOnly = true)
    public StationSnapshot requireAccessibleStation(String stationId) {
        if (stationId == null || stationId.isBlank()) {
            throw new IllegalArgumentException("stationId is required.");
        }
        StationEntity station = stationRepo.findById(stationId)
            .orElseThrow(() -> new IllegalArgumentException("Station not found: " + stationId));
        accessGuard.assertStationAccess(station.getId(), station.getTenantId());
        return station.toSnapshot();
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> resolveAuthorizedStationIds(String requestedStationId) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        if (requestedStationId == null || requestedStationId.isBlank() || "ALL".equalsIgnoreCase(requestedStationId)) {
            if (!principal.isStationRestricted()) {
                accessGuard.assertCanQueryAllStations();
            }
            return stationRepo.findByTenantIdOrderByNameAsc(principal.tenantId()).stream()
                .map(StationEntity::getId)
                .filter(principal::canAccessStation)
                .toList();
        }
        StationSnapshot station = requireAccessibleStation(requestedStationId);
        return List.of(station.id());
    }

    @Override
    @Transactional(readOnly = true)
    public List<StationSnapshot> listAccessibleStationSnapshots() {
        return listAccessibleStations().stream().map(StationEntity::toSnapshot).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Long> findLatestFuelPrice(String stationId, String grade) {
        FuelGrade validated = DomainEnums.parse(FuelGrade.class, grade, "grade");
        return priceRepo.findFirstByStationIdAndGradeOrderByEffectiveAtDesc(stationId, validated.name())
            .map(FuelPriceEntity::getPricePerLitreFcfa);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isEnterprisePlan(String stationId) {
        return stationRepo.findById(stationId)
            .map(s -> s.getMonthlyFeeFcfa() >= ENTERPRISE_MONTHLY_THRESHOLD_FCFA
                || (s.getPlanName() != null && s.getPlanName().toLowerCase().contains("enterprise")))
            .orElse(false);
    }

    @Transactional(readOnly = true)
    public List<StationEntity> listAccessibleStations() {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        return stationRepo.findByTenantIdOrderByNameAsc(principal.tenantId()).stream()
            .filter(s -> principal.canAccessStation(s.getId()))
            .toList();
    }

    @Transactional
    public StationEntity createStation(CreateStationCommand cmd) {
        String tenantId = accessGuard.currentTenantId();
        if (stationRepo.existsByCodeIgnoreCase(cmd.code().trim())) {
            throw new IllegalStateException("Station code already exists: " + cmd.code().trim().toUpperCase());
        }
        return stationRepo.save(StationEntity.create(
            tenantId, cmd.code(), cmd.name(), cmd.city(), cmd.planName(), cmd.monthlyFeeFcfa()
        ));
    }

    @Transactional
    public StationEntity updateSubscription(String stationId, UpdateSubscriptionCommand cmd) {
        requireAccessibleStation(stationId);
        StationEntity station = stationRepo.findById(stationId)
            .orElseThrow(() -> new IllegalArgumentException("Station not found: " + stationId));
        station.updateSubscription(cmd.planName(), cmd.monthlyFeeFcfa());
        return stationRepo.save(station);
    }

    @Transactional
    public FuelPriceEntity updateFuelPrice(String stationId, UpdateFuelPriceCommand cmd) {
        StationSnapshot station = requireAccessibleStation(stationId);
        FuelPriceEntity saved = priceRepo.save(FuelPriceEntity.create(stationId, cmd.grade(), cmd.pricePerLitreFcfa()));
        eventPublisher.publishEvent(new FuelPriceUpdatedEvent(
            UUID.randomUUID().toString(),
            saved.getId(),
            station.tenantId(),
            stationId,
            saved.getGrade(),
            saved.getPricePerLitreFcfa(),
            saved.getEffectiveAt()
        ));
        return saved;
    }

    @Transactional
    public StationEntity updateStation(String stationId, String code, String name, String city, String address, java.math.BigDecimal vatRate, String timezone) {
        requireAccessibleStation(stationId);
        StationEntity station = stationRepo.findById(stationId)
            .orElseThrow(() -> new IllegalArgumentException("Station not found: " + stationId));
        if (code != null && !code.isBlank()
            && !code.trim().equalsIgnoreCase(station.getCode())
            && stationRepo.existsByCodeIgnoreCase(code.trim())) {
            throw new IllegalStateException("Station code already exists: " + code.trim().toUpperCase());
        }
        station.updateProfile(code, name, city, address, vatRate, timezone);
        return stationRepo.save(station);
    }

    @Transactional
    public void deleteStation(String stationId) {
        StationSnapshot station = requireAccessibleStation(stationId);
        if (stationRepo.countByTenantId(station.tenantId()) <= 1) {
            throw new IllegalStateException("Cannot delete the last active station in the tenant workspace.");
        }
        if (hasDependentOperationalRecords(stationId)) {
            throw new IllegalStateException(
                "Cannot delete station " + station.code() + " while tanks, pumps, shifts, employees, or ledger entries exist."
            );
        }
        priceRepo.deleteAll(priceRepo.findByStationIdOrderByEffectiveAtDesc(stationId));
        stationRepo.deleteById(stationId);
    }

    private boolean hasDependentOperationalRecords(String stationId) {
        List<String> dependentTables = List.of(
            "fuel_tanks", "pumps", "employees", "shift_records",
            "fleet_transactions", "shop_items", "purchase_orders",
            "journal_entries", "expenses", "treasury_deposits"
        );
        for (String table : dependentTables) {
            Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM " + table + " WHERE station_id = ?",
                Integer.class,
                stationId
            );
            if (count != null && count > 0) {
                return true;
            }
        }
        return false;
    }
}

record CreateStationCommand(
    @NotBlank String code,
    @NotBlank String name,
    @NotBlank String city,
    String planName,
    @Min(0) long monthlyFeeFcfa
) {}

record UpdateStationCommand(@NotBlank String code, @NotBlank String name, @NotBlank String city, String address, java.math.BigDecimal vatRate, String timezone) {}
record PatchStationCommand(String code, String name, String city, String address, java.math.BigDecimal vatRate, String timezone) {}
record UpdateSubscriptionCommand(@NotBlank String planName, @Min(25000) long monthlyFeeFcfa) {}
record UpdateFuelPriceCommand(@NotBlank String grade, @Min(100) long pricePerLitreFcfa) {}

@RestController
@RequestMapping("/api/v1/stations")
public class StationController {
    private final FuelPriceRepository priceRepo;
    private final StationCommandService service;

    public StationController(FuelPriceRepository priceRepo, StationCommandService service) {
        this.priceRepo = priceRepo;
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','GROUP_CFO','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_stations:read')")
    public List<StationEntity> listStations() {
        return service.listAccessibleStations();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_stations:write')")
    public StationEntity createStation(@Valid @RequestBody CreateStationCommand cmd) {
        return service.createStation(cmd);
    }

    @PutMapping("/{stationId}")
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_stations:write')")
    public StationEntity updateStation(@PathVariable String stationId, @Valid @RequestBody UpdateStationCommand cmd) {
        return service.updateStation(stationId, cmd.code(), cmd.name(), cmd.city(), cmd.address(), cmd.vatRate(), cmd.timezone());
    }

    @PatchMapping("/{stationId}")
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_stations:write')")
    public StationEntity patchStation(@PathVariable String stationId, @RequestBody PatchStationCommand cmd) {
        return service.updateStation(stationId, cmd.code(), cmd.name(), cmd.city(), cmd.address(), cmd.vatRate(), cmd.timezone());
    }

    @DeleteMapping("/{stationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_stations:write')")
    public void deleteStation(@PathVariable String stationId) {
        service.deleteStation(stationId);
    }

    @PutMapping("/{stationId}/subscription")
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_stations:write')")
    public StationEntity updateSubscription(@PathVariable String stationId, @Valid @RequestBody UpdateSubscriptionCommand cmd) {
        return service.updateSubscription(stationId, cmd);
    }

    @GetMapping("/{stationId}/fuel-prices")
    @PreAuthorize("hasAnyRole('OWNER','GROUP_CFO','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_stations:read')")
    public List<FuelPriceEntity> listFuelPrices(@PathVariable String stationId) {
        service.requireAccessibleStation(stationId);
        return priceRepo.findByStationIdOrderByEffectiveAtDesc(stationId);
    }

    @PostMapping("/{stationId}/fuel-prices")
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_stations:write')")
    public FuelPriceEntity updateFuelPrice(@PathVariable String stationId, @Valid @RequestBody UpdateFuelPriceCommand cmd) {
        return service.updateFuelPrice(stationId, cmd);
    }
}
