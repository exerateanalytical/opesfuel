-- V10: Sprint 3 — Hardware Edge Bridge (DOMS/PTS-2, Veeder-Root ATG, OCPP 2.0.1), Payroll 8-State Workflow & Mobile Offline Sync Deduplication

-- M44 & M53: Registered Site Hardware Edge Devices / Bridges
CREATE TABLE IF NOT EXISTS hardware_edge_devices (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    device_code VARCHAR(64) NOT NULL,
    protocol VARCHAR(40) NOT NULL, -- DOMS_PTS2, VEEDER_ROOT_ATG, OCPP_201_EV
    endpoint_uri VARCHAR(180) NOT NULL,
    firmware_version VARCHAR(48),
    status VARCHAR(24) NOT NULL DEFAULT 'ONLINE',
    last_heartbeat_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- M44 / T012: Deduplicated Hardware Telemetry Events (Pump TX, ATG Readings, OCPP EV Sessions)
CREATE TABLE IF NOT EXISTS hardware_telemetry_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    device_code VARCHAR(64) NOT NULL,
    protocol VARCHAR(40) NOT NULL,
    device_event_id VARCHAR(96) NOT NULL,
    summary VARCHAR(255) NOT NULL,
    alarm_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_hw_tenant_event UNIQUE (tenant_id, device_event_id)
);

-- M34: Strict 8-State Payroll Run Workflow (OPEN -> CALCULATED -> REVIEWED -> APPROVED -> POSTED -> PAYMENT_PENDING -> PAID -> CLOSED)
CREATE TABLE IF NOT EXISTS payroll_workflow_batches (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    period_label VARCHAR(16) NOT NULL,
    headcount INTEGER NOT NULL DEFAULT 0,
    gross_fcfa BIGINT NOT NULL DEFAULT 0,
    deductions_fcfa BIGINT NOT NULL DEFAULT 0,
    net_payable_fcfa BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    prepared_by VARCHAR(120) NOT NULL,
    approved_by VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- M45 / T014: Mobile Offline Sync Deduplication Log
CREATE TABLE IF NOT EXISTS mobile_offline_sync_log (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    client_op_id VARCHAR(96) NOT NULL,
    operation_type VARCHAR(48) NOT NULL,
    actor_sub VARCHAR(120) NOT NULL,
    payload_summary VARCHAR(255) NOT NULL,
    synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_mobile_sync_op UNIQUE (tenant_id, client_op_id)
);
