package com.opesware.opesfuel.forecourt;

import com.opesware.opesfuel.shared.events.DomainEvent.FuelPriceUpdatedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ProvisionedFuelSpec;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftClosedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftOpenedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.StationInstitutionalSetupEvent;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "pumps")
class PumpEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "tank_id", nullable = false)
    private String tankId;
    @Column(nullable = false)
    private String code;
    @Column(nullable = false)
    private String grade;
    @Column(name = "totalizer_litres", nullable = false)
    private BigDecimal totalizerLitres;
    @Column(name = "unit_price_fcfa", nullable = false)
    private long unitPriceFcfa;
    @Column(nullable = false)
    private String status;

    public static PumpEntity create(String stationId, String tankId, String code, String grade, BigDecimal totalizerLitres, long unitPriceFcfa) {
        PumpEntity p = new PumpEntity();
        p.id = "pmp_" + UUID.randomUUID().toString().substring(0, 8);
        p.stationId = stationId;
        p.tankId = tankId;
        p.code = code.trim().toUpperCase();
        p.grade = grade.trim().toUpperCase();
        p.totalizerLitres = totalizerLitres != null ? totalizerLitres : BigDecimal.ZERO;
        p.unitPriceFcfa = unitPriceFcfa;
        p.status = "IDLE";
        return p;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getTankId() { return tankId; }
    public String getCode() { return code; }
    public String getGrade() { return grade; }
    public BigDecimal getTotalizerLitres() { return totalizerLitres; }
    public void setTotalizerLitres(BigDecimal totalizerLitres) { this.totalizerLitres = totalizerLitres; }
    public long getUnitPriceFcfa() { return unitPriceFcfa; }
    public void setUnitPriceFcfa(long unitPriceFcfa) { this.unitPriceFcfa = unitPriceFcfa; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}

@Entity
@Table(name = "shift_records")
class ShiftEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "pump_id", nullable = false)
    private String pumpId;
    @Column(name = "attendant_id", nullable = false)
    private String attendantId;
    @Column(name = "opening_meter_litres", nullable = false)
    private BigDecimal openingMeterLitres;
    @Column(name = "closing_meter_litres")
    private BigDecimal closingMeterLitres;
    @Column(name = "unit_price_fcfa", nullable = false)
    private long unitPriceFcfa;
    @Column(name = "cash_fcfa", nullable = false)
    private long cashFcfa;
    @Column(name = "mobile_money_fcfa", nullable = false)
    private long mobileMoneyFcfa;
    @Column(name = "card_fcfa", nullable = false)
    private long cardFcfa;
    @Column(name = "fleet_credit_fcfa", nullable = false)
    private long fleetCreditFcfa;
    @Column(name = "variance_fcfa", nullable = false)
    private long varianceFcfa;
    @Column(nullable = false)
    private String status;
    @Column(name = "opened_at", nullable = false)
    private Instant openedAt;
    @Column(name = "closed_at")
    private Instant closedAt;

    public static ShiftEntity open(String stationId, String pumpId, String attendantId, BigDecimal openingMeter, long unitPriceFcfa) {
        ShiftEntity entity = new ShiftEntity();
        entity.id = "sh_" + UUID.randomUUID().toString().substring(0, 8);
        entity.stationId = stationId;
        entity.pumpId = pumpId;
        entity.attendantId = attendantId;
        entity.openingMeterLitres = openingMeter;
        entity.unitPriceFcfa = unitPriceFcfa;
        entity.status = "OPEN";
        entity.openedAt = Instant.now();
        return entity;
    }

    public ShiftClosedEvent close(String tankId, long unitCostFcfa, BigDecimal closingMeter,
                                  long cash, long mobileMoney, long card, long fleetCredit) {
        if (!"OPEN".equals(this.status)) {
            throw new IllegalStateException("Shift is already closed.");
        }
        if (closingMeter.compareTo(this.openingMeterLitres) < 0) {
            throw new IllegalArgumentException("Closing meter cannot be less than opening meter.");
        }
        BigDecimal litresSold = closingMeter.subtract(this.openingMeterLitres).setScale(2, RoundingMode.HALF_UP);
        long expectedFcfa = litresSold.multiply(BigDecimal.valueOf(this.unitPriceFcfa)).setScale(0, RoundingMode.HALF_UP).longValue();
        long declaredFcfa = cash + mobileMoney + card + fleetCredit;

        this.closingMeterLitres = closingMeter;
        this.cashFcfa = cash;
        this.mobileMoneyFcfa = mobileMoney;
        this.cardFcfa = card;
        this.fleetCreditFcfa = fleetCredit;
        this.varianceFcfa = declaredFcfa - expectedFcfa;
        this.status = "CLOSED";
        this.closedAt = Instant.now();

        return ShiftClosedEvent.create(
            this.id, this.stationId, this.pumpId, tankId, this.attendantId,
            litresSold, expectedFcfa, cash, mobileMoney, card, fleetCredit, this.varianceFcfa, unitCostFcfa
        );
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getPumpId() { return pumpId; }
    public String getAttendantId() { return attendantId; }
    public BigDecimal getOpeningMeterLitres() { return openingMeterLitres; }
    public BigDecimal getClosingMeterLitres() { return closingMeterLitres; }
    public long getUnitPriceFcfa() { return unitPriceFcfa; }
    public long getCashFcfa() { return cashFcfa; }
    public long getMobileMoneyFcfa() { return mobileMoneyFcfa; }
    public long getCardFcfa() { return cardFcfa; }
    public long getFleetCreditFcfa() { return fleetCreditFcfa; }
    public long getVarianceFcfa() { return varianceFcfa; }
    public String getStatus() { return status; }
    public Instant getOpenedAt() { return openedAt; }
    public Instant getClosedAt() { return closedAt; }
}

