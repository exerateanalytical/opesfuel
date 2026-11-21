package com.opesware.opesfuel.forecourt;

import com.opesware.opesfuel.shared.events.DomainEvent.FleetAccountSettledEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.FleetVoucherRecordedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ShopSaleRecordedEvent;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
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

@Entity
@Table(name = "fleet_accounts")
class FleetAccountEntity {
    @Id
    private String id;
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

    public static FleetAccountEntity create(String companyName, String taxId, long creditLimitFcfa) {
        FleetAccountEntity f = new FleetAccountEntity();
        f.id = "flt_" + UUID.randomUUID().toString().substring(0, 8);
        f.companyName = companyName.trim();
        f.taxId = taxId.trim().toUpperCase();
        f.creditLimitFcfa = creditLimitFcfa;
        f.balanceOwedFcfa = 0L;
        f.status = "ACTIVE";
        return f;
    }

    public void charge(long amountFcfa) {
        if (this.balanceOwedFcfa + amountFcfa > this.creditLimitFcfa) {
            throw new IllegalStateException("Credit limit exceeded for " + this.companyName);
        }
        this.balanceOwedFcfa += amountFcfa;
    }

    public void settle(long amountFcfa) {
        if (amountFcfa <= 0 || amountFcfa > this.balanceOwedFcfa) {
            throw new IllegalArgumentException("Invalid settlement amount");
        }
        this.balanceOwedFcfa -= amountFcfa;
    }

    public String getId() { return id; }
    public String getCompanyName() { return companyName; }
    public String getTaxId() { return taxId; }
    public long getCreditLimitFcfa() { return creditLimitFcfa; }
    public long getBalanceOwedFcfa() { return balanceOwedFcfa; }
    public String getStatus() { return status; }
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
        tx.id = "ftx_" + UUID.randomUUID().toString().substring(0, 8);
        tx.accountId = accountId;
        tx.stationId = stationId;
        tx.vehiclePlate = vehiclePlate.toUpperCase();
        tx.driverName = driverName;
        tx.grade = grade.toUpperCase();
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

@Entity
@Table(name = "shop_items")
class ShopItemEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(nullable = false)
    private String sku;
    @Column(nullable = false)
    private String name;
    @Column(nullable = false)
    private String category;
    @Column(name = "stock_qty", nullable = false)
    private int stockQty;
    @Column(name = "reorder_level", nullable = false)
    private int reorderLevel;
    @Column(name = "unit_price_fcfa", nullable = false)
    private long unitPriceFcfa;

    public static ShopItemEntity create(String stationId, String sku, String name, String category, int stockQty, int reorderLevel, long unitPriceFcfa) {
        ShopItemEntity item = new ShopItemEntity();
        item.id = "sku_" + UUID.randomUUID().toString().substring(0, 8);
        item.stationId = stationId;
        item.sku = sku.trim().toUpperCase();
        item.name = name.trim();
        item.category = category.trim().toUpperCase();
        item.stockQty = stockQty;
        item.reorderLevel = reorderLevel;
        item.unitPriceFcfa = unitPriceFcfa;
        return item;
    }

    public void sell(int quantity) {
        if (quantity <= 0 || quantity > this.stockQty) {
            throw new IllegalStateException("Insufficient stock for SKU " + this.sku);
        }
        this.stockQty -= quantity;
    }

    public void restock(int quantity) {
        if (quantity <= 0) throw new IllegalArgumentException("Restock quantity must be positive");
        this.stockQty += quantity;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getSku() { return sku; }
    public String getName() { return name; }
    public String getCategory() { return category; }
    public int getStockQty() { return stockQty; }
    public int getReorderLevel() { return reorderLevel; }
    public long getUnitPriceFcfa() { return unitPriceFcfa; }
}

interface FleetAccountRepository extends JpaRepository<FleetAccountEntity, String> {}
interface FleetTransactionRepository extends JpaRepository<FleetTransactionEntity, String> {
    List<FleetTransactionEntity> findTop50ByOrderByCreatedAtDesc();
}
interface ShopItemRepository extends JpaRepository<ShopItemEntity, String> {
    List<ShopItemEntity> findByStationIdOrderByNameAsc(String stationId);
}

@Service
class FleetAndShopService {
    private static final Map<String, Long> INSTITUTIONAL_DEFAULT_PRICES = Map.of(
        "SUPER", 840L,
        "GASOIL", 828L,
        "KEROSENE", 550L,
        "LPG_BULK", 620L,
        "HEAVY_FUEL", 765L
    );

