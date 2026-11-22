-- Sprint 4: Global Unpriced Fuel Catalog (T007), Versioned Tank Calibration Charts (T010),
-- and Shop POS Return / Refund Ledger (T019).

CREATE TABLE IF NOT EXISTS tenant_fuel_catalog_prices (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    grade_code VARCHAR(32) NOT NULL,
    proposed_selling_price BIGINT,
    approved_selling_price BIGINT,
    currency_code VARCHAR(12) NOT NULL DEFAULT 'FCFA',
    status VARCHAR(32) NOT NULL DEFAULT 'UNSET',
    proposed_by VARCHAR(128),
    approved_by VARCHAR(128),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tenant_fuel_grade UNIQUE (tenant_id, grade_code)
);

CREATE TABLE IF NOT EXISTS tank_calibration_versions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    tank_id VARCHAR(64) NOT NULL,
    version_no INT NOT NULL,
    slope_litres_per_mm DOUBLE PRECISION NOT NULL,
    offset_litres DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    approved_by VARCHAR(128) NOT NULL,
    effective_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tank_dip_readings_versioned (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    tank_id VARCHAR(64) NOT NULL,
    calibration_version_id VARCHAR(64) NOT NULL,
    calibration_version_no INT NOT NULL,
    dip_mm DOUBLE PRECISION NOT NULL,
    calibrated_litres DOUBLE PRECISION NOT NULL,
    recorded_by VARCHAR(128) NOT NULL,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shop_sale_returns (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    original_sale_id VARCHAR(64) NOT NULL,
    sku VARCHAR(64) NOT NULL,
    original_qty INT NOT NULL,
    returned_qty INT NOT NULL,
    unit_price_fcfa BIGINT NOT NULL,
    refund_amount_fcfa BIGINT NOT NULL,
    reason VARCHAR(255) NOT NULL,
    processed_by VARCHAR(128) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
