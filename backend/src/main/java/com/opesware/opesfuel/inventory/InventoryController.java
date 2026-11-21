package com.opesware.opesfuel.inventory;

import com.opesware.opesfuel.shared.events.DomainEvent.DipstickVarianceFlaggedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.FuelDeliveryRecordedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ProvisionedFuelSpec;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftClosedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.StationInstitutionalSetupEvent;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
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
        return createWithId("tk_" + UUID.randomUUID().toString().substring(0, 8), stationId, name, grade, capacityLitres, bookVolumeLitres, unitCostFcfa);
    }

    public static FuelTankEntity createWithId(String tankId, String stationId, String name, String grade, BigDecimal capacityLitres, BigDecimal bookVolumeLitres, long unitCostFcfa) {
        FuelTankEntity t = new FuelTankEntity();
        t.id = tankId;
        t.stationId = stationId;
        t.name = name.trim();
        t.grade = grade.trim().toUpperCase();
        t.capacityLitres = capacityLitres;
        t.bookVolumeLitres = bookVolumeLitres;
        t.lastDipLitres = bookVolumeLitres;
        t.unitCostFcfa = unitCostFcfa;
        return t;
    }

    public void deductDispensed(BigDecimal litresSold) {
        this.bookVolumeLitres = this.bookVolumeLitres.subtract(litresSold).max(BigDecimal.ZERO);
    }

    public void receiveDelivery(BigDecimal actualLitres, long newUnitCostFcfa) {
        BigDecimal existingVal = this.bookVolumeLitres.multiply(BigDecimal.valueOf(this.unitCostFcfa));
        BigDecimal incomingVal = actualLitres.multiply(BigDecimal.valueOf(newUnitCostFcfa));
        BigDecimal totalVol = this.bookVolumeLitres.add(actualLitres);
        if (totalVol.compareTo(BigDecimal.ZERO) > 0) {
            this.unitCostFcfa = existingVal.add(incomingVal).divide(totalVol, 0, RoundingMode.HALF_UP).longValue();
        }
        this.bookVolumeLitres = totalVol.min(this.capacityLitres);
        this.lastDipLitres = this.lastDipLitres.add(actualLitres).min(this.capacityLitres);
    }

    public BigDecimal recordDipstick(BigDecimal measuredLitres) {
        this.lastDipLitres = measuredLitres;
        return measuredLitres.subtract(this.bookVolumeLitres).setScale(2, RoundingMode.HALF_UP);
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
        PurchaseOrderEntity po = new PurchaseOrderEntity();
        po.id = "po_" + UUID.randomUUID().toString().substring(0, 8);
        po.stationId = stationId;
        po.supplierName = supplierName;
        po.grade = grade.toUpperCase();
        po.orderedLitres = orderedLitres;
        po.unitCostFcfa = unitCostFcfa;
        po.status = "PENDING";
        po.createdAt = Instant.now();
        return po;
    }

    public void markReceived() { this.status = "RECEIVED"; }

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

    public static TankDeliveryEntity create(String tankId, String poId, String supplierName, BigDecimal bol, BigDecimal actual, long unitCost) {
        TankDeliveryEntity d = new TankDeliveryEntity();
        d.id = "del_" + UUID.randomUUID().toString().substring(0, 8);
        d.tankId = tankId;
        d.purchaseOrderId = poId;
        d.supplierName = supplierName;
        d.bolLitres = bol;
        d.actualReceivedLitres = actual;
        d.unitCostFcfa = unitCost;
        d.receivedAt = Instant.now();
        return d;
    }

    public String getId() { return id; }
    public String getTankId() { return tankId; }
    public String getPurchaseOrderId() { return purchaseOrderId; }
    public String getSupplierName() { return supplierName; }
    public BigDecimal getBolLitres() { return bolLitres; }
    public BigDecimal getActualReceivedLitres() { return actualReceivedLitres; }
    public long getUnitCostFcfa() { return unitCostFcfa; }
    public Instant getReceivedAt() { return receivedAt; }
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
        r.id = "dip_" + UUID.randomUUID().toString().substring(0, 8);
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
    List<FuelTankEntity> findByStationIdOrderByNameAsc(String stationId);
}

