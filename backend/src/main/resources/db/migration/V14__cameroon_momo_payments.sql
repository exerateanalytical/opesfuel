-- V14: Cameroon Mobile Money (MTN MoMo Collections/Disbursements + Orange Money WebPay)

CREATE TABLE IF NOT EXISTS momo_transactions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    target_type VARCHAR(32) NOT NULL DEFAULT 'SAAS_INVOICE',
    target_id VARCHAR(64) NOT NULL,
    provider VARCHAR(24) NOT NULL,
    environment VARCHAR(24) NOT NULL DEFAULT 'sandbox',
    msisdn VARCHAR(24) NOT NULL,
    amount_fcfa BIGINT NOT NULL,
    api_currency VARCHAR(8) NOT NULL DEFAULT 'XAF',
    external_id VARCHAR(96) NOT NULL UNIQUE,
    reference_id VARCHAR(96) NOT NULL UNIQUE,
    pay_token VARCHAR(255),
    notif_token VARCHAR(255),
    payment_url VARCHAR(1024),
    provider_tx_id VARCHAR(128),
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    failure_reason VARCHAR(512),
    idempotency_key VARCHAR(128),
    created_by VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_momo_tx_tenant ON momo_transactions (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_momo_tx_status ON momo_transactions (status, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_momo_tx_idem ON momo_transactions (tenant_id, idempotency_key);
