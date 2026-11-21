package com.opesware.opesfuel.forecourt;

import java.util.List;
import java.util.Optional;

public interface ForecourtQueryApi {

    Optional<Long> findPumpPriceByStationAndGrade(String stationId, String grade);

    long countPumpsForStations(List<String> stationIds);

    long countActiveShiftsForStations(List<String> stationIds);
}