    private final FleetAccountRepository fleetRepo;
    private final FleetTransactionRepository txRepo;
    private final ShopItemRepository shopRepo;
    private final PumpRepository pumpRepo;
    private final JdbcTemplate jdbcTemplate;
    private final ApplicationEventPublisher eventPublisher;

    FleetAndShopService(FleetAccountRepository fleetRepo, FleetTransactionRepository txRepo, ShopItemRepository shopRepo,
                        PumpRepository pumpRepo, JdbcTemplate jdbcTemplate, ApplicationEventPublisher eventPublisher) {
        this.fleetRepo = fleetRepo;
        this.txRepo = txRepo;
        this.shopRepo = shopRepo;
        this.pumpRepo = pumpRepo;
        this.jdbcTemplate = jdbcTemplate;
        this.eventPublisher = eventPublisher;
    }

    private long resolveFuelUnitPrice(String stationId, String grade) {
        String normalizedGrade = grade.trim().toUpperCase();
        List<Long> configured = jdbcTemplate.queryForList(
            "SELECT price_per_litre_fcfa FROM fuel_prices WHERE station_id = ? AND grade = ? ORDER BY effective_at DESC LIMIT 1",
            Long.class,
            stationId,
            normalizedGrade
        );
        if (!configured.isEmpty() && configured.get(0) != null && configured.get(0) > 0) {
            return configured.get(0);
        }
        List<PumpEntity> pumps = pumpRepo.findByStationIdAndGrade(stationId, normalizedGrade);
        if (!pumps.isEmpty() && pumps.get(0).getUnitPriceFcfa() > 0) {
            return pumps.get(0).getUnitPriceFcfa();
        }
        return INSTITUTIONAL_DEFAULT_PRICES.getOrDefault(normalizedGrade, 840L);
    }

    @Transactional
    public FleetTransactionEntity recordVoucher(RecordFleetVoucherCommand cmd) {
        FleetAccountEntity acc = fleetRepo.findById(cmd.accountId())
            .orElseThrow(() -> new IllegalArgumentException("Fleet account not found"));
        long unitPrice = resolveFuelUnitPrice(cmd.stationId(), cmd.grade());
        long amountFcfa = cmd.litres().multiply(BigDecimal.valueOf(unitPrice)).setScale(0, RoundingMode.HALF_UP).longValue();
        acc.charge(amountFcfa);
        fleetRepo.save(acc);
        FleetTransactionEntity tx = txRepo.save(FleetTransactionEntity.create(
            acc.getId(), cmd.stationId(), cmd.vehiclePlate(), cmd.driverName(), cmd.grade(), cmd.litres(), amountFcfa
        ));
        eventPublisher.publishEvent(new FleetVoucherRecordedEvent(
            UUID.randomUUID().toString(), tx.getId(), cmd.stationId(), acc.getCompanyName(),
            tx.getVehiclePlate(), tx.getLitres(), tx.getAmountFcfa(), tx.getCreatedAt()
        ));
        return tx;
    }

    @Transactional
    public FleetAccountEntity settleAccount(String accountId, SettleFleetCommand cmd) {
        FleetAccountEntity acc = fleetRepo.findById(accountId)
            .orElseThrow(() -> new IllegalArgumentException("Fleet account not found"));
        acc.settle(cmd.amountFcfa());
        fleetRepo.save(acc);
        eventPublisher.publishEvent(new FleetAccountSettledEvent(
            UUID.randomUUID().toString(),
            acc.getId(),
            cmd.stationId() != null ? cmd.stationId() : "st_plateau",
            acc.getCompanyName(),
            cmd.amountFcfa(),
            cmd.method(),
            Instant.now()
        ));
        return acc;
    }

    @Transactional
    public ShopItemEntity recordShopSale(RecordShopSaleCommand cmd) {
        ShopItemEntity item = shopRepo.findById(cmd.itemId())
            .orElseThrow(() -> new IllegalArgumentException("Shop item not found"));
        item.sell(cmd.quantity());
        ShopItemEntity saved = shopRepo.save(item);
        long grossFcfa = saved.getUnitPriceFcfa() * cmd.quantity();
        long cogsFcfa = Math.round(grossFcfa * 0.72);
        eventPublisher.publishEvent(new ShopSaleRecordedEvent(
            UUID.randomUUID().toString(), saved.getId(), saved.getStationId(),
            saved.getName(), cmd.quantity(), grossFcfa, cogsFcfa, cmd.paymentMethod(), Instant.now()
        ));
        return saved;
    }

