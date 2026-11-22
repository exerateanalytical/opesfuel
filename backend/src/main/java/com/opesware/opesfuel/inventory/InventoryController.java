package com.opesware.opesfuel.inventory;

import com.opesware.opesfuel.shared.domain.DomainEnums;
import com.opesware.opesfuel.shared.domain.DomainEnums.FuelGrade;
import com.opesware.opesfuel.shared.events.DomainEvent.DipstickVarianceFlaggedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.FuelDeliveryRecordedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.FuelDeliveryVoidedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ProvisionedFuelSpec;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftClosedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftVoidedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.StationInstitutionalSetupEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.TankShrinkageReconciledEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.TanksProvisionedEvent;
import com.opesware.opesfuel.station.StationCatalogApi;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Entity
@Table(name = "fuel_tanks")
class FuelTankEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String grade;
    @Column(name = "capacity_litres", nullable = false)
    private BigDecimal capacityLitres;
    @Column(name = "book_volume_litres", nullable = false)
    private BigDecimal bookVolumeLitres;
    @Column(name = "last_dip_litres", nullable = false)
    private BigDecimal lastDipLitres;
    @Column(name = "unit_cost_fcfa", nullable = false)
    private long unitCostFcfa;
    @Version
    private long version;

    public static FuelTankEntity create(String stationId, String name, String grade, BigDecimal capacityLitres, BigDecimal bookVolumeLitres, long unitCostFcfa) {
        return createWithId("tk_" + UUID.randomUUID(), stationId, name, grade, capacityLitres, bookVolumeLitres, unitCostFcfa);
    }

    public static FuelTankEntity createWithId(String tankId, String stationId, String name, String grade, BigDecimal capacityLitres, BigDecimal bookVolumeLitres, long unitCostFcfa) {
        FuelGrade validatedGrade = DomainEnums.parse(FuelGrade.class, grade, "grade");
        if (bookVolumeLitres.compareTo(capacityLitres) > 0) {
            throw new IllegalArgumentException("Book volume (" + bookVolumeLitres + " L) cannot exceed tank capacity (" + capacityLitres + " L).");
        }
        FuelTankEntity t = new FuelTankEntity();
        t.id = tankId;
        t.stationId = stationId;
        t.name = name.trim();
        t.grade = validatedGrade.name();
        t.capacityLitres = capacityLitres;
        t.bookVolumeLitres = bookVolumeLitres;
        t.lastDipLitres = bookVolumeLitres;
        t.unitCostFcfa = unitCostFcfa;
        return t;
    }

    public void updateFromOnboarding(BigDecimal capacityLitres, BigDecimal openingLitres, long unitCostFcfa) {
        if (openingLitres.compareTo(capacityLitres) > 0) {
            throw new IllegalArgumentException("Opening volume cannot exceed tank capacity.");
        }
        this.capacityLitres = capacityLitres;
        this.bookVolumeLitres = openingLitres;
        this.lastDipLitres = openingLitres;
        this.unitCostFcfa = unitCostFcfa;
    }

    public void deductDispensed(BigDecimal litresSold) {
        this.bookVolumeLitres = this.bookVolumeLitres.subtract(litresSold).max(BigDecimal.ZERO);
    }

    public void restoreDispensed(BigDecimal litresRestored) {
        this.bookVolumeLitres = this.bookVolumeLitres.add(litresRestored).min(this.capacityLitres);
    }

    public void receiveDelivery(BigDecimal actualLitres, long newUnitCostFcfa) {
        BigDecimal totalVol = this.bookVolumeLitres.add(actualLitres);
        if (totalVol.compareTo(this.capacityLitres) > 0) {
            BigDecimal ullage = this.capacityLitres.subtract(this.bookVolumeLitres).max(BigDecimal.ZERO);
            throw new IllegalStateException(
                "Delivery of " + actualLitres + " L exceeds tank ullage (" + ullage + " L remaining of " + this.capacityLitres + " L capacity)."
            );
        }
        BigDecimal existingVal = this.bookVolumeLitres.multiply(BigDecimal.valueOf(this.unitCostFcfa));
        BigDecimal incomingVal = actualLitres.multiply(BigDecimal.valueOf(newUnitCostFcfa));
        if (totalVol.compareTo(BigDecimal.ZERO) > 0) {
            this.unitCostFcfa = existingVal.add(incomingVal).divide(totalVol, 0, RoundingMode.HALF_UP).longValue();
        }
        this.bookVolumeLitres = totalVol;
        this.lastDipLitres = this.lastDipLitres.add(actualLitres).min(this.capacityLitres);
    }

    public void reverseDelivery(BigDecimal litres) {
        if (this.bookVolumeLitres.compareTo(litres) < 0) {
            throw new IllegalStateException(
                "Cannot void delivery of " + litres + " L because tank book volume is only " + this.bookVolumeLitres + " L."
            );
        }
        this.bookVolumeLitres = this.bookVolumeLitres.subtract(litres);
        this.lastDipLitres = this.lastDipLitres.subtract(litres).max(BigDecimal.ZERO);
    }

    public BigDecimal recordDipstick(BigDecimal measuredLitres) {
        if (measuredLitres.compareTo(this.capacityLitres) > 0) {
            throw new IllegalArgumentException(
                "Measured dipstick reading (" + measuredLitres + " L) cannot exceed tank capacity (" + this.capacityLitres + " L)."
            );
        }
        this.lastDipLitres = measuredLitres;
        return measuredLitres.subtract(this.bookVolumeLitres).setScale(2, RoundingMode.HALF_UP);
    }

    public BigDecimal reconcileBookToLastDip() {
        BigDecimal variance = this.lastDipLitres.subtract(this.bookVolumeLitres).setScale(2, RoundingMode.HALF_UP);
        this.bookVolumeLitres = this.lastDipLitres;
        return variance;
    }

    public BigDecimal getVarianceLitres() {
        return lastDipLitres.subtract(bookVolumeLitres).setScale(2, RoundingMode.HALF_UP);
    }

    public String getStatus() {
        if (getVarianceLitres().abs().compareTo(new BigDecimal("100")) > 0) {
            return "VARIANCE_ALERT";
        }
        if (capacityLitres.compareTo(BigDecimal.ZERO) > 0
            && bookVolumeLitres.divide(capacityLitres, 4, RoundingMode.HALF_UP).compareTo(new BigDecimal("0.20")) < 0) {
            return "LOW_STOCK";
        }
        return "NOMINAL";
    }

    public FuelTankDto toDto() {
        return new FuelTankDto(
            id, stationId, name, grade, capacityLitres, bookVolumeLitres, lastDipLitres,
            getVarianceLitres(), unitCostFcfa, getStatus()
        );
    }

    public InventoryQueryApi.TankSnapshot toSnapshot() {
        return new InventoryQueryApi.TankSnapshot(
            id, stationId, name, grade, capacityLitres, bookVolumeLitres, lastDipLitres, unitCostFcfa
        );
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getName() { return name; }
    public String getGrade() { return grade; }
    public BigDecimal getCapacityLitres() { return capacityLitres; }
    public BigDecimal getBookVolumeLitres() { return bookVolumeLitres; }
    public BigDecimal getLastDipLitres() { return lastDipLitres; }
    public long getUnitCostFcfa() { return unitCostFcfa; }
}