interface PurchaseOrderRepository extends JpaRepository<PurchaseOrderEntity, String> {
    List<PurchaseOrderEntity> findByStationIdOrderByCreatedAtDesc(String stationId);
}

interface TankDeliveryRepository extends JpaRepository<TankDeliveryEntity, String> {
    List<TankDeliveryEntity> findTop50ByOrderByReceivedAtDesc();
}

interface DipstickReadingRepository extends JpaRepository<DipstickReadingEntity, String> {
    List<DipstickReadingEntity> findTop50ByOrderByRecordedAtDesc();
}

@Service
class InventoryService {
    private final FuelTankRepository tankRepository;
    private final PurchaseOrderRepository poRepository;
    private final TankDeliveryRepository deliveryRepository;
    private final DipstickReadingRepository dipstickRepository;
    private final ApplicationEventPublisher eventPublisher;

    InventoryService(FuelTankRepository tankRepository, PurchaseOrderRepository poRepository,
                     TankDeliveryRepository deliveryRepository, DipstickReadingRepository dipstickRepository,
                     ApplicationEventPublisher eventPublisher) {
        this.tankRepository = tankRepository;
        this.poRepository = poRepository;
        this.deliveryRepository = deliveryRepository;
        this.dipstickRepository = dipstickRepository;
        this.eventPublisher = eventPublisher;
    }

    @ApplicationModuleListener
    public void onShiftClosed(ShiftClosedEvent event) {
        tankRepository.findById(event.tankId()).ifPresent(tank -> {
            tank.deductDispensed(event.litresSold());
            tankRepository.save(tank);
        });
    }

    @ApplicationModuleListener
    public void onInstitutionalSetup(StationInstitutionalSetupEvent event) {
        for (ProvisionedFuelSpec spec : event.items()) {
            if (!tankRepository.existsById(spec.tankId())) {
                tankRepository.save(FuelTankEntity.createWithId(
                    spec.tankId(),
                    event.stationId(),
                    spec.tankName(),
                    spec.grade(),
                    spec.capacityLitres(),
                    spec.openingLitres(),
                    spec.unitCostFcfa()
                ));
            }
        }
    }

    @Transactional
    public PurchaseOrderEntity createPurchaseOrder(CreatePurchaseOrderCommand cmd) {
        return poRepository.save(PurchaseOrderEntity.create(
            cmd.stationId(), cmd.supplierName(), cmd.grade(), cmd.orderedLitres(), cmd.unitCostFcfa()
        ));
    }

    @Transactional
    public FuelTankEntity receiveDelivery(ReceiveDeliveryCommand cmd) {
        FuelTankEntity tank = tankRepository.findById(cmd.tankId())
            .orElseThrow(() -> new IllegalArgumentException("Tank not found: " + cmd.tankId()));
        tank.receiveDelivery(cmd.actualReceivedLitres(), cmd.unitCostFcfa());
        tankRepository.save(tank);

        TankDeliveryEntity delivery = deliveryRepository.save(TankDeliveryEntity.create(
            tank.getId(), cmd.purchaseOrderId(), cmd.supplierName(), cmd.bolLitres(), cmd.actualReceivedLitres(), cmd.unitCostFcfa()
        ));

        if (cmd.purchaseOrderId() != null && !cmd.purchaseOrderId().isBlank()) {
            poRepository.findById(cmd.purchaseOrderId()).ifPresent(po -> {
                po.markReceived();
                poRepository.save(po);
            });
        }

        long totalInvoiceFcfa = cmd.actualReceivedLitres()
            .multiply(BigDecimal.valueOf(cmd.unitCostFcfa()))
            .setScale(0, RoundingMode.HALF_UP)
            .longValue();

        eventPublisher.publishEvent(new FuelDeliveryRecordedEvent(
            UUID.randomUUID().toString(), delivery.getId(), tank.getStationId(), tank.getId(),
            cmd.supplierName(), cmd.bolLitres(), cmd.actualReceivedLitres(), totalInvoiceFcfa, delivery.getReceivedAt()
        ));
        return tank;
    }