    @Transactional
    public ShopItemEntity restockItem(String itemId, int quantity) {
        ShopItemEntity item = shopRepo.findById(itemId)
            .orElseThrow(() -> new IllegalArgumentException("Shop item not found"));
        item.restock(quantity);
        return shopRepo.save(item);
    }
}

record CreateFleetAccountCommand(@NotBlank String companyName, @NotBlank String taxId, @Positive long creditLimitFcfa) {}
record CreateShopItemCommand(
    @NotBlank String stationId,
    @NotBlank String sku,
    @NotBlank String name,
    @NotBlank String category,
    @Min(0) int stockQty,
    @Min(0) int reorderLevel,
    @Positive long unitPriceFcfa
) {}

record RecordFleetVoucherCommand(
    @NotBlank String accountId,
    @NotBlank String stationId,
    @NotBlank String vehiclePlate,
    @NotBlank String driverName,
    @NotBlank String grade,
    @Positive BigDecimal litres
) {}

record SettleFleetCommand(String stationId, @Positive long amountFcfa, @NotBlank String method) {}
record RecordShopSaleCommand(@NotBlank String itemId, @Min(1) int quantity, @NotBlank String paymentMethod) {}
record RestockShopItemCommand(@Min(1) int quantity) {}

@RestController
@RequestMapping("/api/v1")
public class FleetAndShopController {
    private final FleetAccountRepository fleetRepo;
    private final FleetTransactionRepository txRepo;
    private final ShopItemRepository shopRepo;
    private final FleetAndShopService service;

    public FleetAndShopController(FleetAccountRepository fleetRepo, FleetTransactionRepository txRepo, ShopItemRepository shopRepo, FleetAndShopService service) {
        this.fleetRepo = fleetRepo;
        this.txRepo = txRepo;
        this.shopRepo = shopRepo;
        this.service = service;
    }

    @GetMapping("/fleet/accounts")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<FleetAccountEntity> listFleetAccounts() {
        return fleetRepo.findAll();
    }

    @PostMapping("/fleet/accounts")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public FleetAccountEntity createFleetAccount(@Valid @RequestBody CreateFleetAccountCommand cmd) {
        return fleetRepo.save(FleetAccountEntity.create(cmd.companyName(), cmd.taxId(), cmd.creditLimitFcfa()));
    }

    @DeleteMapping("/fleet/accounts/{accountId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public void deleteFleetAccount(@PathVariable String accountId) {
        fleetRepo.deleteById(accountId);
    }

    @GetMapping("/fleet/vouchers")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<FleetTransactionEntity> listFleetVouchers() {
        return txRepo.findTop50ByOrderByCreatedAtDesc();
    }

    @PostMapping("/fleet/vouchers")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT')")
    public FleetTransactionEntity recordVoucher(@Valid @RequestBody RecordFleetVoucherCommand cmd) {
        return service.recordVoucher(cmd);
    }

    @PostMapping("/fleet/accounts/{accountId}/settle")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public FleetAccountEntity settleAccount(@PathVariable String accountId, @Valid @RequestBody SettleFleetCommand cmd) {
        return service.settleAccount(accountId, cmd);
    }

    @GetMapping("/shop/items")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<ShopItemEntity> listShopItems(@RequestParam String stationId) {
        return "ALL".equalsIgnoreCase(stationId) ? shopRepo.findAll() : shopRepo.findByStationIdOrderByNameAsc(stationId);
    }

    @PostMapping("/shop/items")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public ShopItemEntity createShopItem(@Valid @RequestBody CreateShopItemCommand cmd) {
        return shopRepo.save(ShopItemEntity.create(
            cmd.stationId(), cmd.sku(), cmd.name(), cmd.category(), cmd.stockQty(), cmd.reorderLevel(), cmd.unitPriceFcfa()
        ));
    }

    @DeleteMapping("/shop/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public void deleteShopItem(@PathVariable String itemId) {
        shopRepo.deleteById(itemId);
    }

    @PostMapping("/shop/sales")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT')")
    public ShopItemEntity recordShopSale(@Valid @RequestBody RecordShopSaleCommand cmd) {
        return service.recordShopSale(cmd);
    }

    @PostMapping("/shop/items/{itemId}/restock")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public ShopItemEntity restockItem(@PathVariable String itemId, @Valid @RequestBody RestockShopItemCommand cmd) {
        return service.restockItem(itemId, cmd.quantity());
    }
}
