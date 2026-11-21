package com.opesware.opesfuel.station;

import java.util.List;
import java.util.Optional;

public interface StationCatalogApi {

    record StationSnapshot(
        String id,
        String tenantId,
        String code,
        String name,
        String city,
        String planName,
        long monthlyFeeFcfa
    ) {}

    StationSnapshot requireAccessibleStation(String stationId);

    List<String> resolveAuthorizedStationIds(String requestedStationId);

    List<StationSnapshot> listAccessibleStationSnapshots();

    Optional<Long> findLatestFuelPrice(String stationId, String grade);

    boolean isEnterprisePlan(String stationId);
}