@Entity
@Table(name = "purchase_orders")
class PurchaseOrderEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "supplier_name", nullable = false)
    private String supplierName;
    @Column(nullable = false)
    private String grade;
    @Column(name = "ordered_litres", nullable = false)
    private BigDecimal orderedLitres;
    @Column(name = "unit_cost_fcfa", nullable = false)
    private long unitCostFcfa;
    @Column(nullable = false)
    private String status;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static PurchaseOrderEntity create(String stationId, String supplierName, String grade, BigDecimal orderedLitres, long unitCostFcfa) {
        FuelGrade validatedGrade = DomainEnums.parse(FuelGrade.class, grade, "grade");
        PurchaseOrderEntity po = new PurchaseOrderEntity();
        po.id = "po_" + UUID.randomUUID();
        po.stationId = stationId;
        po.supplierName = supplierName.trim();
        po.grade = validatedGrade.name();
        po.orderedLitres = orderedLitres;
        po.unitCostFcfa = unitCostFcfa;
        po.status = "PENDING";
        po.createdAt = Instant.now();
        return po;
    }

    public void markReceived() {
        if (!"PENDING".equals(this.status)) {
            throw new IllegalStateException("Purchase order " + this.id + " is already " + this.status + " and cannot be received again.");
        }
        this.status = "RECEIVED";
    }

    public void revertToPending() {
        if ("RECEIVED".equals(this.status)) {
            this.status = "PENDING";
        }
    }

    public void cancel() {
        if (!"PENDING".equals(this.status)) {
            throw new IllegalStateException("Only PENDING purchase orders can be cancelled.");
        }
        this.status = "CANCELLED";
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getSupplierName() { return supplierName; }
    public String getGrade() { return grade; }
    public BigDecimal getOrderedLitres() { return orderedLitres; }
    public long getUnitCostFcfa() { return unitCostFcfa; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
}

@Entity
@Table(name = "tank_deliveries")
class TankDeliveryEntity {
    @Id
    private String id;
    @Column(name = "tank_id", nullable = false)
    private String tankId;
    @Column(name = "purchase_order_id")
    private String purchaseOrderId;
    @Column(name = "supplier_name", nullable = false)
    private String supplierName;
    @Column(name = "bol_litres", nullable = false)
    private BigDecimal bolLitres;
    @Column(name = "actual_received_litres", nullable = false)
    private BigDecimal actualReceivedLitres;
    @Column(name = "unit_cost_fcfa", nullable = false)
    private long unitCostFcfa;
    @Column(name = "received_at", nullable = false)
    private Instant receivedAt;
    @Column(nullable = false)
    private boolean voided;
    @Column(name = "voided_at")
    private Instant voidedAt;

    public static TankDeliveryEntity create(String tankId, String poId, String supplierName, BigDecimal bol, BigDecimal actual, long unitCost) {
        TankDeliveryEntity d = new TankDeliveryEntity();
        d.id = "del_" + UUID.randomUUID();
        d.tankId = tankId;
        d.purchaseOrderId = (poId != null && !poId.isBlank()) ? poId : null;
        d.supplierName = supplierName.trim();
        d.bolLitres = bol;
        d.actualReceivedLitres = actual;
        d.unitCostFcfa = unitCost;
        d.receivedAt = Instant.now();
        d.voided = false;
        return d;
    }

    public void markVoided() {
        if (this.voided) {
            throw new IllegalStateException("Delivery " + this.id + " is already voided.");
        }
        this.voided = true;
        this.voidedAt = Instant.now();
    }

    public String getId() { return id; }
    public String getTankId() { return tankId; }
    public String getPurchaseOrderId() { return purchaseOrderId; }
    public String getSupplierName() { return supplierName; }
    public BigDecimal getBolLitres() { return bolLitres; }
    public BigDecimal getActualReceivedLitres() { return actualReceivedLitres; }
    public long getUnitCostFcfa() { return unitCostFcfa; }
    public Instant getReceivedAt() { return receivedAt; }
    public boolean isVoided() { return voided; }
    public Instant getVoidedAt() { return voidedAt; }
}

@Entity
@Table(name = "dipstick_readings")
class DipstickReadingEntity {
    @Id
    private String id;
    @Column(name = "tank_id", nullable = false)
    private String tankId;
    @Column(name = "book_litres", nullable = false)
    private BigDecimal bookLitres;
    @Column(name = "measured_litres", nullable = false)
    private BigDecimal measuredLitres;
    @Column(name = "variance_litres", nullable = false)
    private BigDecimal varianceLitres;
    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt;

    public static DipstickReadingEntity create(String tankId, BigDecimal bookLitres, BigDecimal measuredLitres, BigDecimal varianceLitres) {
        DipstickReadingEntity r = new DipstickReadingEntity();
        r.id = "dip_" + UUID.randomUUID();
        r.tankId = tankId;
        r.bookLitres = bookLitres;
        r.measuredLitres = measuredLitres;
        r.varianceLitres = varianceLitres;
        r.recordedAt = Instant.now();
        return r;
    }

    public String getId() { return id; }
    public String getTankId() { return tankId; }
    public BigDecimal getBookLitres() { return bookLitres; }
    public BigDecimal getMeasuredLitres() { return measuredLitres; }
    public BigDecimal getVarianceLitres() { return varianceLitres; }
    public Instant getRecordedAt() { return recordedAt; }
}

interface FuelTankRepository extends JpaRepository<FuelTankEntity, String> {
    List<FuelTankEntity> findByStationIdInOrderByNameAsc(List<String> stationIds);
    List<FuelTankEntity> findByStationIdAndGradeOrderByNameAsc(String stationId, String grade);
    Optional<FuelTankEntity> findFirstByStationIdAndGradeAndNameIgnoreCase(String stationId, String grade, String name);
}

interface PurchaseOrderRepository extends JpaRepository<PurchaseOrderEntity, String> {
    List<PurchaseOrderEntity> findByStationIdInOrderByCreatedAtDesc(List<String> stationIds, PageRequest pageable);
}

interface TankDeliveryRepository extends JpaRepository<TankDeliveryEntity, String> {
    List<TankDeliveryEntity> findByTankIdInAndVoidedFalseOrderByReceivedAtDesc(List<String> tankIds, PageRequest pageable);
    boolean existsByTankId(String tankId);
}

interface DipstickReadingRepository extends JpaRepository<DipstickReadingEntity, String> {
    List<DipstickReadingEntity> findByTankIdInOrderByRecordedAtDesc(List<String> tankIds, PageRequest pageable);
    boolean existsByTankId(String tankId);
}

@Service
class InventoryService implements InventoryQueryApi {
    private final FuelTankRepository tankRepository;
    private final PurchaseOrderRepository poRepository;
    private final TankDeliveryRepository deliveryRepository;
    private final DipstickReadingRepository dipstickRepository;
    private final StationCatalogApi stationCatalogApi;
    private final JdbcTemplate jdbcTemplate;
    private final ApplicationEventPublisher eventPublisher;

    InventoryService(
        FuelTankRepository tankRepository,
        PurchaseOrderRepository poRepository,
        TankDeliveryRepository deliveryRepository,
        DipstickReadingRepository dipstickRepository,
        StationCatalogApi stationCatalogApi,
        JdbcTemplate jdbcTemplate,
        ApplicationEventPublisher eventPublisher
    ) {
        this.tankRepository = tankRepository;
        this.poRepository = poRepository;
        this.deliveryRepository = deliveryRepository;
        this.dipstickRepository = dipstickRepository;
        this.stationCatalogApi = stationCatalogApi;
        this.jdbcTemplate = jdbcTemplate;
        this.eventPublisher = eventPublisher;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TankSnapshot> findTank(String tankId) {
        return tankRepository.findById(tankId).map(FuelTankEntity::toSnapshot);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<TankSnapshot> findPrimaryTankByStationAndGrade(String stationId, String grade) {
        FuelGrade validated = DomainEnums.parse(FuelGrade.class, grade, "grade");
        return tankRepository.findByStationIdAndGradeOrderByNameAsc(stationId, validated.name())
            .stream()
            .findFirst()
            .map(FuelTankEntity::toSnapshot);
    }

    @Override
    @Transactional
    public void deductStandaloneFuelSale(String tankId, BigDecimal litresSold) {
        FuelTankEntity tank = tankRepository.findById(tankId)
            .orElseThrow(() -> new IllegalArgumentException("Tank not found: " + tankId));
        tank.deductDispensed(litresSold);
        tankRepository.save(tank);
    }

    @ApplicationModuleListener
    public void onShiftClosed(ShiftClosedEvent event) {
        if (event.litresSold() == null || event.litresSold().compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        tankRepository.findById(event.tankId()).ifPresent(tank -> {
            tank.deductDispensed(event.litresSold());
            tankRepository.save(tank);
        });
    }

    @ApplicationModuleListener
    public void onShiftVoided(ShiftVoidedEvent event) {
        if (event.litresSold() == null || event.litresSold().compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        tankRepository.findById(event.tankId()).ifPresent(tank -> {
            tank.restoreDispensed(event.litresSold());
            tankRepository.save(tank);
        });
    }

    /**
     * Provisions or updates tanks first, commits them, and then emits TanksProvisionedEvent
     * so Forecourt safely creates pumps referencing committed tank IDs with zero FK race condition.
     */
    @ApplicationModuleListener
    public void onInstitutionalSetup(StationInstitutionalSetupEvent event) {
        List<ProvisionedFuelSpec> resolvedSpecs = new ArrayList<>();
        for (ProvisionedFuelSpec spec : event.items()) {
            Optional<FuelTankEntity> existing = tankRepository.findFirstByStationIdAndGradeAndNameIgnoreCase(
                event.stationId(), spec.grade(), spec.tankName()
            );
            String finalTankId;
            if (existing.isPresent()) {
                FuelTankEntity tank = existing.get();
                tank.updateFromOnboarding(spec.capacityLitres(), spec.openingLitres(), spec.unitCostFcfa());
                tankRepository.save(tank);
                finalTankId = tank.getId();
            } else {
                FuelTankEntity created = FuelTankEntity.createWithId(
                    spec.tankId(), event.stationId(), spec.tankName(), spec.grade(),
                    spec.capacityLitres(), spec.openingLitres(), spec.unitCostFcfa()
                );
                tankRepository.save(created);
                finalTankId = created.getId();
            }
            resolvedSpecs.add(new ProvisionedFuelSpec(
                finalTankId, spec.grade(), spec.tankName(), spec.capacityLitres(),
                spec.openingLitres(), spec.unitCostFcfa(), spec.sellingPriceFcfa(), spec.nozzleCount()
            ));
        }

        eventPublisher.publishEvent(new TanksProvisionedEvent(
            UUID.randomUUID().toString(),
            event.stationId(),
            event.tenantId(),
            event.stationId(),
            resolvedSpecs,
            event.lubricantsPack(),
            Instant.now()
        ));
    }

    @Transactional
    public FuelTankDto createTank(CreateTankCommand cmd) {
        stationCatalogApi.requireAccessibleStation(cmd.stationId());
        FuelTankEntity saved = tankRepository.save(FuelTankEntity.create(
            cmd.stationId(), cmd.name(), cmd.grade(), cmd.capacityLitres(), cmd.bookVolumeLitres(), cmd.unitCostFcfa()
        ));
        return saved.toDto();
    }

    @Transactional
    public void deleteTank(String tankId) {
        FuelTankEntity tank = tankRepository.findById(tankId)
            .orElseThrow(() -> new IllegalArgumentException("Tank not found: " + tankId));
        stationCatalogApi.requireAccessibleStation(tank.getStationId());
        Integer linkedPumps = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM pumps WHERE tank_id = ?", Integer.class, tankId
        );
        if ((linkedPumps != null && linkedPumps > 0)
            || deliveryRepository.existsByTankId(tankId)
            || dipstickRepository.existsByTankId(tankId)) {
            throw new IllegalStateException("Cannot delete tank " + tank.getName() + " while linked pumps, deliveries, or dipstick history exist.");
        }
        tankRepository.deleteById(tankId);
    }

    @Transactional
    public PurchaseOrderEntity createPurchaseOrder(CreatePurchaseOrderCommand cmd) {
        stationCatalogApi.requireAccessibleStation(cmd.stationId());
        return poRepository.save(PurchaseOrderEntity.create(
            cmd.stationId(), cmd.supplierName(), cmd.grade(), cmd.orderedLitres(), cmd.unitCostFcfa()
        ));
    }

    @Transactional
    public PurchaseOrderEntity cancelPurchaseOrder(String poId) {
        PurchaseOrderEntity po = poRepository.findById(poId)
            .orElseThrow(() -> new IllegalArgumentException("Purchase order not found: " + poId));
        stationCatalogApi.requireAccessibleStation(po.getStationId());
        po.cancel();
        return poRepository.save(po);
    }

    @Transactional
    public void deletePurchaseOrder(String poId) {
        PurchaseOrderEntity po = poRepository.findById(poId)
            .orElseThrow(() -> new IllegalArgumentException("Purchase order not found: " + poId));
        stationCatalogApi.requireAccessibleStation(po.getStationId());
        if ("RECEIVED".equals(po.getStatus())) {
            throw new IllegalStateException("Cannot delete a RECEIVED purchase order. Void the linked delivery first.");
        }
        poRepository.deleteById(poId);
    }

    @Transactional
    public FuelTankDto receiveDelivery(ReceiveDeliveryCommand cmd) {
        FuelTankEntity tank = tankRepository.findById(cmd.tankId())
            .orElseThrow(() -> new IllegalArgumentException("Tank not found: " + cmd.tankId()));
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(tank.getStationId());

        PurchaseOrderEntity linkedPo = null;
        if (cmd.purchaseOrderId() != null && !cmd.purchaseOrderId().isBlank()) {
            linkedPo = poRepository.findById(cmd.purchaseOrderId())
                .orElseThrow(() -> new IllegalArgumentException("Purchase order not found: " + cmd.purchaseOrderId()));
            if (!linkedPo.getStationId().equals(tank.getStationId())) {
                throw new IllegalArgumentException("Purchase order belongs to a different station than the target tank.");
            }
            if (!linkedPo.getGrade().equalsIgnoreCase(tank.getGrade())) {
                throw new IllegalArgumentException("Purchase order fuel grade (" + linkedPo.getGrade() + ") does not match tank grade (" + tank.getGrade() + ").");
            }
            linkedPo.markReceived();
            poRepository.save(linkedPo);
        }

        tank.receiveDelivery(cmd.actualReceivedLitres(), cmd.unitCostFcfa());
        tankRepository.save(tank);

        TankDeliveryEntity delivery = deliveryRepository.save(TankDeliveryEntity.create(
            tank.getId(), linkedPo != null ? linkedPo.getId() : null,
            cmd.supplierName(), cmd.bolLitres(), cmd.actualReceivedLitres(), cmd.unitCostFcfa()
        ));

        long totalInvoiceFcfa = cmd.actualReceivedLitres()
            .multiply(BigDecimal.valueOf(cmd.unitCostFcfa()))
            .setScale(0, RoundingMode.HALF_UP)
            .longValue();

        eventPublisher.publishEvent(new FuelDeliveryRecordedEvent(
            UUID.randomUUID().toString(), delivery.getId(), station.tenantId(), tank.getStationId(), tank.getId(),
            cmd.supplierName(), cmd.bolLitres(), cmd.actualReceivedLitres(), totalInvoiceFcfa, delivery.getReceivedAt()
        ));
        return tank.toDto();
    }

    @Transactional
    public void voidDelivery(String deliveryId) {
        TankDeliveryEntity delivery = deliveryRepository.findById(deliveryId)
            .orElseThrow(() -> new IllegalArgumentException("Delivery not found: " + deliveryId));
        FuelTankEntity tank = tankRepository.findById(delivery.getTankId())
            .orElseThrow(() -> new IllegalArgumentException("Tank not found: " + delivery.getTankId()));
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(tank.getStationId());

        delivery.markVoided();
        tank.reverseDelivery(delivery.getActualReceivedLitres());
        tankRepository.save(tank);
        deliveryRepository.save(delivery);

        if (delivery.getPurchaseOrderId() != null) {
            poRepository.findById(delivery.getPurchaseOrderId()).ifPresent(po -> {
                po.revertToPending();
                poRepository.save(po);
            });
        }

        long totalInvoiceFcfa = delivery.getActualReceivedLitres()
            .multiply(BigDecimal.valueOf(delivery.getUnitCostFcfa()))
            .setScale(0, RoundingMode.HALF_UP)
            .longValue();

        eventPublisher.publishEvent(new FuelDeliveryVoidedEvent(
            UUID.randomUUID().toString(), delivery.getId(), station.tenantId(), tank.getStationId(), tank.getId(),
            delivery.getActualReceivedLitres(), totalInvoiceFcfa, Instant.now()
        ));
    }

    @Transactional
    public FuelTankDto recordDipstick(RecordDipstickCommand cmd) {
        FuelTankEntity tank = tankRepository.findById(cmd.tankId())
            .orElseThrow(() -> new IllegalArgumentException("Tank not found: " + cmd.tankId()));
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(tank.getStationId());

        BigDecimal variance = tank.recordDipstick(cmd.measuredLitres());
        tankRepository.save(tank);

        DipstickReadingEntity reading = dipstickRepository.save(
            DipstickReadingEntity.create(tank.getId(), tank.getBookVolumeLitres(), cmd.measuredLitres(), variance)
        );

        if (variance.abs().compareTo(new BigDecimal("100")) > 0) {
            eventPublisher.publishEvent(new DipstickVarianceFlaggedEvent(
                UUID.randomUUID().toString(), reading.getId(), station.tenantId(), tank.getStationId(), tank.getId(),
                tank.getBookVolumeLitres(), cmd.measuredLitres(), variance, reading.getRecordedAt()
            ));
        }
        return tank.toDto();
    }

    @Transactional
    public FuelTankDto reconcileShrinkage(String tankId, ReconcileShrinkageCommand cmd) {
        FuelTankEntity tank = tankRepository.findById(tankId)
            .orElseThrow(() -> new IllegalArgumentException("Tank not found: " + tankId));
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(tank.getStationId());

        BigDecimal varianceLitres = tank.reconcileBookToLastDip();
        if (varianceLitres.compareTo(BigDecimal.ZERO) == 0) {
            return tank.toDto();
        }
        tankRepository.save(tank);

        long adjustmentValueFcfa = varianceLitres.abs()
            .multiply(BigDecimal.valueOf(tank.getUnitCostFcfa()))
            .setScale(0, RoundingMode.HALF_UP)
            .longValue();

        if (adjustmentValueFcfa > 0) {
            eventPublisher.publishEvent(new TankShrinkageReconciledEvent(
                UUID.randomUUID().toString(), tank.getId(), station.tenantId(), tank.getStationId(), tank.getId(),
                varianceLitres, adjustmentValueFcfa,
                cmd != null && cmd.reason() != null ? cmd.reason() : "Physical dipstick calibration reconciliation",
                Instant.now()
            ));
        }
        return tank.toDto();
    }

    @Transactional
    public void deleteDipstick(String dipstickId) {
        DipstickReadingEntity reading = dipstickRepository.findById(dipstickId)
            .orElseThrow(() -> new IllegalArgumentException("Dipstick reading not found: " + dipstickId));
        FuelTankEntity tank = tankRepository.findById(reading.getTankId())
            .orElseThrow(() -> new IllegalArgumentException("Tank not found: " + reading.getTankId()));
        stationCatalogApi.requireAccessibleStation(tank.getStationId());
        dipstickRepository.deleteById(dipstickId);
    }

    @Transactional(readOnly = true)
    public List<FuelTankDto> listTanks(String stationId) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return tankRepository.findByStationIdInOrderByNameAsc(stationIds).stream()
            .map(FuelTankEntity::toDto)
            .toList();
    }

    @Transactional(readOnly = true)
    public List<PurchaseOrderEntity> listPurchaseOrders(String stationId, int limit) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return poRepository.findByStationIdInOrderByCreatedAtDesc(stationIds, PageRequest.of(0, Math.max(1, Math.min(limit, 200))));
    }

    @Transactional(readOnly = true)
    public List<TankDeliveryEntity> listDeliveries(String stationId, int limit) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        List<String> tankIds = tankRepository.findByStationIdInOrderByNameAsc(stationIds).stream().map(FuelTankEntity::getId).toList();
        if (tankIds.isEmpty()) return List.of();
        return deliveryRepository.findByTankIdInAndVoidedFalseOrderByReceivedAtDesc(tankIds, PageRequest.of(0, Math.max(1, Math.min(limit, 200))));
    }

    @Transactional(readOnly = true)
    public List<DipstickReadingEntity> listDipsticks(String stationId, int limit) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        List<String> tankIds = tankRepository.findByStationIdInOrderByNameAsc(stationIds).stream().map(FuelTankEntity::getId).toList();
        if (tankIds.isEmpty()) return List.of();
        return dipstickRepository.findByTankIdInOrderByRecordedAtDesc(tankIds, PageRequest.of(0, Math.max(1, Math.min(limit, 200))));
    }
}

