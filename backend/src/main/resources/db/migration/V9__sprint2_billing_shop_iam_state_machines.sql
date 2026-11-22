-- V9: Sprint 2 Deep State Machines — Billing Pro (M03), Shop FEFO & Stock Adjustments (M16/M17), IAM Governance (M05)

-- M03: Promotional & Partner Referral Coupons
CREATE TABLE IF NOT EXISTS billing_coupons (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    code VARCHAR(48) NOT NULL UNIQUE,
    discount_type VARCHAR(24) NOT NULL DEFAULT 'PERCENT', -- PERCENT, FIXED_FCFA
    discount_value BIGINT NOT NULL,
    max_redemptions INTEGER NOT NULL DEFAULT 100,
    redemptions_used INTEGER NOT NULL DEFAULT 0,
    expires_at VARCHAR(32) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- M03: SaaS Subscription Credit Notes
CREATE TABLE IF NOT EXISTS billing_credit_notes (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    credit_note_number VARCHAR(64) NOT NULL,
    invoice_id VARCHAR(64) NOT NULL,
    amount_fcfa BIGINT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    issued_by VARCHAR(120) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ISSUED',
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- M03: Subscription Lifecycle & Dunning Events
CREATE TABLE IF NOT EXISTS billing_dunning_events (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    previous_state VARCHAR(24) NOT NULL,
    new_state VARCHAR(24) NOT NULL, -- TRIAL, ACTIVE, PAST_DUE, GRACE, RESTRICTED, CANCELLED, EXPIRED
    channel VARCHAR(24) NOT NULL DEFAULT 'EMAIL',
    note VARCHAR(255) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- M16 & M17: Shop / Lubricant FEFO Batches & Barcodes
CREATE TABLE IF NOT EXISTS shop_sku_batches (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    barcode VARCHAR(64) NOT NULL,
    item_name VARCHAR(160) NOT NULL,
    batch_code VARCHAR(64) NOT NULL,
    expiry_date VARCHAR(32) NOT NULL,
    quantity_remaining INTEGER NOT NULL DEFAULT 0,
    unit_price_fcfa BIGINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_shop_batches_fefo ON shop_sku_batches (tenant_id, station_id, expiry_date);

-- M17: Stock Adjustments State Machine (DRAFT -> PENDING_APPROVAL -> APPROVED -> POSTED | REJECTED)
CREATE TABLE IF NOT EXISTS stock_adjustments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    item_name VARCHAR(160) NOT NULL,
    qty_delta INTEGER NOT NULL,
    unit_cost_fcfa BIGINT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'DRAFT', -- DRAFT, PENDING_APPROVAL, APPROVED, POSTED, REJECTED
    created_by VARCHAR(120) NOT NULL,
    approved_by VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- M05: IAM Time-Bound Delegated Grants
CREATE TABLE IF NOT EXISTS iam_delegated_grants (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    grantor_sub VARCHAR(120) NOT NULL,
    grantee_email VARCHAR(160) NOT NULL,
    permission_scope VARCHAR(80) NOT NULL,
    reason VARCHAR(255) NOT NULL,
    expires_at VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REVOKED, EXPIRED
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- M05: IAM Logged Break-Glass Emergency Elevation
CREATE TABLE IF NOT EXISTS iam_break_glass_sessions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    actor_sub VARCHAR(120) NOT NULL,
    elevated_role VARCHAR(40) NOT NULL,
    incident_ticket VARCHAR(64) NOT NULL,
    justification TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    review_status VARCHAR(24) NOT NULL DEFAULT 'PENDING_AUDIT', -- PENDING_AUDIT, REVIEWED_OK, FLAGGED
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- M05: IAM Periodic Access Recertification Reviews
CREATE TABLE IF NOT EXISTS iam_access_reviews (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    cycle_label VARCHAR(32) NOT NULL,
    target_user_email VARCHAR(160) NOT NULL,
    assigned_role VARCHAR(40) NOT NULL,
    decision VARCHAR(24) NOT NULL DEFAULT 'CERTIFIED', -- CERTIFIED, REVOKED
    reviewer_sub VARCHAR(120) NOT NULL,
    notes VARCHAR(255),
    reviewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
