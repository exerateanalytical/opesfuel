package com.opesware.opesfuel.station;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

record LogPriceChangeCommand(
    @NotBlank String grade,
    @Min(1) long oldPriceFcfa,
    @Min(1) long newPriceFcfa,
    String reason
) {}

@RestController
@RequestMapping("/api/v1/stations")
public class PriceHistoryController {
    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;

    public PriceHistoryController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping("/{stationId}/price-history")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_station:read')")
    public List<Map<String, Object>> listPriceHistory(@PathVariable String stationId) {
        String tenantId = accessGuard.currentTenantId();
        boolean all = "ALL".equalsIgnoreCase(stationId);
        String sql = all
            ? "SELECT * FROM fuel_price_history WHERE tenant_id = ? ORDER BY changed_at DESC LIMIT 100"
            : "SELECT * FROM fuel_price_history WHERE tenant_id = ? AND station_id = ? ORDER BY changed_at DESC LIMIT 100";
        Object[] args = all ? new Object[]{tenantId} : new Object[]{tenantId, stationId};
        return jdbcTemplate.query(sql, (rs, idx) -> Map.<String, Object>of(
            "id", rs.getString("id"),
            "stationId", rs.getString("station_id"),
            "grade", rs.getString("grade"),
            "oldPriceFcfa", rs.getLong("old_price_fcfa"),
            "newPriceFcfa", rs.getLong("new_price_fcfa"),
            "changedBy", rs.getString("changed_by"),
            "reason", rs.getString("reason") != null ? rs.getString("reason") : "",
            "changedAt", rs.getTimestamp("changed_at").toInstant().toString()
        ), args);
    }

    @PostMapping("/{stationId}/price-history")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER') or hasAuthority('SCOPE_station:write')")
    public Map<String, Object> recordPriceChange(
        @PathVariable String stationId,
        @Valid @RequestBody LogPriceChangeCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String id = "fph_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO fuel_price_history (id, tenant_id, station_id, grade, old_price_fcfa, new_price_fcfa, changed_by, reason, changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id, principal.tenantId(), stationId, cmd.grade().trim().toUpperCase(),
            cmd.oldPriceFcfa(), cmd.newPriceFcfa(), principal.subject(),
            cmd.reason() != null ? cmd.reason() : "Official pump tariff update",
            Timestamp.from(Instant.now())
        );
        auditRecorder.record(
            principal.tenantId(), stationId, principal.subject(),
            principal.roles().stream().findFirst().orElse("OWNER"),
            "FUEL_PRICE_UPDATED", "STATION", stationId,
            "Changed " + cmd.grade().toUpperCase() + " tariff from " + cmd.oldPriceFcfa() + " to " + cmd.newPriceFcfa() + " FCFA/L"
        );
        return Map.of("id", id, "grade", cmd.grade().toUpperCase(), "newPriceFcfa", cmd.newPriceFcfa());
    }
}
