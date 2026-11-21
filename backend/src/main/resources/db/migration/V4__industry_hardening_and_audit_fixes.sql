-- V4: Industry Hardening, Multi-Tenancy, Spring Modulith Event Publication, Concurrency Locks, Indexes & Audit Fixes

-- 1. Spring Modulith JPA Event Publication Registry (required for hibernate ddl-auto=validate)
CREATE TABLE IF NOT EXISTS event_publication (
    id UUID PRIMARY KEY,
    listener_id VARCHAR(512) NOT NULL,
    event_type VARCHAR(512) NOT NULL,
    serialized_event TEXT NOT NULL,
    publication_date TIMESTAMPTZ NOT NULL,
    completion_date TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_event_publication_serialized ON event_publication (listener_id, completion_date);

-- 2. Multi-Tenant Root Partition
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    owner_email VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO tenants (id, name, owner_email)
VALUES ('ten_opes_cm', 'OpesFuel Demo Network', 'owner@opesfuel.com')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE stations ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'ten_opes_cm' REFERENCES tenants(id);
ALTER TABLE fleet_accounts ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'ten_opes_cm' REFERENCES tenants(id);
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'ten_opes_cm' REFERENCES tenants(id);
ALTER TABLE webhook_subscriptions ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'ten_opes_cm' REFERENCES tenants(id);
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) NOT NULL DEFAULT 'ten_opes_cm' REFERENCES tenants(id);
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS station_id VARCHAR(64);
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE outbox_events ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 3. Optimistic Locking Versions on Mutable Financial/Inventory Aggregates
ALTER TABLE pumps ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE shift_records ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE fleet_accounts ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS version BIGINT NOT NULL DEFAULT 0;

-- 4. Shop Unit Cost & Shop Sales Audit Ledger
ALTER TABLE shop_items ADD COLUMN IF NOT EXISTS unit_cost_fcfa BIGINT NOT NULL DEFAULT 0;
UPDATE shop_items SET unit_cost_fcfa = 13200 WHERE id = 'sku_01' AND unit_cost_fcfa = 0;
UPDATE shop_items SET unit_cost_fcfa = 4400  WHERE id = 'sku_02' AND unit_cost_fcfa = 0;
UPDATE shop_items SET unit_cost_fcfa = 5400  WHERE id = 'sku_03' AND unit_cost_fcfa = 0;

