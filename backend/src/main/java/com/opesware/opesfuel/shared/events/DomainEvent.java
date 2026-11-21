package com.opesware.opesfuel.shared.events;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public sealed interface DomainEvent permits
    DomainEvent.ShiftOpenedEvent,
    DomainEvent.ShiftClosedEvent,
    DomainEvent.ShiftVoidedEvent,
    DomainEvent.FuelDeliveryRecordedEvent,
    DomainEvent.FuelDeliveryVoidedEvent,
    DomainEvent.DipstickVarianceFlaggedEvent,
    DomainEvent.TankShrinkageReconciledEvent,
    DomainEvent.ExpenseRecordedEvent,
    DomainEvent.ExpenseVoidedEvent,
    DomainEvent.FleetVoucherRecordedEvent,
    DomainEvent.FleetAccountSettledEvent,
    DomainEvent.ShopSaleRecordedEvent,
    DomainEvent.ShopItemRestockedEvent,
    DomainEvent.TreasuryDepositedEvent,
    DomainEvent.TreasuryDepositVoidedEvent,
    DomainEvent.FuelPriceUpdatedEvent,
    DomainEvent.StationInstitutionalSetupEvent,
    DomainEvent.TanksProvisionedEvent,
    DomainEvent.SupplierApPaidEvent,
    DomainEvent.VatRemittedEvent,
    DomainEvent.PayrollDisbursedEvent,
    DomainEvent.StaffInvitedEvent,
    DomainEvent.DemoLeadCapturedEvent {

    String eventId();
    String aggregateId();
    String tenantId();
    String stationId();
    Instant occurredAt();
    String summary();

    default String aggregateType() {
        return switch (this) {
            case ShiftOpenedEvent ignored -> "ForecourtShift";
            case ShiftClosedEvent ignored -> "ForecourtShift";
            case ShiftVoidedEvent ignored -> "ForecourtShift";
            case FuelDeliveryRecordedEvent ignored -> "Inventory";
            case FuelDeliveryVoidedEvent ignored -> "Inventory";
            case DipstickVarianceFlaggedEvent ignored -> "Inventory";
            case TankShrinkageReconciledEvent ignored -> "Inventory";
            case ExpenseRecordedEvent ignored -> "Accounting";
            case ExpenseVoidedEvent ignored -> "Accounting";
            case FleetVoucherRecordedEvent ignored -> "FleetCredit";
            case FleetAccountSettledEvent ignored -> "FleetCredit";
            case ShopSaleRecordedEvent ignored -> "ShopPOS";
            case ShopItemRestockedEvent ignored -> "ShopPOS";
            case TreasuryDepositedEvent ignored -> "Treasury";
            case TreasuryDepositVoidedEvent ignored -> "Treasury";
            case FuelPriceUpdatedEvent ignored -> "Station";
            case StationInstitutionalSetupEvent ignored -> "StationOnboarding";
            case TanksProvisionedEvent ignored -> "StationOnboarding";
            case SupplierApPaidEvent ignored -> "Accounting";
            case VatRemittedEvent ignored -> "Accounting";
            case PayrollDisbursedEvent ignored -> "Workforce";
            case StaffInvitedEvent ignored -> "Identity";
            case DemoLeadCapturedEvent ignored -> "LeadIntake";
        };
    }

    record ShiftOpenedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
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
        String tenantId,
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
            String shiftId, String tenantId, String stationId, String pumpId, String tankId, String attendantId,
            BigDecimal litresSold, long expectedRevenueFcfa, long cashFcfa, long mobileMoneyFcfa,
            long cardFcfa, long fleetCreditFcfa, long varianceFcfa, long unitCostFcfa
        ) {
            return new ShiftClosedEvent(
                UUID.randomUUID().toString(), shiftId, tenantId, stationId, pumpId, tankId, attendantId,
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

    record ShiftVoidedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String pumpId,
        String tankId,
        String attendantId,
        BigDecimal litresSold,
        long varianceFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Voided shift " + aggregateId + " (reversing " + litresSold + " L and variance " + varianceFcfa + " FCFA).";
        }
    }

    record FuelDeliveryRecordedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
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

    record FuelDeliveryVoidedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String tankId,
        BigDecimal reversedLitres,
        long totalInvoiceFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Voided delivery " + aggregateId + ": reversed " + reversedLitres + " L (" + totalInvoiceFcfa + " FCFA).";
        }
    }

    record DipstickVarianceFlaggedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
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

    record TankShrinkageReconciledEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String tankId,
        BigDecimal varianceLitres,
        long adjustmentValueFcfa,
        String reason,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Reconciled tank " + tankId + " variance " + varianceLitres + " L (" + adjustmentValueFcfa + " FCFA).";
        }
    }

    record ExpenseRecordedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
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

    record ExpenseVoidedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String category,
        long amountFcfa,
        String paymentSource,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Voided expense " + aggregateId + " (" + amountFcfa + " FCFA).";
        }
    }

    record FleetVoucherRecordedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String companyName,
        String vehiclePlate,
        BigDecimal litres,
        long amountFcfa,
        boolean standaloneSale,
        long cogsFcfa,
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
        String tenantId,
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
        String tenantId,
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

    record ShopItemRestockedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String sku,
        String itemName,
        int quantity,
        long totalCostFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Restocked " + quantity + "x " + itemName + " (" + totalCostFcfa + " FCFA).";
        }
    }

    record TreasuryDepositedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
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

    record TreasuryDepositVoidedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String sourceAccount,
        long amountFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Voided treasury deposit " + aggregateId + " (" + amountFcfa + " FCFA).";
        }
    }

    record FuelPriceUpdatedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
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

    record StarterLubricantsPack(
        boolean includeLubricants,
        int oilBottlesQty,
        int lpgCylindersQty
    ) {}

    record StationInstitutionalSetupEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        List<ProvisionedFuelSpec> items,
        StarterLubricantsPack lubricantsPack,
        long openingInventoryAssetFcfa,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Institutional fuel & volume setup synchronized " + items.size()
                + " fuel lines (opening capital " + openingInventoryAssetFcfa + " FCFA).";
        }
    }

    record TanksProvisionedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        List<ProvisionedFuelSpec> items,
        StarterLubricantsPack lubricantsPack,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Provisioned " + items.size() + " underground fuel tanks for station " + stationId + ".";
        }
    }

    record SupplierApPaidEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String supplierName,
        String reference,
        long amountFcfa,
        String paymentSource,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Paid supplier " + supplierName + ": " + amountFcfa + " FCFA via " + paymentSource + ".";
        }
    }

    record VatRemittedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String periodLabel,
        String reference,
        long amountFcfa,
        String paymentSource,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Remitted VAT for " + periodLabel + ": " + amountFcfa + " FCFA.";
        }
    }

    record PayrollDisbursedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String periodLabel,
        long totalNetPaidFcfa,
        String paymentSource,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Disbursed payroll (" + periodLabel + "): " + totalNetPaidFcfa + " FCFA.";
        }
    }

    record StaffInvitedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String email,
        String role,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "Invited " + email + " as " + role + " for station " + stationId + ".";
        }
    }

    record DemoLeadCapturedEvent(
        String eventId,
        String aggregateId,
        String tenantId,
        String stationId,
        String fullName,
        String stationName,
        String email,
        int pumpCount,
        Instant occurredAt
    ) implements DomainEvent {
        @Override
        public String summary() {
            return "New demo lead from " + fullName + " (" + stationName + ", " + pumpCount + " pumps).";
        }
    }
}
