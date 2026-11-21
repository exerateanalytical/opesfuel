package com.opesware.opesfuel.inventory;

import java.math.BigDecimal;
import java.util.Optional;

public interface InventoryQueryApi {

    record TankSnapshot(
        String id,
        String stationId,
        String name,
        String grade,
        BigDecimal capacityLitres,
        BigDecimal bookVolumeLitres,
        BigDecimal lastDipLitres,
        long unitCostFcfa
    ) {}

    Optional<TankSnapshot> findTank(String tankId);

    Optional<TankSnapshot> findPrimaryTankByStationAndGrade(String stationId, String grade);

    void deductStandaloneFuelSale(String tankId, BigDecimal litresSold);
}
