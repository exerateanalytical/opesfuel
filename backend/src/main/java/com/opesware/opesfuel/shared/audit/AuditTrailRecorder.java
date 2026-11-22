package com.opesware.opesfuel.shared.audit;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

@Component
public class AuditTrailRecorder {
    private final JdbcTemplate jdbcTemplate;

    public AuditTrailRecorder(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public String record(
        String tenantId,
        String stationId,
        String actorEmail,
        String actorRole,
        String action,
        String entityType,
        String entityId,
        String summary
    ) {
        String id = "aud_" + UUID.randomUUID().toString().substring(0, 12);
        jdbcTemplate.update(
            """
            INSERT INTO audit_logs (id, tenant_id, station_id, actor_email, actor_role, action, entity_type, entity_id, summary, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id,
            tenantId,
            stationId,
            actorEmail != null ? actorEmail : "system@opesfuel.com",
            actorRole != null ? actorRole : "SYSTEM",
            action,
            entityType,
            entityId,
            summary,
            Timestamp.from(Instant.now())
        );
        return id;
    }
}