interface PumpRepository extends JpaRepository<PumpEntity, String> {
    List<PumpEntity> findByStationIdOrderByCodeAsc(String stationId);
    List<PumpEntity> findByStationIdAndGrade(String stationId, String grade);
}

interface ShiftRepository extends JpaRepository<ShiftEntity, String> {
    List<ShiftEntity> findByStationIdOrderByOpenedAtDesc(String stationId);
}

@Service
class ShiftCommandHandler {
    private final PumpRepository pumpRepository;
    private final ShiftRepository shiftRepository;
    private final ApplicationEventPublisher eventPublisher;

    ShiftCommandHandler(PumpRepository pumpRepository, ShiftRepository shiftRepository, ApplicationEventPublisher eventPublisher) {
        this.pumpRepository = pumpRepository;
        this.shiftRepository = shiftRepository;
        this.eventPublisher = eventPublisher;
    }

    @ApplicationModuleListener
    public void onFuelPriceUpdated(FuelPriceUpdatedEvent event) {
        List<PumpEntity> pumps = pumpRepository.findByStationIdAndGrade(event.stationId(), event.grade());
        for (PumpEntity pump : pumps) {
            pump.setUnitPriceFcfa(event.pricePerLitreFcfa());
        }
        pumpRepository.saveAll(pumps);
    }

    @ApplicationModuleListener
    public void onInstitutionalSetup(StationInstitutionalSetupEvent event) {
        int existingCount = pumpRepository.findByStationIdOrderByCodeAsc(event.stationId()).size();
        int nozzleIndex = existingCount + 1;
        for (ProvisionedFuelSpec spec : event.items()) {
            for (int i = 0; i < spec.nozzleCount(); i++) {
                String code = "P" + String.format("%02d", nozzleIndex++) + "-" + spec.grade().substring(0, Math.min(3, spec.grade().length()));
                pumpRepository.save(PumpEntity.create(
                    event.stationId(),
                    spec.tankId(),
                    code,
                    spec.grade(),
                    BigDecimal.ZERO,
                    spec.sellingPriceFcfa()
                ));
            }
        }
    }

    @Transactional
    public ShiftEntity openShift(OpenShiftCommand cmd) {
        PumpEntity pump = pumpRepository.findById(cmd.pumpId())
            .orElseThrow(() -> new IllegalArgumentException("Pump not found: " + cmd.pumpId()));
        if ("ACTIVE_SHIFT".equals(pump.getStatus())) {
            throw new IllegalStateException("Pump " + pump.getCode() + " already has an active shift.");
        }
        pump.setStatus("ACTIVE_SHIFT");
        pumpRepository.save(pump);

        ShiftEntity shift = shiftRepository.save(ShiftEntity.open(cmd.stationId(), cmd.pumpId(), cmd.attendantId(), pump.getTotalizerLitres(), pump.getUnitPriceFcfa()));
        eventPublisher.publishEvent(new ShiftOpenedEvent(
            UUID.randomUUID().toString(), shift.getId(), shift.getStationId(), shift.getPumpId(), shift.getAttendantId(), shift.getOpenedAt()
        ));
        return shift;
    }