record FuelTankDto(
    String id,
    String stationId,
    String name,
    String grade,
    BigDecimal capacityLitres,
    BigDecimal bookVolumeLitres,
    BigDecimal lastDipLitres,
    BigDecimal varianceLitres,
    long unitCostFcfa,
    String status
) {}

record CreateTankCommand(
    @NotBlank String stationId,
    @NotBlank String name,
    @NotBlank String grade,
    @NotNull @Positive BigDecimal capacityLitres,
    @NotNull @PositiveOrZero BigDecimal bookVolumeLitres,
    @Positive long unitCostFcfa
) {}

record CreatePurchaseOrderCommand(
    @NotBlank String stationId,
    @NotBlank String supplierName,
    @NotBlank String grade,
    @NotNull @Positive BigDecimal orderedLitres,
    @Positive long unitCostFcfa
) {}

record ReceiveDeliveryCommand(
    @NotBlank String tankId,
    String purchaseOrderId,
    @NotBlank String supplierName,
    @NotNull @Positive BigDecimal bolLitres,
    @NotNull @Positive BigDecimal actualReceivedLitres,
    @Positive long unitCostFcfa
) {}

record RecordDipstickCommand(@NotBlank String tankId, @NotNull @PositiveOrZero BigDecimal measuredLitres) {}
record ReconcileShrinkageCommand(String reason) {}

