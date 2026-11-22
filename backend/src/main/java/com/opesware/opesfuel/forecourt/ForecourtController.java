package com.opesware.opesfuel.forecourt;

import com.opesware.opesfuel.inventory.InventoryQueryApi;
import com.opesware.opesfuel.shared.domain.DomainEnums;
import com.opesware.opesfuel.shared.domain.DomainEnums.FuelGrade;
import com.opesware.opesfuel.shared.domain.DomainEnums.PumpStatus;
import com.opesware.opesfuel.shared.events.DomainEvent.FuelPriceUpdatedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ProvisionedFuelSpec;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftClosedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftOpenedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftVoidedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.TanksProvisionedEvent;
import com.opesware.opesfuel.station.StationCatalogApi;
import com.opesware.opesfuel.workforce.WorkforceQueryApi;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
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
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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
    @Version
    private long version;

    public static PumpEntity create(String stationId, String tankId, String code, String grade, BigDecimal totalizerLitres, long unitPriceFcfa) {
        FuelGrade validatedGrade = DomainEnums.parse(FuelGrade.class, grade, "grade");
        PumpEntity p = new PumpEntity();
        p.id = "pmp_" + UUID.randomUUID();
        p.stationId = stationId;
        p.tankId = tankId;
        p.code = code.trim().toUpperCase();
        p.grade = validatedGrade.name();
        p.totalizerLitres = totalizerLitres != null ? totalizerLitres : BigDecimal.ZERO;
        p.unitPriceFcfa = unitPriceFcfa;
        p.status = PumpStatus.IDLE.name();
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
    @Column(nullable = false)
    private boolean voided;
    @Column(name = "voided_at")
    private Instant voidedAt;
    @Version
    private long version;

    public static ShiftEntity open(String stationId, String pumpId, String attendantId, BigDecimal openingMeter, long unitPriceFcfa) {
        ShiftEntity entity = new ShiftEntity();
        entity.id = "sh_" + UUID.randomUUID();
        entity.stationId = stationId;
        entity.pumpId = pumpId;
        entity.attendantId = attendantId;
        entity.openingMeterLitres = openingMeter;
        entity.unitPriceFcfa = unitPriceFcfa;
        entity.status = "OPEN";
        entity.openedAt = Instant.now();
        entity.voided = false;
        return entity;
    }

    public ShiftClosedEvent close(String tenantId, String tankId, long unitCostFcfa, BigDecimal closingMeter,
                                  long cash, long mobileMoney, long card, long fleetCredit) {
        if (this.voided || !"OPEN".equals(this.status)) {
            throw new IllegalStateException("Shift is already closed or voided.");
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
            this.id, tenantId, this.stationId, this.pumpId, tankId, this.attendantId,
            litresSold, expectedFcfa, cash, mobileMoney, card, fleetCredit, this.varianceFcfa, unitCostFcfa
        );
    }

    public void markVoided() {
        if (this.voided) {
            throw new IllegalStateException("Shift is already voided.");
        }
        this.voided = true;
        this.voidedAt = Instant.now();
        this.status = "VOIDED";
    }

    public BigDecimal computeLitresSold() {
        if (closingMeterLitres == null) {
            return BigDecimal.ZERO;
        }
        return closingMeterLitres.subtract(openingMeterLitres).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
    }

    public long computeExpectedRevenueFcfa() {
        return computeLitresSold().multiply(BigDecimal.valueOf(unitPriceFcfa)).setScale(0, RoundingMode.HALF_UP).longValue();
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
    public boolean isVoided() { return voided; }
}

interface PumpRepository extends JpaRepository<PumpEntity, String> {
    List<PumpEntity> findByStationIdInOrderByCodeAsc(List<String> stationIds);
    List<PumpEntity> findByStationIdOrderByCodeAsc(String stationId);
    List<PumpEntity> findByStationIdAndGrade(String stationId, String grade);
    boolean existsByStationIdAndCodeIgnoreCase(String stationId, String code);
    long countByStationIdIn(List<String> stationIds);
}

interface ShiftRepository extends JpaRepository<ShiftEntity, String> {
    List<ShiftEntity> findByStationIdInAndVoidedFalseOrderByOpenedAtDesc(List<String> stationIds, PageRequest pageable);
    boolean existsByPumpId(String pumpId);
    boolean existsByPumpIdAndStatus(String pumpId, String status);
    long countByStationIdInAndStatusAndVoidedFalse(List<String> stationIds, String status);
}

@Service
class ShiftCommandHandler implements ForecourtQueryApi {
    private final PumpRepository pumpRepository;
    private final ShiftRepository shiftRepository;
    private final StationCatalogApi stationCatalogApi;
    private final InventoryQueryApi inventoryQueryApi;
    private final WorkforceQueryApi workforceQueryApi;
    private final ApplicationEventPublisher eventPublisher;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    ShiftCommandHandler(
        PumpRepository pumpRepository,
        ShiftRepository shiftRepository,
        StationCatalogApi stationCatalogApi,
        InventoryQueryApi inventoryQueryApi,
        WorkforceQueryApi workforceQueryApi,
        ApplicationEventPublisher eventPublisher,
        org.springframework.jdbc.core.JdbcTemplate jdbcTemplate
    ) {
        this.pumpRepository = pumpRepository;
        this.shiftRepository = shiftRepository;
        this.stationCatalogApi = stationCatalogApi;
        this.inventoryQueryApi = inventoryQueryApi;
        this.workforceQueryApi = workforceQueryApi;
        this.eventPublisher = eventPublisher;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional(readOnly = true)
    public java.util.Optional<Long> findPumpPriceByStationAndGrade(String stationId, String grade) {
        return pumpRepository.findByStationIdAndGrade(stationId, grade).stream()
            .map(PumpEntity::getUnitPriceFcfa)
            .filter(p -> p > 0)
            .findFirst();
    }

    @Override
    @Transactional(readOnly = true)
    public long countPumpsForStations(List<String> stationIds) {
        if (stationIds == null || stationIds.isEmpty()) return 0L;
        return pumpRepository.countByStationIdIn(stationIds);
    }

    @Override
    @Transactional(readOnly = true)
    public long countActiveShiftsForStations(List<String> stationIds) {
        if (stationIds == null || stationIds.isEmpty()) return 0L;
        return shiftRepository.countByStationIdInAndStatusAndVoidedFalse(stationIds, "OPEN");
    }

    @ApplicationModuleListener
    public void onFuelPriceUpdated(FuelPriceUpdatedEvent event) {
        List<PumpEntity> pumps = pumpRepository.findByStationIdAndGrade(event.stationId(), event.grade());
        for (PumpEntity pump : pumps) {
            pump.setUnitPriceFcfa(event.pricePerLitreFcfa());
        }
        pumpRepository.saveAll(pumps);
    }

    /**
     * Triggered AFTER Inventory has committed fuel_tanks rows, eliminating the async FK race condition.
     * Provisions only missing nozzles up to spec.nozzleCount() so re-running onboarding is idempotent.
     */
    @ApplicationModuleListener
    public void onTanksProvisioned(TanksProvisionedEvent event) {
        int nozzleIndex = pumpRepository.findByStationIdOrderByCodeAsc(event.stationId()).size() + 1;
        for (ProvisionedFuelSpec spec : event.items()) {
            List<PumpEntity> existingGradePumps = pumpRepository.findByStationIdAndGrade(event.stationId(), spec.grade());
            for (PumpEntity pump : existingGradePumps) {
                pump.setUnitPriceFcfa(spec.sellingPriceFcfa());
            }
            pumpRepository.saveAll(existingGradePumps);

            int missing = Math.max(0, spec.nozzleCount() - existingGradePumps.size());
            for (int i = 0; i < missing; i++) {
                String code;
                do {
                    code = "P" + String.format("%02d", nozzleIndex++) + "-" + spec.grade().substring(0, Math.min(3, spec.grade().length()));
                } while (pumpRepository.existsByStationIdAndCodeIgnoreCase(event.stationId(), code));

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

    @Transactional(readOnly = true)
    public List<PumpEntity> listPumps(String stationId) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return pumpRepository.findByStationIdInOrderByCodeAsc(stationIds);
    }

    @Transactional
    public PumpEntity createPump(CreatePumpCommand cmd) {
        stationCatalogApi.requireAccessibleStation(cmd.stationId());
        FuelGrade validatedGrade = DomainEnums.parse(FuelGrade.class, cmd.grade(), "grade");
        InventoryQueryApi.TankSnapshot tank = inventoryQueryApi.findTank(cmd.tankId())
            .orElseThrow(() -> new IllegalArgumentException("Tank not found: " + cmd.tankId()));
        if (!tank.stationId().equals(cmd.stationId())) {
            throw new IllegalArgumentException("Tank " + cmd.tankId() + " does not belong to station " + cmd.stationId());
        }
        if (!tank.grade().equalsIgnoreCase(validatedGrade.name())) {
            throw new IllegalArgumentException("Pump grade (" + validatedGrade + ") must match linked tank grade (" + tank.grade() + ").");
        }
        if (pumpRepository.existsByStationIdAndCodeIgnoreCase(cmd.stationId(), cmd.code().trim())) {
            throw new IllegalStateException("Pump code already exists at this station: " + cmd.code().trim().toUpperCase());
        }
        List<Map<String, Object>> stRows = jdbcTemplate.queryForList(
            "SELECT plan_name, monthly_fee_fcfa FROM stations WHERE id = ?", cmd.stationId()
        );
        if (!stRows.isEmpty()) {
            String planName = String.valueOf(stRows.get(0).getOrDefault("plan_name", ""));
            long fee = stRows.get(0).get("monthly_fee_fcfa") instanceof Number n ? n.longValue() : 25_000L;
            boolean isStarter = planName.toLowerCase().contains("starter") || fee <= 25_000L;
            long currentPumps = pumpRepository.countByStationIdIn(List.of(cmd.stationId()));
            if (isStarter && currentPumps >= 6) {
                throw new IllegalStateException(
                    "Starter Station plan is limited to 6 dispensers per station. Upgrade to Growth Station or Enterprise Network in Admin & Billing to provision additional pumps."
                );
            }
        }
        return pumpRepository.save(PumpEntity.create(
            cmd.stationId(), cmd.tankId(), cmd.code(), validatedGrade.name(), cmd.totalizerLitres(), cmd.unitPriceFcfa()
        ));
    }

    @Transactional
    public PumpEntity patchPump(String pumpId, PatchPumpCommand cmd) {
        PumpEntity pump = pumpRepository.findById(pumpId)
            .orElseThrow(() -> new IllegalArgumentException("Pump not found: " + pumpId));
        stationCatalogApi.requireAccessibleStation(pump.getStationId());
        if (cmd.status() != null && !cmd.status().isBlank()) {
            PumpStatus next = DomainEnums.parse(PumpStatus.class, cmd.status(), "status");
            if (PumpStatus.ACTIVE_SHIFT.name().equals(pump.getStatus())) {
                throw new IllegalStateException("Cannot change status of pump " + pump.getCode() + " while a shift is active.");
            }
            if (next == PumpStatus.ACTIVE_SHIFT) {
                throw new IllegalArgumentException("Use /forecourt/shifts/open to transition a pump to ACTIVE_SHIFT.");
            }
            pump.setStatus(next.name());
        }
        if (cmd.unitPriceFcfa() != null) {
            if (cmd.unitPriceFcfa() < 100) {
                throw new IllegalArgumentException("unitPriceFcfa must be at least 100 FCFA.");
            }
            pump.setUnitPriceFcfa(cmd.unitPriceFcfa());
        }
        return pumpRepository.save(pump);
    }

    @Transactional
    public void deletePump(String pumpId) {
        PumpEntity pump = pumpRepository.findById(pumpId)
            .orElseThrow(() -> new IllegalArgumentException("Pump not found: " + pumpId));
        stationCatalogApi.requireAccessibleStation(pump.getStationId());
        if (PumpStatus.ACTIVE_SHIFT.name().equals(pump.getStatus())) {
            throw new IllegalStateException("Cannot delete pump with an active open shift.");
        }
        if (shiftRepository.existsByPumpId(pumpId)) {
            throw new IllegalStateException("Cannot delete pump " + pump.getCode() + " that has recorded shift history. Set status to MAINTENANCE instead.");
        }
        pumpRepository.deleteById(pumpId);
    }

    @Transactional(readOnly = true)
    public List<ShiftDto> listShifts(String stationId, int limit) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        List<ShiftEntity> shifts = shiftRepository.findByStationIdInAndVoidedFalseOrderByOpenedAtDesc(
            stationIds, PageRequest.of(0, Math.max(1, Math.min(limit, 200)))
        );
        Map<String, PumpEntity> pumpById = pumpRepository.findByStationIdInOrderByCodeAsc(stationIds).stream()
            .collect(Collectors.toMap(PumpEntity::getId, p -> p, (a, b) -> a));
        return shifts.stream()
            .map(s -> toDto(s, pumpById.get(s.getPumpId())))
            .toList();
    }

    @Transactional
    public ShiftDto openShift(OpenShiftCommand cmd) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(cmd.stationId());
        PumpEntity pump = pumpRepository.findById(cmd.pumpId())
            .orElseThrow(() -> new IllegalArgumentException("Pump not found: " + cmd.pumpId()));
        if (!pump.getStationId().equals(cmd.stationId())) {
            throw new IllegalArgumentException("Pump " + pump.getCode() + " does not belong to station " + cmd.stationId());
        }
        if (!PumpStatus.IDLE.name().equals(pump.getStatus()) || shiftRepository.existsByPumpIdAndStatus(pump.getId(), "OPEN")) {
            throw new IllegalStateException("Pump " + pump.getCode() + " is not IDLE (current status: " + pump.getStatus() + ").");
        }
        WorkforceQueryApi.EmployeeSnapshot attendant = workforceQueryApi.findEmployee(cmd.attendantId())
            .orElseThrow(() -> new IllegalArgumentException("Attendant not found: " + cmd.attendantId()));
        if (!attendant.stationId().equals(cmd.stationId())) {
            throw new IllegalArgumentException("Attendant " + attendant.fullName() + " does not belong to station " + cmd.stationId());
        }

        pump.setStatus(PumpStatus.ACTIVE_SHIFT.name());
        pumpRepository.save(pump);

        ShiftEntity shift = shiftRepository.save(ShiftEntity.open(
            cmd.stationId(), cmd.pumpId(), cmd.attendantId(), pump.getTotalizerLitres(), pump.getUnitPriceFcfa()
        ));
        eventPublisher.publishEvent(new ShiftOpenedEvent(
            UUID.randomUUID().toString(), shift.getId(), station.tenantId(), shift.getStationId(),
            shift.getPumpId(), shift.getAttendantId(), shift.getOpenedAt()
        ));
        return toDto(shift, pump, attendant.fullName());
    }

    @Transactional
    public ShiftDto closeShift(String shiftId, CloseShiftCommand cmd) {
        ShiftEntity shift = shiftRepository.findById(shiftId)
            .orElseThrow(() -> new IllegalArgumentException("Shift not found: " + shiftId));
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(shift.getStationId());
        PumpEntity pump = pumpRepository.findById(shift.getPumpId())
            .orElseThrow(() -> new IllegalArgumentException("Pump not found: " + shift.getPumpId()));

        // T018: Enforce mandatory variance reason when cash drawer over/short exceeds 10,000 FCFA threshold
        if (cmd.closingMeterLitres().compareTo(shift.getOpeningMeterLitres()) >= 0) {
            BigDecimal previewLitres = cmd.closingMeterLitres().subtract(shift.getOpeningMeterLitres()).setScale(2, RoundingMode.HALF_UP);
            long previewExpected = previewLitres.multiply(BigDecimal.valueOf(shift.getUnitPriceFcfa())).setScale(0, RoundingMode.HALF_UP).longValue();
            long previewDeclared = cmd.cashFcfa() + cmd.mobileMoneyFcfa() + cmd.cardFcfa() + cmd.fleetCreditFcfa();
            long previewVariance = previewDeclared - previewExpected;
            if (Math.abs(previewVariance) > 10_000L && (cmd.varianceReason() == null || cmd.varianceReason().isBlank())) {
                throw new IllegalArgumentException(
                    "Shift cash variance (" + previewVariance + " FCFA) exceeds 10,000 FCFA threshold; varianceReason is required before closing shift (T018)."
                );
            }
        }

        // Always use authoritative tank Weighted Average Cost from Inventory instead of client-supplied or hardcoded ratios.
        InventoryQueryApi.TankSnapshot tank = inventoryQueryApi.findTank(pump.getTankId())
            .orElseThrow(() -> new IllegalStateException("Linked fuel tank not found: " + pump.getTankId()));
        long authoritativeUnitCostFcfa = tank.unitCostFcfa();

        ShiftClosedEvent event = shift.close(
            station.tenantId(),
            pump.getTankId(),
            authoritativeUnitCostFcfa,
            cmd.closingMeterLitres(),
            cmd.cashFcfa(),
            cmd.mobileMoneyFcfa(),
            cmd.cardFcfa(),
            cmd.fleetCreditFcfa()
        );

        pump.setTotalizerLitres(cmd.closingMeterLitres());
        pump.setStatus(PumpStatus.IDLE.name());
        pumpRepository.save(pump);
        shiftRepository.save(shift);
        eventPublisher.publishEvent(event);
        return toDto(shift, pump);
    }

    /**
     * T013: Approved mechanical/digital pump meter rollover or counter replacement.
     * Blocked while a shift is active so no negative phantom fuel volume can ever be generated.
     */
    @Transactional
    public Map<String, Object> recordMeterRollover(String pumpId, MeterRolloverCommand cmd) {
        PumpEntity pump = pumpRepository.findById(pumpId)
            .orElseThrow(() -> new IllegalArgumentException("Pump not found: " + pumpId));
        stationCatalogApi.requireAccessibleStation(pump.getStationId());
        if (PumpStatus.ACTIVE_SHIFT.name().equals(pump.getStatus()) || shiftRepository.existsByPumpIdAndStatus(pumpId, "OPEN")) {
            throw new IllegalStateException("Cannot perform meter rollover on pump " + pump.getCode() + " while a shift is OPEN (T013).");
        }
        BigDecimal previousTotalizer = pump.getTotalizerLitres();
        pump.setTotalizerLitres(cmd.newTotalizerLitres());
        pumpRepository.save(pump);
        return Map.of(
            "pumpId", pump.getId(),
            "pumpCode", pump.getCode(),
            "previousTotalizerLitres", previousTotalizer,
            "newTotalizerLitres", pump.getTotalizerLitres(),
            "rolloverMaxLitres", cmd.rolloverMaxLitres(),
            "approvalRef", cmd.approvalRef(),
            "reason", cmd.reason(),
            "status", "ROLLOVER_APPLIED",
            "recordedAt", Instant.now().toString()
        );
    }

    @Transactional
    public void voidShift(String shiftId) {
        ShiftEntity shift = shiftRepository.findById(shiftId)
            .orElseThrow(() -> new IllegalArgumentException("Shift not found: " + shiftId));
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(shift.getStationId());
        PumpEntity pump = pumpRepository.findById(shift.getPumpId())
            .orElseThrow(() -> new IllegalArgumentException("Pump not found: " + shift.getPumpId()));

        String priorStatus = shift.getStatus();
        BigDecimal litresSold = shift.computeLitresSold();
        long variance = shift.getVarianceFcfa();

        shift.markVoided();
        shiftRepository.save(shift);

        if ("OPEN".equals(priorStatus)) {
            pump.setStatus(PumpStatus.IDLE.name());
            pumpRepository.save(pump);
        } else if ("CLOSED".equals(priorStatus)) {
            if (pump.getTotalizerLitres().compareTo(shift.getClosingMeterLitres()) == 0) {
                pump.setTotalizerLitres(shift.getOpeningMeterLitres());
                pumpRepository.save(pump);
            }
            eventPublisher.publishEvent(new ShiftVoidedEvent(
                UUID.randomUUID().toString(), shift.getId(), station.tenantId(), shift.getStationId(),
                pump.getId(), pump.getTankId(), shift.getAttendantId(), litresSold, variance, Instant.now()
            ));
        }
    }

    private ShiftDto toDto(ShiftEntity shift, PumpEntity pump) {
        String attendantName = workforceQueryApi.findEmployee(shift.getAttendantId())
            .map(WorkforceQueryApi.EmployeeSnapshot::fullName)
            .orElse(shift.getAttendantId());
        return toDto(shift, pump, attendantName);
    }

    private ShiftDto toDto(ShiftEntity shift, PumpEntity pump, String attendantName) {
        return new ShiftDto(
            shift.getId(),
            shift.getStationId(),
            shift.getPumpId(),
            pump != null ? pump.getCode() : shift.getPumpId(),
            pump != null ? pump.getGrade() : "SUPER",
            shift.getAttendantId(),
            attendantName,
            shift.getOpeningMeterLitres(),
            shift.getClosingMeterLitres(),
            shift.computeLitresSold(),
            shift.getUnitPriceFcfa(),
            shift.computeExpectedRevenueFcfa(),
            shift.getCashFcfa(),
            shift.getMobileMoneyFcfa(),
            shift.getCardFcfa(),
            shift.getFleetCreditFcfa(),
            shift.getVarianceFcfa(),
            shift.getStatus(),
            shift.getOpenedAt(),
            shift.getClosedAt()
        );
    }
}

record ShiftDto(
    String id,
    String stationId,
    String pumpId,
    String pumpCode,
    String grade,
    String attendantId,
    String attendantName,
    BigDecimal openingMeterLitres,
    BigDecimal closingMeterLitres,
    BigDecimal litresSold,
    long unitPriceFcfa,
    long expectedRevenueFcfa,
    long cashFcfa,
    long mobileMoneyFcfa,
    long cardFcfa,
    long fleetCreditFcfa,
    long varianceFcfa,
    String status,
    Instant openedAt,
    Instant closedAt
) {}

record CreatePumpCommand(
    @NotBlank String stationId,
    @NotBlank String tankId,
    @NotBlank String code,
    @NotBlank String grade,
    @PositiveOrZero BigDecimal totalizerLitres,
    @Positive long unitPriceFcfa
) {}

record PatchPumpCommand(String status, Long unitPriceFcfa) {}
record MeterRolloverCommand(
    @NotNull @PositiveOrZero BigDecimal newTotalizerLitres,
    @NotNull @Positive BigDecimal rolloverMaxLitres,
    @NotBlank String approvalRef,
    @NotBlank String reason
) {}
record OpenShiftCommand(@NotBlank String stationId, @NotBlank String pumpId, @NotBlank String attendantId) {}
record CloseShiftCommand(
    @NotNull BigDecimal closingMeterLitres,
    @PositiveOrZero long cashFcfa,
    @PositiveOrZero long mobileMoneyFcfa,
    @PositiveOrZero long cardFcfa,
    @PositiveOrZero long fleetCreditFcfa,
    String varianceReason
) {}

@RestController
@RequestMapping("/api/v1/forecourt")
public class ForecourtController {
    private final ShiftCommandHandler shiftCommandHandler;

    public ForecourtController(ShiftCommandHandler shiftCommandHandler) {
        this.shiftCommandHandler = shiftCommandHandler;
    }

    @GetMapping("/pumps")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_forecourt:read')")
    public List<PumpEntity> listPumps(@RequestParam(required = false, defaultValue = "ALL") String stationId) {
        return shiftCommandHandler.listPumps(stationId);
    }

    @PostMapping("/pumps")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_forecourt:write')")
    public PumpEntity createPump(@Valid @RequestBody CreatePumpCommand cmd) {
        return shiftCommandHandler.createPump(cmd);
    }

    @PatchMapping("/pumps/{pumpId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_forecourt:write')")
    public PumpEntity patchPump(@PathVariable String pumpId, @RequestBody PatchPumpCommand cmd) {
        return shiftCommandHandler.patchPump(pumpId, cmd);
    }

    @PostMapping("/pumps/{pumpId}/meter-rollover")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_forecourt:write')")
    public Map<String, Object> recordMeterRollover(
        @PathVariable String pumpId,
        @Valid @RequestBody MeterRolloverCommand cmd
    ) {
        return shiftCommandHandler.recordMeterRollover(pumpId, cmd);
    }

    @DeleteMapping("/pumps/{pumpId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_forecourt:write')")
    public void deletePump(@PathVariable String pumpId) {
        shiftCommandHandler.deletePump(pumpId);
    }

    @GetMapping("/shifts")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_forecourt:read')")
    public List<ShiftDto> listShifts(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return shiftCommandHandler.listShifts(stationId, limit);
    }

    @PostMapping("/shifts/open")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT') or hasAuthority('SCOPE_forecourt:write')")
    public ShiftDto openShift(@Valid @RequestBody OpenShiftCommand command) {
        return shiftCommandHandler.openShift(command);
    }

    @PostMapping("/shifts/{shiftId}/close")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT') or hasAuthority('SCOPE_forecourt:write')")
    public ShiftDto closeShift(@PathVariable String shiftId, @Valid @RequestBody CloseShiftCommand command) {
        return shiftCommandHandler.closeShift(shiftId, command);
    }

    @DeleteMapping("/shifts/{shiftId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER') or hasAuthority('SCOPE_forecourt:write')")
    public void deleteShift(@PathVariable String shiftId) {
        shiftCommandHandler.voidShift(shiftId);
    }
}
