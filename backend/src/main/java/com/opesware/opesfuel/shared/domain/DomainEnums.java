package com.opesware.opesfuel.shared.domain;

import java.util.Arrays;
import java.util.stream.Collectors;

public final class DomainEnums {

    private DomainEnums() {}

    public enum FuelGrade {
        SUPER, GASOIL, KEROSENE, LPG_BULK, HEAVY_FUEL
    }

    public enum EmployeeRole {
        OWNER, MANAGER, ATTENDANT, ACCOUNTANT
    }

    public enum PaymentMethod {
        CASH, MOBILE_MONEY, CARD
    }

    public enum ExpenseCategory {
        UTILITIES, MAINTENANCE, GENERATOR_FUEL, SECURITY, SUPPLIES, SHRINKAGE, PAYROLL
    }

    public enum ExpensePaymentSource {
        CASH_SAFE, BANK
    }

    public enum TreasurySourceAccount {
        CASH_ON_HAND, MOBILE_MONEY_CLEARING
    }

    public enum SettlementMethod {
        BANK_TRANSFER, MOBILE_MONEY, CASH
    }

    public enum ShopCategory {
        LUBRICANT, LPG, SHOP
    }

    public enum FleetStatus {
        ACTIVE, HOLD
    }

    public enum PumpStatus {
        IDLE, ACTIVE_SHIFT, MAINTENANCE
    }

    public enum PurchaseOrderStatus {
        PENDING, RECEIVED, CANCELLED
    }

    public static <E extends Enum<E>> E parse(Class<E> enumClass, String raw, String fieldName) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required.");
        }
        String normalized = raw.trim().toUpperCase();
        try {
            return Enum.valueOf(enumClass, normalized);
        } catch (IllegalArgumentException ex) {
            String allowed = Arrays.stream(enumClass.getEnumConstants())
                .map(Enum::name)
                .collect(Collectors.joining(", "));
            throw new IllegalArgumentException("Invalid " + fieldName + " '" + raw + "'. Allowed values: [" + allowed + "]");
        }
    }
}