CREATE TABLE IF NOT EXISTS shop_sales (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    item_id VARCHAR(64) NOT NULL REFERENCES shop_items(id),
    sku VARCHAR(48) NOT NULL,
    item_name VARCHAR(160) NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_fcfa BIGINT NOT NULL CHECK (unit_price_fcfa > 0),
    unit_cost_fcfa BIGINT NOT NULL CHECK (unit_cost_fcfa >= 0),
    gross_fcfa BIGINT NOT NULL CHECK (gross_fcfa > 0),
    cogs_fcfa BIGINT NOT NULL CHECK (cogs_fcfa >= 0),
    payment_method VARCHAR(32) NOT NULL,
    sold_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Immutable SYSCOHADA Voiding & Journal Reversal Tracking
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE treasury_deposits ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE treasury_deposits ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE tank_deliveries ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tank_deliveries ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE shift_records ADD COLUMN IF NOT EXISTS voided BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE shift_records ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ;
ALTER TABLE journal_entries ADD COLUMN IF NOT EXISTS reversed_entry_id VARCHAR(64);

-- 6. Public Demo Leads Persistence & Payroll Execution History
CREATE TABLE IF NOT EXISTS demo_leads (
    id VARCHAR(64) PRIMARY KEY,
    reference_id VARCHAR(64) NOT NULL UNIQUE,
    full_name VARCHAR(160) NOT NULL,
    station_name VARCHAR(160) NOT NULL,
    email VARCHAR(160) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    pump_count INT NOT NULL CHECK (pump_count >= 1),
    selected_plan VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'RECEIVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payroll_runs (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    period_label VARCHAR(64) NOT NULL,
    employee_count INT NOT NULL CHECK (employee_count >= 0),
    total_base_fcfa BIGINT NOT NULL CHECK (total_base_fcfa >= 0),
    total_deductions_fcfa BIGINT NOT NULL CHECK (total_deductions_fcfa >= 0),
    total_net_paid_fcfa BIGINT NOT NULL CHECK (total_net_paid_fcfa >= 0),
    payment_source VARCHAR(32) NOT NULL,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Harden Idempotency Records (Per-Principal Isolation, Payload Hash, Atomic Lock Status, TTL)
ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS principal_id VARCHAR(160) NOT NULL DEFAULT 'legacy';
ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS request_hash VARCHAR(64) NOT NULL DEFAULT '';
ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'COMPLETED';
ALTER TABLE idempotency_records ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours');
ALTER TABLE idempotency_records DROP CONSTRAINT IF EXISTS idempotency_records_pkey;
ALTER TABLE idempotency_records ADD CONSTRAINT idempotency_records_pkey PRIMARY KEY (principal_id, idempotency_key);

-- 8. Referential Integrity, Domain CHECK & Uniqueness Constraints
ALTER TABLE tank_deliveries
    ADD CONSTRAINT fk_tank_deliveries_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id);

ALTER TABLE fuel_tanks ADD CONSTRAINT chk_tank_capacity_positive CHECK (capacity_litres > 0);
ALTER TABLE fuel_tanks ADD CONSTRAINT chk_tank_book_nonneg CHECK (book_volume_litres >= 0);
ALTER TABLE fuel_tanks ADD CONSTRAINT chk_tank_unit_cost_nonneg CHECK (unit_cost_fcfa >= 0);
ALTER TABLE shop_items ADD CONSTRAINT chk_shop_stock_nonneg CHECK (stock_qty >= 0);
ALTER TABLE shop_items ADD CONSTRAINT chk_shop_price_positive CHECK (unit_price_fcfa > 0);
ALTER TABLE fleet_accounts ADD CONSTRAINT chk_fleet_limit_positive CHECK (credit_limit_fcfa > 0);
ALTER TABLE fleet_accounts ADD CONSTRAINT chk_fleet_balance_nonneg CHECK (balance_owed_fcfa >= 0);
ALTER TABLE expenses ADD CONSTRAINT chk_expense_amount_positive CHECK (amount_fcfa > 0);
ALTER TABLE treasury_deposits ADD CONSTRAINT chk_deposit_amount_positive CHECK (amount_fcfa > 0);

CREATE UNIQUE INDEX IF NOT EXISTS ux_api_keys_hash ON api_keys (key_hash);
CREATE UNIQUE INDEX IF NOT EXISTS ux_pumps_station_code ON pumps (station_id, code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shop_items_station_sku ON shop_items (station_id, sku);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fleet_accounts_tenant_tax ON fleet_accounts (tenant_id, tax_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_shift_one_open_per_pump ON shift_records (pump_id) WHERE status = 'OPEN';

-- 9. Performance Indexes on Foreign Keys & Hot Query Filters
CREATE INDEX IF NOT EXISTS idx_stations_tenant ON stations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_fuel_prices_station_grade ON fuel_prices (station_id, grade, effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_tanks_station ON fuel_tanks (station_id);
CREATE INDEX IF NOT EXISTS idx_pumps_station_grade ON pumps (station_id, grade);
CREATE INDEX IF NOT EXISTS idx_pumps_tank ON pumps (tank_id);
CREATE INDEX IF NOT EXISTS idx_employees_station ON employees (station_id);
CREATE INDEX IF NOT EXISTS idx_employees_auth0_sub ON employees (auth0_sub);
CREATE INDEX IF NOT EXISTS idx_shifts_station_opened ON shift_records (station_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_shifts_pump ON shift_records (pump_id);
CREATE INDEX IF NOT EXISTS idx_shifts_attendant ON shift_records (attendant_id);
CREATE INDEX IF NOT EXISTS idx_fleet_tx_account ON fleet_transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_fleet_tx_station_created ON fleet_transactions (station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_items_station ON shop_items (station_id);
CREATE INDEX IF NOT EXISTS idx_shop_sales_station_sold ON shop_sales (station_id, sold_at DESC);
CREATE INDEX IF NOT EXISTS idx_po_station_created ON purchase_orders (station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_tank_received ON tank_deliveries (tank_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_dipsticks_tank_recorded ON dipstick_readings (tank_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_journals_station_posted ON journal_entries (station_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines (account_code);
CREATE INDEX IF NOT EXISTS idx_expenses_station_created ON expenses (station_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deposits_station_deposited ON treasury_deposits (station_id, deposited_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON outbox_events (published, occurred_at ASC);
CREATE INDEX IF NOT EXISTS idx_outbox_tenant_occurred ON outbox_events (tenant_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_idempotency_expires ON idempotency_records (expires_at);

-- 10. Repair V2 Seed Data Consistency (Open Shifts for ACTIVE_SHIFT Pumps + Balanced Opening Journal + Catalog Alignment)
INSERT INTO shift_records (id, station_id, pump_id, attendant_id, opening_meter_litres, unit_price_fcfa, status, opened_at)
VALUES
    ('sh_101', 'st_plateau', 'pmp_01', 'emp_01', 484210.00, 840, 'OPEN', NOW() - INTERVAL '4 hours'),
    ('sh_102', 'st_plateau', 'pmp_02', 'emp_02', 612940.00, 828, 'OPEN', NOW() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO journal_entries (id, station_id, reference, source_event, description, posted_at)
VALUES (
    'je_seed_001',
    'st_plateau',
    'OPENING-CAP',
    'StationSeededEvent',
    'Opening working capital, tank fuel stock & fleet receivables for OpesFuel Bonanjo Plateau',
    NOW() - INTERVAL '48 hours'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO journal_lines (id, journal_entry_id, account_code, debit_fcfa, credit_fcfa)
VALUES
    ('jl_seed_01', 'je_seed_001', '1030', 12000000, 0),
    ('jl_seed_02', 'je_seed_001', '1200', 42473700, 0),
    ('jl_seed_03', 'je_seed_001', '1100', 2105000, 0),
    ('jl_seed_04', 'je_seed_001', '3010', 0, 56578700)
ON CONFLICT (id) DO NOTHING;

-- Align V3 institutional_fuel_catalog with benchmark FCFA unit costs and selling prices
UPDATE institutional_fuel_catalog SET default_unit_cost_fcfa = 745, default_selling_price_fcfa = 840 WHERE grade = 'SUPER';
UPDATE institutional_fuel_catalog SET default_unit_cost_fcfa = 735, default_selling_price_fcfa = 828 WHERE grade = 'GASOIL';
UPDATE institutional_fuel_catalog SET default_unit_cost_fcfa = 470, default_selling_price_fcfa = 550 WHERE grade = 'KEROSENE';
UPDATE institutional_fuel_catalog SET default_unit_cost_fcfa = 445, default_selling_price_fcfa = 620 WHERE grade = 'LPG_BULK';
UPDATE institutional_fuel_catalog SET default_unit_cost_fcfa = 560, default_selling_price_fcfa = 765 WHERE grade = 'HEAVY_FUEL';
