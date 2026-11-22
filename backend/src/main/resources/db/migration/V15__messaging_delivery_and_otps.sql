-- V15: Real Multi-Channel Messaging Delivery Logs & Password-Reset OTPs

CREATE TABLE IF NOT EXISTS outbound_message_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    channel VARCHAR(24) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    recipient VARCHAR(160) NOT NULL,
    subject VARCHAR(240),
    body_preview VARCHAR(400),
    status VARCHAR(24) NOT NULL,
    provider_message_id VARCHAR(160),
    error_detail VARCHAR(512),
    template_type VARCHAR(48),
    created_by VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_outbound_deliveries_tenant ON outbound_message_deliveries (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS password_reset_otps (
    id VARCHAR(64) PRIMARY KEY,
    identifier VARCHAR(160) NOT NULL,
    channel VARCHAR(24) NOT NULL,
    code_hash VARCHAR(128) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_reset_otps_ident ON password_reset_otps (identifier, created_at DESC);
