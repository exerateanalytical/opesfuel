package com.opesware.opesfuel.shared.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public sealed interface DomainEvent permits
    DomainEvent.ShiftOpenedEvent,
    DomainEvent.ShiftClosedEvent,
    DomainEvent.FuelDeliveryRecordedEvent,
    DomainEvent.DipstickVarianceFlaggedEvent,
    DomainEvent.ExpenseRecordedEvent,
    DomainEvent.FleetVoucherRecordedEvent,
    DomainEvent.FleetAccountSettledEvent,
    DomainEvent.ShopSaleRecordedEvent,
    DomainEvent.TreasuryDepositedEvent,
    DomainEvent.FuelPriceUpdatedEvent,
    DomainEvent.StationInstitutionalSetupEvent {

    String eventId();
    String aggregateId();
    String stationId();
    Instant occurredAt();
    String summary();

    default String aggregateType() {
        return switch (this) {
            case ShiftOpenedEvent ignored -> "ForecourtShift";
            case ShiftClosedEvent ignored -> "ForecourtShift";
            case FuelDeliveryRecordedEvent ignored -> "Inventory";
            case DipstickVarianceFlaggedEvent ignored -> "Inventory";
            case ExpenseRecordedEvent ignored -> "Accounting";
            case FleetVoucherRecordedEvent ignored -> "FleetCredit";
            case FleetAccountSettledEvent ignored -> "FleetCredit";
            case ShopSaleRecordedEvent ignored -> "ShopPOS";
            case TreasuryDepositedEvent ignored -> "Treasury";
            case FuelPriceUpdatedEvent ignored -> "Station";
            case StationInstitutionalSetupEvent ignored -> "StationOnboarding";
        };
    }

    record ShiftOpenedEvent(
        String eventId,
        String aggregateId,
        String stationId,
        String pumpId,
        String attendantId,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Opened shift " + aggregateId + " on pump " + pumpId + ".";
        }
    }

    record ShiftClosedEvent(
        String eventId,
        String aggregateId,
        String stationId,
        String pumpId,
        String tankId,
        String attendantId,
        BigDecimal litresSold,
        long expectedRevenueFcfa,
        long cashFcfa,
        long mobileMoneyFcfa,
        long cardFcfa,
        long fleetCreditFcfa,
        long varianceFcfa,
        long unitCostFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        public static ShiftClosedEvent create(
            String shiftId, String stationId, String pumpId, String tankId, String attendantId,
            BigDecimal litresSold, long expectedRevenueFcfa, long cashFcfa, long mobileMoneyFcfa,
            long cardFcfa, long fleetCreditFcfa, long varianceFcfa, long unitCostFcfa
        ) {
            return new ShiftClosedEvent(
                UUID.randomUUID().toString(), shiftId, stationId, pumpId, tankId, attendantId,
                litresSold, expectedRevenueFcfa, cashFcfa, mobileMoneyFcfa, cardFcfa,
                fleetCreditFcfa, varianceFcfa, unitCostFcfa, Instant.now()
            );
        }

        @Override
        public String summary() {
            return "Shift " + aggregateId + " closed: " + litresSold + " L sold, "
                + expectedRevenueFcfa + " FCFA expected (variance " + varianceFcfa + " FCFA).";
        }
    }

    record FuelDeliveryRecordedEvent(
        String eventId,
        String aggregateId,
        String stationId,
        String tankId,
        String supplierName,
        BigDecimal bolLitres,
        BigDecimal actualReceivedLitres,
        long totalInvoiceFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Delivery " + aggregateId + " from " + supplierName + ": "
                + actualReceivedLitres + " L received (" + totalInvoiceFcfa + " FCFA).";
        }
    }

    record DipstickVarianceFlaggedEvent(
        String eventId,
        String aggregateId,
        String stationId,
        String tankId,
        BigDecimal bookLitres,
        BigDecimal measuredLitres,
        BigDecimal varianceLitres,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Dipstick alert on tank " + tankId + ": variance " + varianceLitres + " L.";
        }
    }

    record ExpenseRecordedEvent(
        String eventId,
        String aggregateId,
        String stationId,
        String category,
        String description,
        long amountFcfa,
        String paymentSource,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Expense " + category + ": " + amountFcfa + " FCFA (" + description + ").";
        }
    }

    record FleetVoucherRecordedEvent(
        String eventId,
        String aggregateId,
        String stationId,
        String companyName,
        String vehiclePlate,
        BigDecimal litres,
        long amountFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Fleet voucher " + vehiclePlate + " (" + companyName + "): " + amountFcfa + " FCFA.";
        }
    }

    record FleetAccountSettledEvent(
        String eventId,
        String aggregateId,
        String stationId,
        String companyName,
        long amountFcfa,
        String method,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Fleet settlement from " + companyName + ": " + amountFcfa + " FCFA via " + method + ".";
        }
    }

    record ShopSaleRecordedEvent(
        String eventId,
        String aggregateId,
        String stationId,
        String itemName,
        int quantity,
        long grossFcfa,
        long cogsFcfa,
        String paymentMethod,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Shop sale: " + quantity + "x " + itemName + " (" + grossFcfa + " FCFA via " + paymentMethod + ").";
        }
    }

    record TreasuryDepositedEvent(
        String eventId,
        String aggregateId,
        String stationId,
        String sourceAccount,
        String bankName,
        long amountFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Deposited " + amountFcfa + " FCFA from " + sourceAccount + " to " + bankName + ".";
        }
    }

    record FuelPriceUpdatedEvent(
        String eventId,
        String aggregateId,
        String stationId,
        String grade,
        long pricePerLitreFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Price update for " + grade + ": " + pricePerLitreFcfa + " FCFA/L.";
        }
    }

    record ProvisionedFuelSpec(
        String tankId,
        String grade,
        String tankName,
        BigDecimal capacityLitres,
        BigDecimal openingLitres,
        long unitCostFcfa,
        long sellingPriceFcfa,
        int nozzleCount
    ) {}

    record StationInstitutionalSetupEvent(
        String eventId,
        String aggregateId,
        String stationId,
        java.util.List<ProvisionedFuelSpec> items,
        long openingInventoryAssetFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Institutional fuel & volume setup synchronized " + items.size()
                + " fuel lines (opening capital " + openingInventoryAssetFcfa + " FCFA).";
        }
    }
}
