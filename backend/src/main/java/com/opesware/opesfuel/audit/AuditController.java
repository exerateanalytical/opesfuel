package com.opesware.opesfuel.audit;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

record RecordAuditCommand(
    String stationId,
    @NotBlank String action,
    @NotBlank String entityType,
    @NotBlank String entityId,
    @NotBlank String summary
) {}

@RestController
@RequestMapping("/api/v1/audit")
public class AuditController {
    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder recorder;

    public AuditController(JdbcTemplate jdbcTemplate, TenantAccessGuard accessGuard, AuditTrailRecorder recorder) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.recorder = recorder;
    }

    @GetMapping("/logs")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_platform:admin')")
    public List<Map<String, Object>> listLogs(
        @RequestParam(required = false) String stationId,
        @RequestParam(required = false) String entityType,
        @RequestParam(defaultValue = "100") int limit
    ) {
        String tenantId = accessGuard.currentTenantId();
        int safeLimit = Math.max(1, Math.min(limit, 500));
        StringBuilder sql = new StringBuilder(
            """
            SELECT id, tenant_id, station_id, actor_email, actor_role, action, entity_type, entity_id, summary, created_at
            FROM audit_logs
            WHERE tenant_id = ?
            """
        );
        List<Object> params = new ArrayList<>();
        params.add(tenantId);
        if (stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId)) {
            sql.append(" AND (station_id = ? OR station_id IS NULL) ");
            params.add(stationId);
        }
        if (entityType != null && !entityType.isBlank() && !"ALL".equalsIgnoreCase(entityType)) {
            sql.append(" AND entity_type = ? ");
            params.add(entityType.toUpperCase());
        }
        sql.append(" ORDER BY created_at DESC LIMIT ?");
        params.add(safeLimit);

        return jdbcTemplate.query(
            sql.toString(),
            (rs, rowNum) -> Map.of(
                "id", rs.getString("id"),
                "stationId", rs.getString("station_id") != null ? rs.getString("station_id") : "",
                "actorEmail", rs.getString("actor_email"),
                "actorRole", rs.getString("actor_role"),
                "action", rs.getString("action"),
                "entityType", rs.getString("entity_type"),
                "entityId", rs.getString("entity_id"),
                "summary", rs.getString("summary"),
                "createdAt", rs.getTimestamp("created_at").toInstant().toString()
            ),
            params.toArray()
        );
    }

    @PostMapping("/logs")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> recordLog(@Valid @RequestBody RecordAuditCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String role = principal.roles().stream().findFirst().orElse("USER");
        String id = recorder.record(
            principal.tenantId(),
            cmd.stationId(),
            principal.subject(),
            role,
            cmd.action().trim().toUpperCase(),
            cmd.entityType().trim().toUpperCase(),
            cmd.entityId().trim(),
            cmd.summary().trim()
        );
        return Map.of("id", id, "recorded", true);
    }
}
