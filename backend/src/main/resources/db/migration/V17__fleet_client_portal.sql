-- V17: B2B Corporate Fleet Client Self-Service Portal & Vehicle Spend Limits

CREATE TABLE IF NOT EXISTS fleet_portal_users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    fleet_account_id VARCHAR(64) NOT NULL,
    email VARCHAR(160) NOT NULL UNIQUE,
    password_hash VARCHAR(200) NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    phone VARCHAR(32),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    invited_by VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fleet_portal_users_acc ON fleet_portal_users (tenant_id, fleet_account_id);

CREATE TABLE IF NOT EXISTS fleet_portal_sessions (
    token_hash VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    fleet_account_id VARCHAR(64) NOT NULL,
    email VARCHAR(160) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS fleet_vehicle_limits (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    fleet_account_id VARCHAR(64) NOT NULL,
    vehicle_plate VARCHAR(64) NOT NULL,
    card_number VARCHAR(64),
    daily_litre_cap DOUBLE PRECISION,
    monthly_litre_cap DOUBLE PRECISION,
    daily_xaf_cap BIGINT,
    monthly_xaf_cap BIGINT,
    allowed_grades_csv VARCHAR(160),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_fleet_veh_limit UNIQUE (tenant_id, fleet_account_id, vehicle_plate)
);

CREATE INDEX IF NOT EXISTS idx_fleet_veh_limits_acc ON fleet_vehicle_limits (fleet_account_id, vehicle_plate);