    @Transactional
    public FuelTankEntity recordDipstick(RecordDipstickCommand cmd) {
        FuelTankEntity tank = tankRepository.findById(cmd.tankId())
            .orElseThrow(() -> new IllegalArgumentException("Tank not found: " + cmd.tankId()));
        BigDecimal variance = tank.recordDipstick(cmd.measuredLitres());
        tankRepository.save(tank);

        DipstickReadingEntity reading = dipstickRepository.save(
            DipstickReadingEntity.create(tank.getId(), tank.getBookVolumeLitres(), cmd.measuredLitres(), variance)
        );

        if (variance.abs().compareTo(new BigDecimal("100")) > 0) {
            eventPublisher.publishEvent(new DipstickVarianceFlaggedEvent(
                UUID.randomUUID().toString(), reading.getId(), tank.getStationId(), tank.getId(),
                tank.getBookVolumeLitres(), cmd.measuredLitres(), variance, reading.getRecordedAt()
            ));
        }
        return tank;
    }
}

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

record RecordDipstickCommand(@NotBlank String tankId, @NotNull @Positive BigDecimal measuredLitres) {}

@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {
    private final FuelTankRepository tankRepository;
    private final PurchaseOrderRepository poRepository;
    private final TankDeliveryRepository deliveryRepository;
    private final DipstickReadingRepository dipstickRepository;
    private final InventoryService inventoryService;

    public InventoryController(FuelTankRepository tankRepository, PurchaseOrderRepository poRepository,
                               TankDeliveryRepository deliveryRepository, DipstickReadingRepository dipstickRepository,
                               InventoryService inventoryService) {
        this.tankRepository = tankRepository;
        this.poRepository = poRepository;
        this.deliveryRepository = deliveryRepository;
        this.dipstickRepository = dipstickRepository;
        this.inventoryService = inventoryService;
    }

    @GetMapping("/tanks")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<FuelTankEntity> listTanks(@RequestParam String stationId) {
        return "ALL".equalsIgnoreCase(stationId) ? tankRepository.findAll() : tankRepository.findByStationIdOrderByNameAsc(stationId);
    }

    @PostMapping("/tanks")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public FuelTankEntity createTank(@Valid @RequestBody CreateTankCommand cmd) {
        return tankRepository.save(FuelTankEntity.create(
            cmd.stationId(), cmd.name(), cmd.grade(), cmd.capacityLitres(), cmd.bookVolumeLitres(), cmd.unitCostFcfa()
        ));
    }

    @DeleteMapping("/tanks/{tankId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public void deleteTank(@PathVariable String tankId) {
        tankRepository.deleteById(tankId);
    }

    @GetMapping("/purchase-orders")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public List<PurchaseOrderEntity> listPurchaseOrders(@RequestParam String stationId) {
        return "ALL".equalsIgnoreCase(stationId) ? poRepository.findAll() : poRepository.findByStationIdOrderByCreatedAtDesc(stationId);
    }

    @PostMapping("/purchase-orders")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public PurchaseOrderEntity createPurchaseOrder(@Valid @RequestBody CreatePurchaseOrderCommand command) {
        return inventoryService.createPurchaseOrder(command);
    }

    @DeleteMapping("/purchase-orders/{poId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public void deletePurchaseOrder(@PathVariable String poId) {
        poRepository.deleteById(poId);
    }

    @GetMapping("/deliveries")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public List<TankDeliveryEntity> listDeliveries() {
        return deliveryRepository.findTop50ByOrderByReceivedAtDesc();
    }

    @PostMapping("/deliveries")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public FuelTankEntity receiveDelivery(@Valid @RequestBody ReceiveDeliveryCommand command) {
        return inventoryService.receiveDelivery(command);
    }

    @DeleteMapping("/deliveries/{deliveryId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public void deleteDelivery(@PathVariable String deliveryId) {
        deliveryRepository.deleteById(deliveryId);
    }

    @GetMapping("/dipsticks")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<DipstickReadingEntity> listDipsticks() {
        return dipstickRepository.findTop50ByOrderByRecordedAtDesc();
    }

    @PostMapping("/dipsticks")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT')")
    public FuelTankEntity recordDipstick(@Valid @RequestBody RecordDipstickCommand command) {
        return inventoryService.recordDipstick(command);
    }

    @DeleteMapping("/dipsticks/{dipstickId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public void deleteDipstick(@PathVariable String dipstickId) {
        dipstickRepository.deleteById(dipstickId);
    }
}
