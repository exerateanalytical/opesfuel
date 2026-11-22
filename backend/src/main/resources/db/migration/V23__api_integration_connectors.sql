-- V23: Encrypted API Integration Connectors (MTN MoMo CM, Orange Money CM, Email SMTP/Resend, SMS, WhatsApp, Gemini AI)

CREATE TABLE IF NOT EXISTS integration_connectors (
    id VARCHAR(96) PRIMARY KEY,
    scope VARCHAR(16) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'GLOBAL',
    provider_key VARCHAR(32) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    config_json_encrypted TEXT NOT NULL,
    last_test_status VARCHAR(24) NOT NULL DEFAULT 'UNVERIFIED',
    last_test_message VARCHAR(400),
    last_tested_at TIMESTAMP,
    updated_by VARCHAR(128),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_integration_scope_provider UNIQUE (scope, tenant_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_integration_connectors_scope ON integration_connectors (scope, tenant_id);
