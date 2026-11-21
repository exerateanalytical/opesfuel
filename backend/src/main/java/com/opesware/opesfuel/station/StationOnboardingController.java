package com.opesware.opesfuel.station;

import com.opesware.opesfuel.shared.events.DomainEvent.FuelPriceUpdatedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ProvisionedFuelSpec;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
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
        e.id = "ob_" + UUID.randomUUID().toString().substring(0, 8);
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

interface StationOnboardingStepRepository extends JpaRepository<StationOnboardingStepEntity, String> {
    List<StationOnboardingStepEntity> findByStationId(String stationId);
}

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
    InstitutionalLubricantsPackCommand lubricantsPack
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

    private final StationRepository stationRepo;
    private final FuelPriceRepository priceRepo;
    private final StationOnboardingStepRepository onboardingRepo;
    private final JdbcTemplate jdbcTemplate;
    private final ApplicationEventPublisher eventPublisher;

    public StationOnboardingController(
        StationRepository stationRepo,
        FuelPriceRepository priceRepo,
        StationOnboardingStepRepository onboardingRepo,
        JdbcTemplate jdbcTemplate,
        ApplicationEventPublisher eventPublisher
    ) {
        this.stationRepo = stationRepo;
        this.priceRepo = priceRepo;
        this.onboardingRepo = onboardingRepo;
        this.jdbcTemplate = jdbcTemplate;
        this.eventPublisher = eventPublisher;
    }

    @GetMapping("/catalog/institutional-fuels")
    public List<InstitutionalFuelTemplateDto> getInstitutionalFuelCatalog() {
        return List.of(
            new InstitutionalFuelTemplateDto("SUPER", "Super Petrol (SP95)", "Tank T-01 (Super SP95)", "LIQUID_FUEL", "Litres",
                new BigDecimal("40000"), new BigDecimal("24500"), 745L, 840L, 2,
                "High-octane unleaded petrol for passenger cars, motorcycles, and urban fleets."),
            new InstitutionalFuelTemplateDto("GASOIL", "Diesel / Gasoil", "Tank T-02 (Gasoil)", "LIQUID_FUEL", "Litres",
                new BigDecimal("50000"), new BigDecimal("31000"), 735L, 828L, 2,
                "Commercial diesel for logistics trucks, buses, and heavy transport vehicles."),
            new InstitutionalFuelTemplateDto("KEROSENE", "Kerosene / Pétrole Lampant", "Tank T-03 (Kerosene)", "LIQUID_FUEL", "Litres",
                new BigDecimal("20000"), new BigDecimal("11200"), 470L, 550L, 1,
                "Domestic heating, lighting, and regulated household kerosene reserve."),
            new InstitutionalFuelTemplateDto("LPG_BULK", "LPG Autogas / Gaz GPL", "Skid LPG-01 (Gaz GPL)", "GASEOUS_FUEL", "Litres",
                new BigDecimal("15000"), new BigDecimal("8500"), 445L, 620L, 1,
                "Autogas bulk storage and 12.5 kg domestic cooking gas cylinder refill feed."),
            new InstitutionalFuelTemplateDto("HEAVY_FUEL", "Heavy Fuel / Generator Diesel", "Tank T-05 (Industrial Fuel)", "INDUSTRIAL_FUEL", "Litres",
                new BigDecimal("30000"), new BigDecimal("14000"), 560L, 765L, 1,
                "Bulk industrial generator fuel oil and mine-site power supply reserves.")
        );
    }

    @GetMapping("/stations/{stationId}/onboarding-steps")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public List<StationOnboardingStepEntity> listOnboardingSteps(@PathVariable String stationId) {
        return onboardingRepo.findByStationId(stationId);
    }

    @PostMapping("/stations/{stationId}/onboarding-setup")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    @Transactional
    public StationInstitutionalSetupResponse applyInstitutionalSetup(
        @PathVariable String stationId,
        @Valid @RequestBody StationInstitutionalSetupCommand command
    ) {
        if (!stationRepo.existsById(stationId)) {
            throw new IllegalArgumentException("Station not found: " + stationId);
        }

        List<ProvisionedFuelSpec> specs = new ArrayList<>();
        long totalAssetFcfa = 0L;
        int totalPumps = 0;

        for (OnboardingFuelSelectionCommand item : command.items()) {
            String normalizedGrade = item.grade().trim().toUpperCase();
            String tankId = "tk_" + UUID.randomUUID().toString().substring(0, 8);
            FuelPriceEntity savedPrice = priceRepo.save(FuelPriceEntity.create(stationId, normalizedGrade, item.sellingPriceFcfa()));

            eventPublisher.publishEvent(new FuelPriceUpdatedEvent(
                UUID.randomUUID().toString(),
                savedPrice.getId(),
                stationId,
                normalizedGrade,
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
                normalizedGrade,
                item.tankName(),
                item.capacityLitres(),
                item.openingLitres(),
                item.unitCostFcfa(),
                item.sellingPriceFcfa(),
                item.nozzleCount()
            ));
        }

        if (command.lubricantsPack() != null && command.lubricantsPack().includeLubricants()) {
            int oilQty = command.lubricantsPack().oilBottlesQty();
            int lpgQty = command.lubricantsPack().lpgCylindersQty();
            if (oilQty > 0) {
                jdbcTemplate.update(
                    "INSERT INTO shop_items (id, station_id, sku, name, category, stock_qty, reorder_level, unit_price_fcfa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    "sku_" + UUID.randomUUID().toString().substring(0, 8),
                    stationId,
                    "LUB-15W40-5L",
                    "Heavy Duty Engine Oil 15W40 (5L)",
                    "LUBRICANT",
                    oilQty,
                    10,
                    18500L
                );
                totalAssetFcfa += oilQty * 13200L;
            }
            if (lpgQty > 0) {
                jdbcTemplate.update(
                    "INSERT INTO shop_items (id, station_id, sku, name, category, stock_qty, reorder_level, unit_price_fcfa) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    "sku_" + UUID.randomUUID().toString().substring(0, 8),
                    stationId,
                    "LPG-12KG",
                    "Cooking Gas Cylinder Refill 12.5kg",
                    "LPG",
                    lpgQty,
                    12,
                    6500L
                );
                totalAssetFcfa += lpgQty * 5400L;
            }
        }

        Instant now = Instant.now();
        eventPublisher.publishEvent(new StationInstitutionalSetupEvent(
            UUID.randomUUID().toString(),
            stationId,
            stationId,
            specs,
            totalAssetFcfa,
            now
        ));

        onboardingRepo.save(StationOnboardingStepEntity.complete(stationId, "INSTITUTIONAL_FUELS_VOLUMES"));

        return new StationInstitutionalSetupResponse(stationId, specs.size(), totalPumps, totalAssetFcfa, now);
    }
}
