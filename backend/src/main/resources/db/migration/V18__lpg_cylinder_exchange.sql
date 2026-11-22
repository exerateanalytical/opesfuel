-- V18: LPG Bottled Gas Cylinder Exchange, Stock & Refundable Deposit Consignation

CREATE TABLE IF NOT EXISTS lpg_cylinder_skus (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    brand VARCHAR(48) NOT NULL,
    size_kg DOUBLE PRECISION NOT NULL,
    sku_code VARCHAR(64) NOT NULL,
    gas_refill_price_fcfa BIGINT NOT NULL,
    deposit_fcfa BIGINT NOT NULL,
    cross_brand_swap_fee_fcfa BIGINT NOT NULL DEFAULT 1500,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_lpg_sku_tenant_code UNIQUE (tenant_id, sku_code)
);

CREATE TABLE IF NOT EXISTS lpg_station_stock (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    sku_id VARCHAR(64) NOT NULL,
    full_qty INT NOT NULL DEFAULT 0,
    empty_qty INT NOT NULL DEFAULT 0,
    damaged_qty INT NOT NULL DEFAULT 0,
    in_transit_qty INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_lpg_stock_site_sku UNIQUE (station_id, sku_id)
);

CREATE TABLE IF NOT EXISTS lpg_cylinder_transactions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    sku_id VARCHAR(64) NOT NULL,
    swap_from_sku_id VARCHAR(64),
    tx_type VARCHAR(32) NOT NULL,
    quantity INT NOT NULL,
    customer_name VARCHAR(160),
    customer_phone VARCHAR(32),
    gas_amount_fcfa BIGINT NOT NULL DEFAULT 0,
    deposit_delta_fcfa BIGINT NOT NULL DEFAULT 0,
    swap_fee_fcfa BIGINT NOT NULL DEFAULT 0,
    total_fcfa BIGINT NOT NULL DEFAULT 0,
    payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH',
    receipt_no VARCHAR(64) NOT NULL,
    notes VARCHAR(300),
    actor VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lpg_tx_station ON lpg_cylinder_transactions (tenant_id, station_id, created_at DESC);
