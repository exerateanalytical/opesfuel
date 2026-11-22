-- V21: Customer loyalty (members by phone, earn rules, tiers, campaigns) and digital receipts

CREATE TABLE IF NOT EXISTS loyalty_members (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    full_name VARCHAR(160),
    pass_token VARCHAR(64) NOT NULL UNIQUE,
    points_balance BIGINT NOT NULL DEFAULT 0,
    lifetime_points BIGINT NOT NULL DEFAULT 0,
    tier VARCHAR(16) NOT NULL DEFAULT 'BRONZE',
    fleet_account VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_loyalty_member_phone UNIQUE (tenant_id, phone)
);

CREATE TABLE IF NOT EXISTS loyalty_earn_rules (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    fuel_grade VARCHAR(32) NOT NULL,
    points_per_litre DOUBLE PRECISION NOT NULL DEFAULT 0,
    points_per_1000_xaf DOUBLE PRECISION NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_loyalty_rule_grade UNIQUE (tenant_id, fuel_grade)
);

CREATE TABLE IF NOT EXISTS loyalty_campaigns (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    name VARCHAR(160) NOT NULL,
    campaign_type VARCHAR(24) NOT NULL,
    discount_pct DOUBLE PRECISION NOT NULL DEFAULT 0,
    fuel_grade VARCHAR(32),
    start_hour INT,
    end_hour INT,
    fleet_account VARCHAR(120),
    valid_from DATE,
    valid_to DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    member_id VARCHAR(64) NOT NULL,
    entry_type VARCHAR(16) NOT NULL,
    points BIGINT NOT NULL,
    fuel_grade VARCHAR(32),
    litres DOUBLE PRECISION,
    amount_xaf BIGINT,
    discount_xaf BIGINT NOT NULL DEFAULT 0,
    campaign_id VARCHAR(64),
    reference VARCHAR(120),
    created_by VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_ledger_member ON loyalty_ledger (tenant_id, member_id);

CREATE TABLE IF NOT EXISTS digital_receipts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    member_id VARCHAR(64),
    channel VARCHAR(16) NOT NULL,
    recipient VARCHAR(64) NOT NULL,
    body TEXT NOT NULL,
    outbound_message_id VARCHAR(64),
    status VARCHAR(24) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
