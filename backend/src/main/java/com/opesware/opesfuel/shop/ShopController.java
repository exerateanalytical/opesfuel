package com.opesware.opesfuel.shop;

import com.opesware.opesfuel.shared.domain.DomainEnums;
import com.opesware.opesfuel.shared.domain.DomainEnums.PaymentMethod;
import com.opesware.opesfuel.shared.domain.DomainEnums.ShopCategory;
import com.opesware.opesfuel.shared.events.DomainEvent.ShopItemRestockedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ShopSaleRecordedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.StarterLubricantsPack;
import com.opesware.opesfuel.shared.events.DomainEvent.TanksProvisionedEvent;
import com.opesware.opesfuel.station.StationCatalogApi;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
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

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

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
    @Column(name = "unit_cost_fcfa", nullable = false)
    private long unitCostFcfa;
    @Version
    private long version;

    public static ShopItemEntity create(
        String stationId, String sku, String name, String category,
        int stockQty, int reorderLevel, long unitPriceFcfa, Long unitCostFcfa
    ) {
        ShopCategory validatedCategory = DomainEnums.parse(ShopCategory.class, category, "category");
        ShopItemEntity item = new ShopItemEntity();
        item.id = "sku_" + UUID.randomUUID();
        item.stationId = stationId;
        item.sku = sku.trim().toUpperCase();
        item.name = name.trim();
        item.category = validatedCategory.name();
        item.stockQty = stockQty;
        item.reorderLevel = reorderLevel;
        item.unitPriceFcfa = unitPriceFcfa;
        item.unitCostFcfa = (unitCostFcfa != null && unitCostFcfa >= 0) ? unitCostFcfa : Math.round(unitPriceFcfa * 0.72);
        return item;
    }

    public void sell(int quantity) {
        if (quantity <= 0 || quantity > this.stockQty) {
            throw new IllegalStateException("Insufficient stock for SKU " + this.sku);
        }
        this.stockQty -= quantity;
    }

    public long restock(int quantity, Long incomingUnitCostFcfa) {
        if (quantity <= 0) throw new IllegalArgumentException("Restock quantity must be positive");
        long effectiveCost = (incomingUnitCostFcfa != null && incomingUnitCostFcfa >= 0)
            ? incomingUnitCostFcfa
            : this.unitCostFcfa;
        long totalQty = (long) this.stockQty + quantity;
        if (totalQty > 0) {
            long existingVal = (long) this.stockQty * this.unitCostFcfa;
            long incomingVal = (long) quantity * effectiveCost;
            this.unitCostFcfa = Math.round((double) (existingVal + incomingVal) / totalQty);
        }
        this.stockQty += quantity;
        return (long) quantity * effectiveCost;
    }

    public void updateItem(String name, Integer reorderLevel, Long unitPriceFcfa, Long unitCostFcfa) {
        if (name != null && !name.isBlank()) this.name = name.trim();
        if (reorderLevel != null) {
            if (reorderLevel < 0) throw new IllegalArgumentException("reorderLevel must be >= 0");
            this.reorderLevel = reorderLevel;
        }
        if (unitPriceFcfa != null) {
            if (unitPriceFcfa <= 0) throw new IllegalArgumentException("unitPriceFcfa must be positive");
            this.unitPriceFcfa = unitPriceFcfa;
        }
        if (unitCostFcfa != null) {
            if (unitCostFcfa < 0) throw new IllegalArgumentException("unitCostFcfa must be >= 0");
            this.unitCostFcfa = unitCostFcfa;
        }
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getSku() { return sku; }
    public String getName() { return name; }
    public String getCategory() { return category; }
    public int getStockQty() { return stockQty; }
    public int getReorderLevel() { return reorderLevel; }
    public long getUnitPriceFcfa() { return unitPriceFcfa; }
    public long getUnitCostFcfa() { return unitCostFcfa; }
}

@Entity
@Table(name = "shop_sales")
class ShopSaleEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "item_id", nullable = false)
    private String itemId;
    @Column(nullable = false)
    private String sku;
    @Column(name = "item_name", nullable = false)
    private String itemName;
    @Column(nullable = false)
    private int quantity;
    @Column(name = "unit_price_fcfa", nullable = false)
    private long unitPriceFcfa;
    @Column(name = "unit_cost_fcfa", nullable = false)
    private long unitCostFcfa;
    @Column(name = "gross_fcfa", nullable = false)
    private long grossFcfa;
    @Column(name = "cogs_fcfa", nullable = false)
    private long cogsFcfa;
    @Column(name = "payment_method", nullable = false)
    private String paymentMethod;
    @Column(name = "sold_at", nullable = false)
    private Instant soldAt;

    public static ShopSaleEntity create(ShopItemEntity item, int quantity, long grossFcfa, long cogsFcfa, String paymentMethod) {
        ShopSaleEntity s = new ShopSaleEntity();
        s.id = "pos_" + UUID.randomUUID();
        s.stationId = item.getStationId();
        s.itemId = item.getId();
        s.sku = item.getSku();
        s.itemName = item.getName();
        s.quantity = quantity;
        s.unitPriceFcfa = item.getUnitPriceFcfa();
        s.unitCostFcfa = item.getUnitCostFcfa();
        s.grossFcfa = grossFcfa;
        s.cogsFcfa = cogsFcfa;
        s.paymentMethod = paymentMethod;
        s.soldAt = Instant.now();
        return s;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getItemId() { return itemId; }
    public String getSku() { return sku; }
    public String getItemName() { return itemName; }
    public int getQuantity() { return quantity; }
    public long getUnitPriceFcfa() { return unitPriceFcfa; }
    public long getUnitCostFcfa() { return unitCostFcfa; }
    public long getGrossFcfa() { return grossFcfa; }
    public long getCogsFcfa() { return cogsFcfa; }
    public String getPaymentMethod() { return paymentMethod; }
    public Instant getSoldAt() { return soldAt; }
}