@Entity
@Table(name = "suppliers")
class SupplierEntity {
    @Id
    private String id;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;
    @Column(nullable = false)
    private String name;
    @Column(name = "tax_id")
    private String taxId;
    @Column(name = "contact_phone")
    private String contactPhone;
    @Column(name = "contact_email")
    private String contactEmail;
    @Column(name = "payment_terms_days", nullable = false)
    private int paymentTermsDays = 15;
    @Column(nullable = false)
    private boolean active = true;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    public static SupplierEntity create(String tenantId, String name, String taxId, String phone, String email, Integer paymentTermsDays) {
        SupplierEntity s = new SupplierEntity();
        s.id = "sup_" + UUID.randomUUID();
        s.tenantId = tenantId;
        s.name = name.trim();
        s.taxId = taxId != null && !taxId.isBlank() ? taxId.trim().toUpperCase() : null;
        s.contactPhone = phone != null && !phone.isBlank() ? phone.trim() : null;
        s.contactEmail = email != null && !email.isBlank() ? email.trim().toLowerCase() : null;
        s.paymentTermsDays = paymentTermsDays != null && paymentTermsDays >= 0 ? paymentTermsDays : 15;
        s.active = true;
        s.createdAt = Instant.now();
        return s;
    }

    public String getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getName() { return name; }
    public String getTaxId() { return taxId; }
    public String getContactPhone() { return contactPhone; }
    public String getContactEmail() { return contactEmail; }
    public int getPaymentTermsDays() { return paymentTermsDays; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
}

interface SupplierRepository extends JpaRepository<SupplierEntity, String> {
    List<SupplierEntity> findByTenantIdOrderByNameAsc(String tenantId);
}

record CreateSupplierCommand(
    @NotBlank String name,
    String taxId,
    String contactPhone,
    String contactEmail,
    Integer paymentTermsDays
) {}

record AtgTelemetryCommand(
    @NotNull @PositiveOrZero BigDecimal grossObservedLitres,
    @NotNull BigDecimal temperatureCelsius,
    @PositiveOrZero BigDecimal waterLevelMm
) {}

record AtgTelemetryResultDto(
    FuelTankDto tank,
    BigDecimal grossObservedLitres,
    BigDecimal temperatureCelsius,
    BigDecimal compensated15CLitres,
    BigDecimal waterLevelMm,
    boolean waterAlert
) {}

@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {
    private final InventoryService inventoryService;
    private final SupplierRepository supplierRepository;
    private final com.opesware.opesfuel.shared.security.TenantAccessGuard accessGuard;

    public InventoryController(
        InventoryService inventoryService,
        SupplierRepository supplierRepository,
        com.opesware.opesfuel.shared.security.TenantAccessGuard accessGuard
    ) {
        this.inventoryService = inventoryService;
        this.supplierRepository = supplierRepository;
        this.accessGuard = accessGuard;
    }

    @GetMapping("/suppliers")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_inventory:read')")
    public List<SupplierEntity> listSuppliers() {
        return supplierRepository.findByTenantIdOrderByNameAsc(accessGuard.currentTenantId());
    }

    @PostMapping("/suppliers")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_inventory:write')")
    public SupplierEntity createSupplier(@Valid @RequestBody CreateSupplierCommand cmd) {
        return supplierRepository.save(SupplierEntity.create(
            accessGuard.currentTenantId(), cmd.name(), cmd.taxId(), cmd.contactPhone(), cmd.contactEmail(), cmd.paymentTermsDays()
        ));
    }

    @PostMapping("/tanks/{tankId}/atg-telemetry")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT') or hasAuthority('SCOPE_inventory:write')")
    public AtgTelemetryResultDto ingestAtgTelemetry(@PathVariable String tankId, @Valid @RequestBody AtgTelemetryCommand cmd) {
        // ASTM Table 54B thermal expansion approximation to 15°C standard reference (~0.0010/°C for petrol/diesel)
        BigDecimal deltaT = cmd.temperatureCelsius().subtract(new BigDecimal("15.0"));
        BigDecimal vcf = BigDecimal.ONE.subtract(deltaT.multiply(new BigDecimal("0.0010")));
        BigDecimal compensated = cmd.grossObservedLitres().multiply(vcf).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        FuelTankDto tank = inventoryService.recordDipstick(new RecordDipstickCommand(tankId, compensated));
        BigDecimal waterMm = cmd.waterLevelMm() != null ? cmd.waterLevelMm() : BigDecimal.ZERO;
        return new AtgTelemetryResultDto(
            tank, cmd.grossObservedLitres(), cmd.temperatureCelsius(), compensated, waterMm,
            waterMm.compareTo(new BigDecimal("25")) > 0
        );
    }

    @GetMapping("/tanks")
    @PreAuthorize("hasAnyRole('OWNER','GROUP_CFO','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_inventory:read')")
    public List<FuelTankDto> listTanks(@RequestParam(required = false, defaultValue = "ALL") String stationId) {
        return inventoryService.listTanks(stationId);
    }

    @PostMapping("/tanks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_inventory:write')")
    public FuelTankDto createTank(@Valid @RequestBody CreateTankCommand cmd) {
        return inventoryService.createTank(cmd);
    }

    @DeleteMapping("/tanks/{tankId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER') or hasAuthority('SCOPE_inventory:write')")
    public void deleteTank(@PathVariable String tankId) {
        inventoryService.deleteTank(tankId);
    }

    @PostMapping("/tanks/{tankId}/reconcile-shrinkage")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_inventory:write')")
    public FuelTankDto reconcileShrinkage(@PathVariable String tankId, @RequestBody(required = false) ReconcileShrinkageCommand cmd) {
        return inventoryService.reconcileShrinkage(tankId, cmd);
    }

    @GetMapping("/purchase-orders")
    @PreAuthorize("hasAnyRole('OWNER','GROUP_CFO','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_inventory:read')")
    public List<PurchaseOrderEntity> listPurchaseOrders(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return inventoryService.listPurchaseOrders(stationId, limit);
    }

    @PostMapping("/purchase-orders")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_inventory:write')")
    public PurchaseOrderEntity createPurchaseOrder(@Valid @RequestBody CreatePurchaseOrderCommand command) {
        return inventoryService.createPurchaseOrder(command);
    }

    @PatchMapping("/purchase-orders/{poId}/cancel")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_inventory:write')")
    public PurchaseOrderEntity cancelPurchaseOrder(@PathVariable String poId) {
        return inventoryService.cancelPurchaseOrder(poId);
    }

    @DeleteMapping("/purchase-orders/{poId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_inventory:write')")
    public void deletePurchaseOrder(@PathVariable String poId) {
        inventoryService.deletePurchaseOrder(poId);
    }

    @GetMapping("/deliveries")
    @PreAuthorize("hasAnyRole('OWNER','GROUP_CFO','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_inventory:read')")
    public List<TankDeliveryEntity> listDeliveries(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return inventoryService.listDeliveries(stationId, limit);
    }

    @PostMapping("/deliveries")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_inventory:write')")
    public FuelTankDto receiveDelivery(@Valid @RequestBody ReceiveDeliveryCommand command) {
        return inventoryService.receiveDelivery(command);
    }

    @DeleteMapping("/deliveries/{deliveryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER') or hasAuthority('SCOPE_inventory:write')")
    public void voidDelivery(@PathVariable String deliveryId) {
        inventoryService.voidDelivery(deliveryId);
    }

    @GetMapping("/dipsticks")
    @PreAuthorize("hasAnyRole('OWNER','GROUP_CFO','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_inventory:read')")
    public List<DipstickReadingEntity> listDipsticks(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return inventoryService.listDipsticks(stationId, limit);
    }

    @PostMapping("/dipsticks")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT') or hasAuthority('SCOPE_inventory:write')")
    public FuelTankDto recordDipstick(@Valid @RequestBody RecordDipstickCommand command) {
        return inventoryService.recordDipstick(command);
    }

    @DeleteMapping("/dipsticks/{dipstickId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_inventory:write')")
    public void deleteDipstick(@PathVariable String dipstickId) {
        inventoryService.deleteDipstick(dipstickId);
    }
}
