package com.opesware.opesfuel;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

import java.math.BigDecimal;
import java.math.RoundingMode;

import static org.junit.jupiter.api.Assertions.*;

class OpesFuelDomainTests {

    @Test
    void verifyModulithBoundedContextsStrictly() {
        ApplicationModules modules = ApplicationModules.of(OpesFuelApplication.class);
        assertNotNull(modules);
        assertTrue(modules.stream().findAny().isPresent());
        modules.verify();
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
    void verifyBigDecimalVatExtractionOnFcfaInclusiveFuelRevenue() {
        long grossSalesFcfa = 1_192_500L;
        BigDecimal vatRate = new BigDecimal("0.1925");
        long vatFcfa = BigDecimal.valueOf(grossSalesFcfa)
            .multiply(vatRate)
            .divide(BigDecimal.ONE.add(vatRate), 0, RoundingMode.HALF_UP)
            .longValue();
        long netRevenueFcfa = grossSalesFcfa - vatFcfa;

        assertEquals(192_500L, vatFcfa);
        assertEquals(1_000_000L, netRevenueFcfa);
        assertEquals(grossSalesFcfa, vatFcfa + netRevenueFcfa);
    }
}