interface ShopItemRepository extends JpaRepository<ShopItemEntity, String> {
    List<ShopItemEntity> findByStationIdInOrderByNameAsc(List<String> stationIds);
    Optional<ShopItemEntity> findFirstByStationIdAndSkuIgnoreCase(String stationId, String sku);
}

interface ShopSaleRepository extends JpaRepository<ShopSaleEntity, String> {
    List<ShopSaleEntity> findByStationIdInOrderBySoldAtDesc(List<String> stationIds, PageRequest pageable);
    boolean existsByItemId(String itemId);
}

@Service
class ShopService {
    private final ShopItemRepository shopRepo;
    private final ShopSaleRepository shopSaleRepo;
    private final StationCatalogApi stationCatalogApi;
    private final ApplicationEventPublisher eventPublisher;

    ShopService(
        ShopItemRepository shopRepo,
        ShopSaleRepository shopSaleRepo,
        StationCatalogApi stationCatalogApi,
        ApplicationEventPublisher eventPublisher
    ) {
        this.shopRepo = shopRepo;
        this.shopSaleRepo = shopSaleRepo;
        this.stationCatalogApi = stationCatalogApi;
        this.eventPublisher = eventPublisher;
    }

    @ApplicationModuleListener
    public void onTanksProvisioned(TanksProvisionedEvent event) {
        StarterLubricantsPack pack = event.lubricantsPack();
        if (pack == null || !pack.includeLubricants()) return;
        if (pack.oilBottlesQty() > 0) {
            upsertStarterSku(event.stationId(), "LUB-15W40-5L", "Heavy Duty Engine Oil 15W40 (5L)", "LUBRICANT", pack.oilBottlesQty(), 10, 18_500L, 13_200L);
        }
        if (pack.lpgCylindersQty() > 0) {
            upsertStarterSku(event.stationId(), "LPG-12KG", "Cooking Gas Cylinder Refill 12.5kg", "LPG", pack.lpgCylindersQty(), 12, 6_500L, 5_400L);
        }
    }

    private void upsertStarterSku(String stationId, String sku, String name, String category, int qty, int reorder, long price, long cost) {
        Optional<ShopItemEntity> existing = shopRepo.findFirstByStationIdAndSkuIgnoreCase(stationId, sku);
        if (existing.isPresent()) {
            ShopItemEntity item = existing.get();
            item.restock(qty, cost);
            shopRepo.save(item);
        } else {
            shopRepo.save(ShopItemEntity.create(stationId, sku, name, category, qty, reorder, price, cost));
        }
    }

