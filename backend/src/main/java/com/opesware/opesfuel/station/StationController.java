package com.opesware.opesfuel.station;

import com.opesware.opesfuel.shared.events.DomainEvent.FuelPriceUpdatedEvent;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "stations")
class StationEntity {
    @Id
    private String id;
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
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static StationEntity create(String code, String name, String city, String planName, long monthlyFeeFcfa) {
        StationEntity s = new StationEntity();
        s.id = "st_" + UUID.randomUUID().toString().substring(0, 8);
        s.code = code.trim().toUpperCase();
        s.name = name.trim();
        s.city = city.trim();
        s.planName = planName != null ? planName : "Starter Station";
        s.monthlyFeeFcfa = monthlyFeeFcfa >= 25000L ? monthlyFeeFcfa : 25000L;
        s.createdAt = Instant.now();
        return s;
    }

    public void updateSubscription(String planName, long monthlyFeeFcfa) {
        this.planName = planName;
        this.monthlyFeeFcfa = monthlyFeeFcfa;
    }

    public void updateProfile(String code, String name, String city) {
        if (code != null && !code.isBlank()) {
            this.code = code.trim().toUpperCase();
        }
        if (name != null && !name.isBlank()) {
            this.name = name.trim();
        }
        if (city != null && !city.isBlank()) {
            this.city = city.trim();
        }
    }

    public String getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getCity() { return city; }
    public String getCurrency() { return currency; }
    public String getPlanName() { return planName; }
    public long getMonthlyFeeFcfa() { return monthlyFeeFcfa; }
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
        FuelPriceEntity fp = new FuelPriceEntity();
        fp.id = "fp_" + UUID.randomUUID().toString().substring(0, 8);
        fp.stationId = stationId;
        fp.grade = grade.toUpperCase();
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

interface StationRepository extends JpaRepository<StationEntity, String> {}
interface FuelPriceRepository extends JpaRepository<FuelPriceEntity, String> {
    List<FuelPriceEntity> findByStationIdOrderByEffectiveAtDesc(String stationId);
}

@Service
class StationCommandService {
    private final StationRepository stationRepo;
    private final FuelPriceRepository priceRepo;
    private final ApplicationEventPublisher eventPublisher;

    StationCommandService(StationRepository stationRepo, FuelPriceRepository priceRepo, ApplicationEventPublisher eventPublisher) {
        this.stationRepo = stationRepo;
        this.priceRepo = priceRepo;
        this.eventPublisher = eventPublisher;
    }

    @Transactional
    public StationEntity createStation(CreateStationCommand cmd) {
        return stationRepo.save(StationEntity.create(cmd.code(), cmd.name(), cmd.city(), cmd.planName(), cmd.monthlyFeeFcfa()));
    }

    @Transactional
    public StationEntity updateSubscription(String stationId, UpdateSubscriptionCommand cmd) {
        StationEntity station = stationRepo.findById(stationId)
            .orElseThrow(() -> new IllegalArgumentException("Station not found: " + stationId));
        station.updateSubscription(cmd.planName(), cmd.monthlyFeeFcfa());
        return stationRepo.save(station);
    }

    @Transactional
    public FuelPriceEntity updateFuelPrice(String stationId, UpdateFuelPriceCommand cmd) {
        if (!stationRepo.existsById(stationId)) {
            throw new IllegalArgumentException("Station not found: " + stationId);
        }
        FuelPriceEntity saved = priceRepo.save(FuelPriceEntity.create(stationId, cmd.grade(), cmd.pricePerLitreFcfa()));
        eventPublisher.publishEvent(new FuelPriceUpdatedEvent(
            UUID.randomUUID().toString(),
            saved.getId(),
            stationId,
            saved.getGrade(),
            saved.getPricePerLitreFcfa(),
            saved.getEffectiveAt()
        ));
        return saved;
    }
    @Transactional
    public StationEntity updateStation(String stationId, UpdateStationCommand cmd) {
        StationEntity station = stationRepo.findById(stationId)
            .orElseThrow(() -> new IllegalArgumentException("Station not found: " + stationId));
        station.updateProfile(cmd.code(), cmd.name(), cmd.city());
        return stationRepo.save(station);
    }

    @Transactional
    public void deleteStation(String stationId) {
        if (!stationRepo.existsById(stationId)) {
            throw new IllegalArgumentException("Station not found: " + stationId);
        }
        stationRepo.deleteById(stationId);
    }
}

record CreateStationCommand(@NotBlank String code, @NotBlank String name, @NotBlank String city, String planName, long monthlyFeeFcfa) {}
record UpdateStationCommand(@NotBlank String code, @NotBlank String name, @NotBlank String city) {}
record UpdateSubscriptionCommand(@NotBlank String planName, @Min(25000) long monthlyFeeFcfa) {}
record UpdateFuelPriceCommand(@NotBlank String grade, @Min(100) long pricePerLitreFcfa) {}

@RestController
@RequestMapping("/api/v1/stations")
public class StationController {
    private final StationRepository stationRepo;
    private final FuelPriceRepository priceRepo;
    private final StationCommandService service;

    public StationController(StationRepository stationRepo, FuelPriceRepository priceRepo, StationCommandService service) {
        this.stationRepo = stationRepo;
        this.priceRepo = priceRepo;
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<StationEntity> listStations() {
        return stationRepo.findAll();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER')")
    public StationEntity createStation(@Valid @RequestBody CreateStationCommand cmd) {
        return service.createStation(cmd);
    }

    @PutMapping("/{stationId}")
    @PreAuthorize("hasRole('OWNER')")
    public StationEntity updateStation(@PathVariable String stationId, @Valid @RequestBody UpdateStationCommand cmd) {
        return service.updateStation(stationId, cmd);
    }

    @PatchMapping("/{stationId}")
    @PreAuthorize("hasRole('OWNER')")
    public StationEntity patchStation(@PathVariable String stationId, @Valid @RequestBody UpdateStationCommand cmd) {
        return service.updateStation(stationId, cmd);
    }

    @DeleteMapping("/{stationId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasRole('OWNER')")
    public void deleteStation(@PathVariable String stationId) {
        service.deleteStation(stationId);
    }

    @PutMapping("/{stationId}/subscription")
    @PreAuthorize("hasRole('OWNER')")
    public StationEntity updateSubscription(@PathVariable String stationId, @Valid @RequestBody UpdateSubscriptionCommand cmd) {
        return service.updateSubscription(stationId, cmd);
    }

    @GetMapping("/{stationId}/fuel-prices")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<FuelPriceEntity> listFuelPrices(@PathVariable String stationId) {
        return priceRepo.findByStationIdOrderByEffectiveAtDesc(stationId);
    }

    @PostMapping("/{stationId}/fuel-prices")
    @PreAuthorize("hasRole('OWNER')")
    public FuelPriceEntity updateFuelPrice(@PathVariable String stationId, @Valid @RequestBody UpdateFuelPriceCommand cmd) {
        return service.updateFuelPrice(stationId, cmd);
    }
}