    @Transactional
    public ShiftEntity closeShift(String shiftId, CloseShiftCommand cmd) {
        ShiftEntity shift = shiftRepository.findById(shiftId)
            .orElseThrow(() -> new IllegalArgumentException("Shift not found: " + shiftId));
        PumpEntity pump = pumpRepository.findById(shift.getPumpId())
            .orElseThrow(() -> new IllegalArgumentException("Pump not found: " + shift.getPumpId()));

        ShiftClosedEvent event = shift.close(
            pump.getTankId(),
            cmd.unitCostFcfa() != null ? cmd.unitCostFcfa() : Math.round(pump.getUnitPriceFcfa() * 0.88),
            cmd.closingMeterLitres(),
            cmd.cashFcfa(),
            cmd.mobileMoneyFcfa(),
            cmd.cardFcfa(),
            cmd.fleetCreditFcfa()
        );

        pump.setTotalizerLitres(cmd.closingMeterLitres());
        pump.setStatus("IDLE");
        pumpRepository.save(pump);
        shiftRepository.save(shift);
        eventPublisher.publishEvent(event);
        return shift;
    }
}

record CreatePumpCommand(
    @NotBlank String stationId,
    @NotBlank String tankId,
    @NotBlank String code,
    @NotBlank String grade,
    @PositiveOrZero BigDecimal totalizerLitres,
    @PositiveOrZero long unitPriceFcfa
) {}
record OpenShiftCommand(@NotBlank String stationId, @NotBlank String pumpId, @NotBlank String attendantId) {}
record CloseShiftCommand(
    @NotNull BigDecimal closingMeterLitres,
    @PositiveOrZero long cashFcfa,
    @PositiveOrZero long mobileMoneyFcfa,
    @PositiveOrZero long cardFcfa,
    @PositiveOrZero long fleetCreditFcfa,
    Long unitCostFcfa
) {}

@RestController
@RequestMapping("/api/v1/forecourt")
public class ForecourtController {
    private final PumpRepository pumpRepository;
    private final ShiftRepository shiftRepository;
    private final ShiftCommandHandler shiftCommandHandler;

    public ForecourtController(PumpRepository pumpRepository, ShiftRepository shiftRepository, ShiftCommandHandler shiftCommandHandler) {
        this.pumpRepository = pumpRepository;
        this.shiftRepository = shiftRepository;
        this.shiftCommandHandler = shiftCommandHandler;
    }

    @GetMapping("/pumps")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<PumpEntity> listPumps(@RequestParam String stationId) {
        return "ALL".equalsIgnoreCase(stationId) ? pumpRepository.findAll() : pumpRepository.findByStationIdOrderByCodeAsc(stationId);
    }

    @PostMapping("/pumps")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public PumpEntity createPump(@Valid @RequestBody CreatePumpCommand cmd) {
        return pumpRepository.save(PumpEntity.create(cmd.stationId(), cmd.tankId(), cmd.code(), cmd.grade(), cmd.totalizerLitres(), cmd.unitPriceFcfa()));
    }

    @DeleteMapping("/pumps/{pumpId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public void deletePump(@PathVariable String pumpId) {
        PumpEntity pump = pumpRepository.findById(pumpId)
            .orElseThrow(() -> new IllegalArgumentException("Pump not found: " + pumpId));
        if ("ACTIVE_SHIFT".equals(pump.getStatus())) {
            throw new IllegalStateException("Cannot delete pump with an active open shift.");
        }
        pumpRepository.deleteById(pumpId);
    }

    @GetMapping("/shifts")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<ShiftEntity> listShifts(@RequestParam String stationId) {
        return "ALL".equalsIgnoreCase(stationId) ? shiftRepository.findAll() : shiftRepository.findByStationIdOrderByOpenedAtDesc(stationId);
    }

    @PostMapping("/shifts/open")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT')")
    public ShiftEntity openShift(@Valid @RequestBody OpenShiftCommand command) {
        return shiftCommandHandler.openShift(command);
    }

    @PostMapping("/shifts/{shiftId}/close")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT')")
    public ShiftEntity closeShift(@PathVariable String shiftId, @Valid @RequestBody CloseShiftCommand command) {
        return shiftCommandHandler.closeShift(shiftId, command);
    }

    @DeleteMapping("/shifts/{shiftId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public void deleteShift(@PathVariable String shiftId) {
        shiftRepository.findById(shiftId).ifPresent(shift -> {
            if ("OPEN".equals(shift.getStatus())) {
                pumpRepository.findById(shift.getPumpId()).ifPresent(pump -> {
                    pump.setStatus("IDLE");
                    pumpRepository.save(pump);
                });
            }
            shiftRepository.deleteById(shiftId);
        });
    }
}