    @Transactional(readOnly = true)
    public List<ShopItemEntity> listShopItems(String stationId) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return shopRepo.findByStationIdInOrderByNameAsc(stationIds);
    }

    @Transactional(readOnly = true)
    public List<ShopSaleEntity> listShopSales(String stationId, int limit) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return shopSaleRepo.findByStationIdInOrderBySoldAtDesc(stationIds, PageRequest.of(0, Math.max(1, Math.min(limit, 200))));
    }

    @Transactional
    public ShopItemEntity createShopItem(CreateShopItemCommand cmd) {
        stationCatalogApi.requireAccessibleStation(cmd.stationId());
        if (shopRepo.findFirstByStationIdAndSkuIgnoreCase(cmd.stationId(), cmd.sku().trim()).isPresent()) {
            throw new IllegalStateException("SKU already exists at this station: " + cmd.sku().trim().toUpperCase());
        }
        return shopRepo.save(ShopItemEntity.create(
            cmd.stationId(), cmd.sku(), cmd.name(), cmd.category(),
            cmd.stockQty(), cmd.reorderLevel(), cmd.unitPriceFcfa(), cmd.unitCostFcfa()
        ));
    }

    @Transactional
    public ShopItemEntity patchShopItem(String itemId, PatchShopItemCommand cmd) {
        ShopItemEntity item = shopRepo.findById(itemId)
            .orElseThrow(() -> new IllegalArgumentException("Shop item not found: " + itemId));
        stationCatalogApi.requireAccessibleStation(item.getStationId());
        item.updateItem(cmd.name(), cmd.reorderLevel(), cmd.unitPriceFcfa(), cmd.unitCostFcfa());
        return shopRepo.save(item);
    }

    @Transactional
    public void deleteShopItem(String itemId) {
        ShopItemEntity item = shopRepo.findById(itemId)
            .orElseThrow(() -> new IllegalArgumentException("Shop item not found: " + itemId));
        stationCatalogApi.requireAccessibleStation(item.getStationId());
        if (shopSaleRepo.existsByItemId(itemId)) {
            throw new IllegalStateException("Cannot delete shop SKU " + item.getSku() + " with recorded sales history.");
        }
        shopRepo.deleteById(itemId);
    }

    @Transactional
    public ShopItemEntity recordShopSale(RecordShopSaleCommand cmd) {
        PaymentMethod method = DomainEnums.parse(PaymentMethod.class, cmd.paymentMethod(), "paymentMethod");
        ShopItemEntity item = shopRepo.findById(cmd.itemId())
            .orElseThrow(() -> new IllegalArgumentException("Shop item not found: " + cmd.itemId()));
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(item.getStationId());

        item.sell(cmd.quantity());
        ShopItemEntity saved = shopRepo.save(item);
        long grossFcfa = Math.multiplyExact(saved.getUnitPriceFcfa(), (long) cmd.quantity());
        long cogsFcfa = Math.multiplyExact(saved.getUnitCostFcfa(), (long) cmd.quantity());
        ShopSaleEntity sale = shopSaleRepo.save(ShopSaleEntity.create(saved, cmd.quantity(), grossFcfa, cogsFcfa, method.name()));

        eventPublisher.publishEvent(new ShopSaleRecordedEvent(
            UUID.randomUUID().toString(), sale.getId(), station.tenantId(), saved.getStationId(),
            saved.getName(), cmd.quantity(), grossFcfa, cogsFcfa, method.name(), sale.getSoldAt()
        ));
        return saved;
    }

    @Transactional
    public ShopItemEntity restockItem(String itemId, RestockShopItemCommand cmd) {
        ShopItemEntity item = shopRepo.findById(itemId)
            .orElseThrow(() -> new IllegalArgumentException("Shop item not found: " + itemId));
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(item.getStationId());

        long totalCostFcfa = item.restock(cmd.quantity(), cmd.unitCostFcfa());
        ShopItemEntity saved = shopRepo.save(item);
        if (totalCostFcfa > 0) {
            eventPublisher.publishEvent(new ShopItemRestockedEvent(
                UUID.randomUUID().toString(), saved.getId(), station.tenantId(), saved.getStationId(),
                saved.getSku(), saved.getName(), cmd.quantity(), totalCostFcfa, Instant.now()
            ));
        }
        return saved;
    }
}

record CreateShopItemCommand(
    @NotBlank String stationId,
    @NotBlank String sku,
    @NotBlank String name,
    @NotBlank String category,
    @Min(0) int stockQty,
    @Min(0) int reorderLevel,
    @Positive long unitPriceFcfa,
    @PositiveOrZero Long unitCostFcfa
) {}
record PatchShopItemCommand(String name, Integer reorderLevel, Long unitPriceFcfa, Long unitCostFcfa) {}
record RecordShopSaleCommand(@NotBlank String itemId, @Min(1) int quantity, @NotBlank String paymentMethod) {}
record RestockShopItemCommand(@Min(1) int quantity, @PositiveOrZero Long unitCostFcfa) {}

@RestController
@RequestMapping("/api/v1/shop")
public class ShopController {
    private final ShopService service;

    public ShopController(ShopService service) {
        this.service = service;
    }

    @GetMapping("/items")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT','ACCOUNTANT') or hasAuthority('SCOPE_shop:read')")
    public List<ShopItemEntity> listShopItems(@RequestParam(required = false, defaultValue = "ALL") String stationId) {
        return service.listShopItems(stationId);
    }

    @GetMapping("/sales")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_shop:read')")
    public List<ShopSaleEntity> listShopSales(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return service.listShopSales(stationId, limit);
    }

    @PostMapping("/items")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_shop:write')")
    public ShopItemEntity createShopItem(@Valid @RequestBody CreateShopItemCommand cmd) {
        return service.createShopItem(cmd);
    }

    @PatchMapping("/items/{itemId}")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_shop:write')")
    public ShopItemEntity patchShopItem(@PathVariable String itemId, @RequestBody PatchShopItemCommand cmd) {
        return service.patchShopItem(itemId, cmd);
    }

    @DeleteMapping("/items/{itemId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_shop:write')")
    public void deleteShopItem(@PathVariable String itemId) {
        service.deleteShopItem(itemId);
    }

    @PostMapping("/sales")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ATTENDANT') or hasAuthority('SCOPE_shop:write')")
    public ShopItemEntity recordShopSale(@Valid @RequestBody RecordShopSaleCommand cmd) {
        return service.recordShopSale(cmd);
    }

    @PostMapping("/items/{itemId}/restock")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER') or hasAuthority('SCOPE_shop:write')")
    public ShopItemEntity restockItem(@PathVariable String itemId, @Valid @RequestBody RestockShopItemCommand cmd) {
        return service.restockItem(itemId, cmd);
    }
}
