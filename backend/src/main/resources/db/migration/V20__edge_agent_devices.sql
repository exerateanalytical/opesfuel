-- V20: On-site Edge Agent registry (per-site API key, hashed) and heartbeat telemetry

CREATE TABLE IF NOT EXISTS edge_devices (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    device_name VARCHAR(160) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,
    key_hash VARCHAR(128) NOT NULL UNIQUE,
    agent_version VARCHAR(40),
    hostname VARCHAR(160),
    drivers_csv VARCHAR(300) DEFAULT '',
    outbox_depth INT NOT NULL DEFAULT 0,
    last_ip VARCHAR(64),
    last_heartbeat_at TIMESTAMP,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_edge_devices_tenant ON edge_devices (tenant_id, station_id);
