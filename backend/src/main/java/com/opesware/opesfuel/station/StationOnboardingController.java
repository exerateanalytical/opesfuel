package com.opesware.opesfuel.station;

import com.opesware.opesfuel.shared.domain.DomainEnums;
import com.opesware.opesfuel.shared.domain.DomainEnums.FuelGrade;
import com.opesware.opesfuel.shared.events.DomainEvent.FuelPriceUpdatedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ProvisionedFuelSpec;
import com.opesware.opesfuel.shared.events.DomainEvent.StarterLubricantsPack;
import com.opesware.opesfuel.shared.events.DomainEvent.StationInstitutionalSetupEvent;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "station_onboarding_steps")
class StationOnboardingStepEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "step_key", nullable = false)
    private String stepKey;
    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    public static StationOnboardingStepEntity complete(String stationId, String stepKey) {
        StationOnboardingStepEntity e = new StationOnboardingStepEntity();
        e.id = "ob_" + UUID.randomUUID();
        e.stationId = stationId;
        e.stepKey = stepKey;
        e.completedAt = Instant.now();
        return e;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getStepKey() { return stepKey; }
    public Instant getCompletedAt() { return completedAt; }
}

@Entity
@Table(name = "institutional_fuel_catalog")
class InstitutionalFuelCatalogEntity {
    @Id
    private String grade;
    @Column(nullable = false)
    private String label;
    @Column(nullable = false)
    private String category;
    @Column(name = "unit_label", nullable = false)
    private String unitLabel;
    @Column(name = "default_capacity_litres", nullable = false)
    private BigDecimal defaultCapacityLitres;
    @Column(name = "default_opening_litres", nullable = false)
    private BigDecimal defaultOpeningLitres;
    @Column(name = "default_unit_cost_fcfa", nullable = false)
    private long defaultUnitCostFcfa;
    @Column(name = "default_selling_price_fcfa", nullable = false)
    private long defaultSellingPriceFcfa;

    public String getGrade() { return grade; }
    public String getLabel() { return label; }
    public String getCategory() { return category; }
    public String getUnitLabel() { return unitLabel; }
    public BigDecimal getDefaultCapacityLitres() { return defaultCapacityLitres; }
    public BigDecimal getDefaultOpeningLitres() { return defaultOpeningLitres; }
    public long getDefaultUnitCostFcfa() { return defaultUnitCostFcfa; }
    public long getDefaultSellingPriceFcfa() { return defaultSellingPriceFcfa; }
}

interface StationOnboardingStepRepository extends JpaRepository<StationOnboardingStepEntity, String> {
    List<StationOnboardingStepEntity> findByStationId(String stationId);
    boolean existsByStationIdAndStepKey(String stationId, String stepKey);
}

interface InstitutionalFuelCatalogRepository extends JpaRepository<InstitutionalFuelCatalogEntity, String> {}

record InstitutionalFuelTemplateDto(
    String code,
    String label,
    String tankName,
    String category,
    String unitLabel,
    BigDecimal defaultCapacityLitres,
    BigDecimal defaultOpeningLitres,
    long defaultUnitCostFcfa,
    long defaultSellingPriceFcfa,
    int defaultNozzleCount,
    String description
) {}

record OnboardingFuelSelectionCommand(
    @NotBlank String grade,
    @NotBlank String tankName,
    @NotNull @Positive BigDecimal capacityLitres,
    @NotNull @PositiveOrZero BigDecimal openingLitres,
    @Positive long unitCostFcfa,
    @Positive long sellingPriceFcfa,
    @PositiveOrZero int nozzleCount
) {}

record InstitutionalLubricantsPackCommand(
    boolean includeLubricants,
    @PositiveOrZero int oilBottlesQty,
    @PositiveOrZero int lpgCylindersQty
) {}

record StationInstitutionalSetupCommand(
    @NotEmpty List<@Valid OnboardingFuelSelectionCommand> items,
    @Valid InstitutionalLubricantsPackCommand lubricantsPack
) {}

record StationInstitutionalSetupResponse(
    String stationId,
    int provisionedFuelLines,
    int provisionedPumps,
    long openingInventoryAssetFcfa,
    Instant synchronizedAt
) {}

@RestController
@RequestMapping("/api/v1")
public class StationOnboardingController {

    private static final Map<String, String> DEFAULT_TANK_NAMES = Map.of(
        "SUPER", "Tank T-01 (Super SP95)",
        "GASOIL", "Tank T-02 (Gasoil)",
        "KEROSENE", "Tank T-03 (Kerosene)",
        "LPG_BULK", "Skid LPG-01 (Gaz GPL)",
        "HEAVY_FUEL", "Tank T-05 (Industrial Fuel)"
    );

    private static final Map<String, Integer> DEFAULT_NOZZLES = Map.of(
        "SUPER", 2,
        "GASOIL", 2,
        "KEROSENE", 1,
        "LPG_BULK", 1,
        "HEAVY_FUEL", 1
    );

    private static final Map<String, String> DESCRIPTIONS = Map.of(
        "SUPER", "High-octane unleaded petrol for passenger cars, motorcycles, and urban fleets.",
        "GASOIL", "Commercial diesel for logistics trucks, buses, and heavy transport vehicles.",
        "KEROSENE", "Domestic heating, lighting, and regulated household kerosene reserve.",
        "LPG_BULK", "Autogas bulk storage and 12.5 kg domestic cooking gas cylinder refill feed.",
        "HEAVY_FUEL", "Bulk industrial generator fuel oil and mine-site power supply reserves."
    );

