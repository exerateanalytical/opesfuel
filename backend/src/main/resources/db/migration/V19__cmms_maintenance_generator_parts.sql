-- V19: Station CMMS Work Orders, Preventive Schedules, Standby Generator Logs & Spare Parts

CREATE TABLE IF NOT EXISTS cmms_work_orders (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    asset_id VARCHAR(64),
    asset_name VARCHAR(160) NOT NULL,
    order_type VARCHAR(24) NOT NULL,
    priority VARCHAR(16) NOT NULL DEFAULT 'MEDIUM',
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'OPEN',
    assigned_technician VARCHAR(128),
    scheduled_date DATE,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    verified_by VARCHAR(128),
    verified_at TIMESTAMP,
    labor_cost_fcfa BIGINT NOT NULL DEFAULT 0,
    parts_cost_fcfa BIGINT NOT NULL DEFAULT 0,
    created_by VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cmms_wo_station ON cmms_work_orders (tenant_id, station_id, status);

CREATE TABLE IF NOT EXISTS cmms_pm_schedules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    asset_id VARCHAR(64),
    asset_name VARCHAR(160) NOT NULL,
    title VARCHAR(200) NOT NULL,
    interval_days INT,
    interval_hours DOUBLE PRECISION,
    last_run_at TIMESTAMP,
    last_meter_hours DOUBLE PRECISION DEFAULT 0,
    next_due_date DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cmms_generator_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    asset_id VARCHAR(64),
    generator_name VARCHAR(160) NOT NULL,
    hours_start DOUBLE PRECISION NOT NULL,
    hours_end DOUBLE PRECISION NOT NULL,
    runtime_hours DOUBLE PRECISION NOT NULL,
    fuel_litres DOUBLE PRECISION NOT NULL,
    fuel_source VARCHAR(32) NOT NULL DEFAULT 'INTERNAL_DIESEL_TANK',
    fuel_cost_fcfa BIGINT NOT NULL DEFAULT 0,
    power_outage_reason VARCHAR(200),
    logged_by VARCHAR(128),
    logged_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cmms_gen_station ON cmms_generator_logs (tenant_id, station_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS cmms_spare_parts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    part_code VARCHAR(64) NOT NULL,
    part_name VARCHAR(160) NOT NULL,
    category VARCHAR(48) NOT NULL DEFAULT 'DISPENSER',
    stock_qty INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 2,
    unit_cost_fcfa BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cmms_part_code UNIQUE (station_id, part_code)
);

CREATE TABLE IF NOT EXISTS cmms_part_issues (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    work_order_id VARCHAR(64) NOT NULL,
    part_id VARCHAR(64) NOT NULL,
    quantity INT NOT NULL,
    total_cost_fcfa BIGINT NOT NULL,
    issued_by VARCHAR(128),
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
