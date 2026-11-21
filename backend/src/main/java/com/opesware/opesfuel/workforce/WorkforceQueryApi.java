package com.opesware.opesfuel.workforce;

import java.util.Optional;

public interface WorkforceQueryApi {

    record EmployeeSnapshot(
        String id,
        String stationId,
        String fullName,
        String role,
        String auth0Sub
    ) {}

    Optional<EmployeeSnapshot> findEmployee(String employeeId);

    Optional<EmployeeSnapshot> findByAuth0Sub(String auth0Sub);

    void linkAuth0Sub(String employeeId, String auth0Sub);
}