    private final StationCatalogApi stationCatalogApi;
    private final FuelPriceRepository priceRepo;
    private final StationOnboardingStepRepository onboardingRepo;
    private final InstitutionalFuelCatalogRepository catalogRepo;
    private final ApplicationEventPublisher eventPublisher;

    public StationOnboardingController(
        StationCatalogApi stationCatalogApi,
        FuelPriceRepository priceRepo,
        StationOnboardingStepRepository onboardingRepo,
        InstitutionalFuelCatalogRepository catalogRepo,
        ApplicationEventPublisher eventPublisher
    ) {
        this.stationCatalogApi = stationCatalogApi;
        this.priceRepo = priceRepo;
        this.onboardingRepo = onboardingRepo;
        this.catalogRepo = catalogRepo;
        this.eventPublisher = eventPublisher;
    }

    @GetMapping("/catalog/institutional-fuels")
    public List<InstitutionalFuelTemplateDto> getInstitutionalFuelCatalog() {
        return catalogRepo.findAll().stream()
            .map(row -> new InstitutionalFuelTemplateDto(
                row.getGrade(),
                row.getLabel(),
                DEFAULT_TANK_NAMES.getOrDefault(row.getGrade(), "Tank (" + row.getGrade() + ")"),
                row.getCategory(),
                row.getUnitLabel(),
                row.getDefaultCapacityLitres(),
                row.getDefaultOpeningLitres(),
                row.getDefaultUnitCostFcfa(),
                row.getDefaultSellingPriceFcfa(),
                DEFAULT_NOZZLES.getOrDefault(row.getGrade(), 1),
                DESCRIPTIONS.getOrDefault(row.getGrade(), row.getLabel())
            ))
            .toList();
    }

    @GetMapping("/stations/{stationId}/onboarding-steps")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_stations:read')")
    public List<StationOnboardingStepEntity> listOnboardingSteps(@PathVariable String stationId) {
        stationCatalogApi.requireAccessibleStation(stationId);
        return onboardingRepo.findByStationId(stationId);
    }

    @PostMapping("/stations/{stationId}/onboarding-setup")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_stations:write')")
    @Transactional
    public StationInstitutionalSetupResponse applyInstitutionalSetup(
        @PathVariable String stationId,
        @Valid @RequestBody StationInstitutionalSetupCommand command
    ) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(stationId);

        List<ProvisionedFuelSpec> specs = new ArrayList<>();
        long totalAssetFcfa = 0L;
        int totalPumps = 0;

        for (OnboardingFuelSelectionCommand item : command.items()) {
            FuelGrade validatedGrade = DomainEnums.parse(FuelGrade.class, item.grade(), "grade");
            if (item.openingLitres().compareTo(item.capacityLitres()) > 0) {
                throw new IllegalArgumentException(
                    "Opening volume (" + item.openingLitres() + " L) exceeds tank capacity (" + item.capacityLitres() + " L) for " + validatedGrade
                );
            }

            String tankId = "tk_" + UUID.randomUUID();
            FuelPriceEntity savedPrice = priceRepo.save(FuelPriceEntity.create(stationId, validatedGrade.name(), item.sellingPriceFcfa()));

            eventPublisher.publishEvent(new FuelPriceUpdatedEvent(
                UUID.randomUUID().toString(),
                savedPrice.getId(),
                station.tenantId(),
                stationId,
                validatedGrade.name(),
                item.sellingPriceFcfa(),
                savedPrice.getEffectiveAt()
            ));

            totalAssetFcfa += item.openingLitres()
                .multiply(BigDecimal.valueOf(item.unitCostFcfa()))
                .setScale(0, RoundingMode.HALF_UP)
                .longValue();
            totalPumps += item.nozzleCount();

            specs.add(new ProvisionedFuelSpec(
                tankId,
                validatedGrade.name(),
                item.tankName().trim(),
                item.capacityLitres(),
                item.openingLitres(),
                item.unitCostFcfa(),
                item.sellingPriceFcfa(),
                item.nozzleCount()
            ));
        }

        StarterLubricantsPack pack = null;
        if (command.lubricantsPack() != null && command.lubricantsPack().includeLubricants()) {
            int oilQty = command.lubricantsPack().oilBottlesQty();
            int lpgQty = command.lubricantsPack().lpgCylindersQty();
            pack = new StarterLubricantsPack(true, oilQty, lpgQty);
            totalAssetFcfa += oilQty * 13_200L;
            totalAssetFcfa += lpgQty * 5_400L;
        }

        Instant now = Instant.now();
        eventPublisher.publishEvent(new StationInstitutionalSetupEvent(
            UUID.randomUUID().toString(),
            stationId,
            station.tenantId(),
            stationId,
            specs,
            pack,
            totalAssetFcfa,
            now
        ));

        if (!onboardingRepo.existsByStationIdAndStepKey(stationId, "INSTITUTIONAL_FUELS_VOLUMES")) {
            onboardingRepo.save(StationOnboardingStepEntity.complete(stationId, "INSTITUTIONAL_FUELS_VOLUMES"));
        }

        return new StationInstitutionalSetupResponse(stationId, specs.size(), totalPumps, totalAssetFcfa, now);
    }
}
