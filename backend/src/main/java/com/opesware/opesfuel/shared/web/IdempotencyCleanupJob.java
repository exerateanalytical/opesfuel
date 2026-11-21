package com.opesware.opesfuel.shared.web;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;

@Component
@ConditionalOnProperty(name = "opesfuel.idempotency.cleanup-enabled", havingValue = "true", matchIfMissing = true)
public class IdempotencyCleanupJob {

    private final JdbcTemplate jdbcTemplate;

    public IdempotencyCleanupJob(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Scheduled(fixedDelayString = "${opesfuel.idempotency.cleanup-interval-ms:3600000}")
    public void purgeExpiredKeys() {
        jdbcTemplate.update(
            "DELETE FROM idempotency_records WHERE expires_at < ?",
            Timestamp.from(Instant.now())
        );
    }
}
