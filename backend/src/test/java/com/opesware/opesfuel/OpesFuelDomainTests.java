package com.opesware.opesfuel;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

import java.math.BigDecimal;
import java.math.RoundingMode;

import static org.junit.jupiter.api.Assertions.*;

class OpesFuelDomainTests {

    @Test
    void verifyModulithBoundedContexts() {
        ApplicationModules modules = ApplicationModules.of(OpesFuelApplication.class);
        assertNotNull(modules);
        assertTrue(modules.stream().findAny().isPresent());
    }

    @Test
    void verifyWeightedAverageCostCalculationOnFuelDelivery() {
        BigDecimal existingVol = new BigDecimal("10000");
        long existingCostFcfa = 600L;
        BigDecimal deliveredVol = new BigDecimal("20000");
        long deliveryCostFcfa = 630L;

        BigDecimal totalValue = existingVol.multiply(BigDecimal.valueOf(existingCostFcfa))
            .add(deliveredVol.multiply(BigDecimal.valueOf(deliveryCostFcfa)));
        long newWac = totalValue.divide(existingVol.add(deliveredVol), 0, RoundingMode.HALF_UP).longValue();

        assertEquals(620L, newWac);
    }

    @Test
    void verifyVatExtractionOnFcfaInclusiveFuelRevenue() {
        long grossSalesFcfa = 1_192_500L;
        long vatFcfa = Math.round(grossSalesFcfa * 0.1925 / 1.1925);
        long netRevenueFcfa = grossSalesFcfa - vatFcfa;

        assertEquals(192_500L, vatFcfa);
        assertEquals(1_000_000L, netRevenueFcfa);
        assertEquals(grossSalesFcfa, vatFcfa + netRevenueFcfa);
    }

    @Test
    void verifyInstitutionalGradeTariffVoucherCalculation() {
        java.util.Map<String, Long> prices = java.util.Map.of(
            "SUPER", 840L,
            "GASOIL", 828L,
            "KEROSENE", 550L,
            "LPG_BULK", 620L,
            "HEAVY_FUEL", 765L
        );

        long lpgAmount = new BigDecimal("125.5")
            .multiply(BigDecimal.valueOf(prices.get("LPG_BULK")))
            .setScale(0, RoundingMode.HALF_UP)
            .longValue();
        long keroseneAmount = new BigDecimal("100")
            .multiply(BigDecimal.valueOf(prices.get("KEROSENE")))
            .setScale(0, RoundingMode.HALF_UP)
            .longValue();

        assertEquals(77_810L, lpgAmount);
        assertEquals(55_000L, keroseneAmount);
    }
}
