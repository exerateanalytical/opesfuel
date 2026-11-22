-- V8: Enterprise Petrol Station SaaS Modules (M18, M23, M24, M25, M36, M38, M39, M51, M52, M53, M54, M55)
-- Full PostgreSQL + H2-compatible schema for multi-tenant enterprise operations

-- M38: HSE Safety, Environmental, Fire Extinguishers, Spills & Emergency Drills
CREATE TABLE IF NOT EXISTS hse_records (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    record_type VARCHAR(40) NOT NULL, -- INCIDENT_SPILL, FIRE_EXTINGUISHER, SAFETY_DRILL, WASTE_OIL, TANK_LEAK_CHECK, PERMIT
    severity VARCHAR(24) NOT NULL DEFAULT 'LOW', -- LOW, MEDIUM, HIGH, CRITICAL
    title VARCHAR(180) NOT NULL,
    details TEXT NOT NULL,
    inspector_or_reporter VARCHAR(120) NOT NULL,
    next_due_date VARCHAR(32),
    capa_action VARCHAR(255),
    status VARCHAR(24) NOT NULL DEFAULT 'OPEN', -- OPEN, IN_PROGRESS, COMPLIANT, CLOSED
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hse_records_tenant ON hse_records (tenant_id, station_id);

-- M39: Fraud, Loss Prevention & Investigation Cases
CREATE TABLE IF NOT EXISTS fraud_cases (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    anomaly_type VARCHAR(48) NOT NULL, -- SHIFT_SHORTAGE, TANK_SHRINKAGE, SHORT_DELIVERY, METER_TAMPER, FLEET_VELOCITY
    severity VARCHAR(24) NOT NULL DEFAULT 'HIGH',
    subject_ref VARCHAR(120) NOT NULL,
    suspected_loss_fcfa BIGINT NOT NULL DEFAULT 0,
    recovered_fcfa BIGINT NOT NULL DEFAULT 0,
    investigator VARCHAR(120) NOT NULL,
    findings TEXT NOT NULL,
    disposition VARCHAR(40) NOT NULL DEFAULT 'UNDER_INVESTIGATION', -- UNDER_INVESTIGATION, CONFIRMED_FRAUD, FALSE_POSITIVE, RECOVERED_CLOSED
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fraud_cases_tenant ON fraud_cases (tenant_id, station_id);

-- M55: Fuel Quality Control, Water-Paste Testing & Tank Quarantine
CREATE TABLE IF NOT EXISTS fuel_quality_samples (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    tank_id VARCHAR(64) NOT NULL,
    tank_name VARCHAR(120) NOT NULL,
    fuel_grade VARCHAR(32) NOT NULL,
    batch_coa_ref VARCHAR(80) NOT NULL,
    density_kg_m3 DOUBLE PRECISION NOT NULL DEFAULT 745.0,
    temperature_c DOUBLE PRECISION NOT NULL DEFAULT 27.5,
    water_paste_detected BOOLEAN NOT NULL DEFAULT FALSE,
    quarantined BOOLEAN NOT NULL DEFAULT FALSE,
    tested_by VARCHAR(120) NOT NULL,
    notes VARCHAR(255),
    tested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fuel_qc_tenant ON fuel_quality_samples (tenant_id, station_id);

-- M25: Inter-Station Fuel & Stock Transfers
CREATE TABLE IF NOT EXISTS interstation_transfers (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    from_station_id VARCHAR(64) NOT NULL,
    from_station_name VARCHAR(120) NOT NULL,
    to_station_id VARCHAR(64) NOT NULL,
    to_station_name VARCHAR(120) NOT NULL,
    fuel_grade VARCHAR(32) NOT NULL,
    dispatched_litres DOUBLE PRECISION NOT NULL,
    received_litres DOUBLE PRECISION,
    seal_number VARCHAR(64) NOT NULL,
    tanker_plate VARCHAR(40) NOT NULL,
    driver_name VARCHAR(120) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'IN_TRANSIT', -- IN_TRANSIT, RECEIVED, DISPUTED, CANCELLED
    dispatched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    received_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_interstation_tenant ON interstation_transfers (tenant_id);

-- M18: Car Wash, Service Bay, Lube Pit & Ancillary POS
CREATE TABLE IF NOT EXISTS service_bay_tickets (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    service_category VARCHAR(40) NOT NULL, -- CAR_WASH, OIL_CHANGE, TIRE_SERVICE, DIAGNOSTIC
    vehicle_plate VARCHAR(40) NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    technician_name VARCHAR(120) NOT NULL,
    amount_fcfa BIGINT NOT NULL,
    payment_method VARCHAR(32) NOT NULL DEFAULT 'CASH',
    status VARCHAR(24) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_service_bay_tenant ON service_bay_tickets (tenant_id, station_id);

-- M23: Customer Loyalty & Prepaid Fuel Vouchers
CREATE TABLE IF NOT EXISTS loyalty_vouchers (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    voucher_code VARCHAR(64) NOT NULL UNIQUE,
    customer_name VARCHAR(120) NOT NULL,
    customer_phone VARCHAR(48),
    issued_fcfa BIGINT NOT NULL,
    balance_fcfa BIGINT NOT NULL,
    loyalty_points INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REDEEMED, EXPIRED
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_vouchers_tenant ON loyalty_vouchers (tenant_id);

-- M24 & M52: B2B Bulk Wholesale Sales & Own-Fleet Tanker Dispatch
CREATE TABLE IF NOT EXISTS bulk_wholesale_orders (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    customer_company VARCHAR(140) NOT NULL,
    fuel_grade VARCHAR(32) NOT NULL,
    volume_litres DOUBLE PRECISION NOT NULL,
    unit_price_fcfa BIGINT NOT NULL,
    total_fcfa BIGINT NOT NULL,
    tanker_truck_code VARCHAR(64) NOT NULL,
    driver_name VARCHAR(120) NOT NULL,
    delivery_destination VARCHAR(160) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED', -- SCHEDULED, DISPATCHED, DELIVERED_POD
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bulk_orders_tenant ON bulk_wholesale_orders (tenant_id);

-- M36: Fixed Assets Register & Straight-Line Depreciation (SYSCOHADA Class 2)
CREATE TABLE IF NOT EXISTS fixed_assets (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    asset_tag VARCHAR(64) NOT NULL,
    asset_name VARCHAR(160) NOT NULL,
    category VARCHAR(48) NOT NULL, -- UNDERGROUND_TANK, FUEL_DISPENSER, GENERATOR, CANOPY, POS_IT, SOLAR
    acquisition_date VARCHAR(32) NOT NULL,
    acquisition_cost_fcfa BIGINT NOT NULL,
    useful_life_years INTEGER NOT NULL DEFAULT 10,
    custodian VARCHAR(120) NOT NULL,
    insurance_policy VARCHAR(80),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fixed_assets_tenant ON fixed_assets (tenant_id, station_id);

-- M54 & M05: Monthly Station Budgets & Maker-Checker Approvals
CREATE TABLE IF NOT EXISTS station_budgets (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    period_label VARCHAR(16) NOT NULL,
    category VARCHAR(48) NOT NULL,
    budget_fcfa BIGINT NOT NULL,
    actual_fcfa BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maker_checker_approvals (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    request_type VARCHAR(48) NOT NULL, -- PO_APPROVAL, PRICE_CHANGE, CAPEX_EXPENSE, CREDIT_LIMIT
    title VARCHAR(180) NOT NULL,
    amount_fcfa BIGINT NOT NULL DEFAULT 0,
    requested_by VARCHAR(120) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
    decided_by VARCHAR(120),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    decided_at TIMESTAMP
);

-- M53: EV Charging & Utility Metering (Grid / Solar / Generator Diesel)
CREATE TABLE IF NOT EXISTS ev_utility_readings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    meter_type VARCHAR(40) NOT NULL, -- EV_CHARGER_SESSION, GRID_ELECTRICITY, SOLAR_GENERATION, GENERATOR_DIESEL
    connector_or_meter VARCHAR(80) NOT NULL,
    quantity_unit DOUBLE PRECISION NOT NULL,
    unit_label VARCHAR(16) NOT NULL DEFAULT 'kWh',
    revenue_or_cost_fcfa BIGINT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- M51: Franchise & Dealer Agreements
CREATE TABLE IF NOT EXISTS franchise_agreements (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    dealer_name VARCHAR(140) NOT NULL,
    operating_model VARCHAR(32) NOT NULL DEFAULT 'DODO', -- COCO, CODO, DODO
    royalty_fcfa_per_litre DOUBLE PRECISION NOT NULL DEFAULT 8.5,
    monthly_target_litres DOUBLE PRECISION NOT NULL DEFAULT 150000,
    compliance_score_pct INTEGER NOT NULL DEFAULT 94,
    renewal_date VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
