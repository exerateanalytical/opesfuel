-- OpesFuel PostgreSQL 17 Schema (FCFA BIGINT monetary precision, Litres NUMERIC(12,2))

CREATE TABLE stations (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(32) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    city VARCHAR(120) NOT NULL,
    currency VARCHAR(8) NOT NULL DEFAULT 'FCFA',
    plan_name VARCHAR(64) NOT NULL DEFAULT 'Starter Station',
    monthly_fee_fcfa BIGINT NOT NULL DEFAULT 25000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fuel_prices (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    grade VARCHAR(32) NOT NULL,
    price_per_litre_fcfa BIGINT NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fuel_tanks (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    name VARCHAR(120) NOT NULL,
    grade VARCHAR(32) NOT NULL,
    capacity_litres NUMERIC(12, 2) NOT NULL,
    book_volume_litres NUMERIC(12, 2) NOT NULL,
    last_dip_litres NUMERIC(12, 2) NOT NULL,
    unit_cost_fcfa BIGINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE pumps (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    tank_id VARCHAR(64) NOT NULL REFERENCES fuel_tanks(id),
    code VARCHAR(32) NOT NULL,
    grade VARCHAR(32) NOT NULL,
    totalizer_litres NUMERIC(14, 2) NOT NULL,
    unit_price_fcfa BIGINT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'IDLE'
);

CREATE TABLE employees (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    auth0_sub VARCHAR(128),
    full_name VARCHAR(160) NOT NULL,
    role VARCHAR(32) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    shift_window VARCHAR(64) NOT NULL DEFAULT '06:00 - 14:00',
    clocked_in BOOLEAN NOT NULL DEFAULT FALSE,
    base_salary_fcfa BIGINT NOT NULL,
    cumulative_variance_fcfa BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE shift_records (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    pump_id VARCHAR(64) NOT NULL REFERENCES pumps(id),
    attendant_id VARCHAR(64) NOT NULL REFERENCES employees(id),
    opening_meter_litres NUMERIC(14, 2) NOT NULL,
    closing_meter_litres NUMERIC(14, 2),
    unit_price_fcfa BIGINT NOT NULL,
    cash_fcfa BIGINT NOT NULL DEFAULT 0,
    mobile_money_fcfa BIGINT NOT NULL DEFAULT 0,
    card_fcfa BIGINT NOT NULL DEFAULT 0,
    fleet_credit_fcfa BIGINT NOT NULL DEFAULT 0,
    variance_fcfa BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at TIMESTAMPTZ
);

CREATE TABLE fleet_accounts (
    id VARCHAR(64) PRIMARY KEY,
    company_name VARCHAR(160) NOT NULL,
    tax_id VARCHAR(64) NOT NULL,
    credit_limit_fcfa BIGINT NOT NULL,
    balance_owed_fcfa BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
);

CREATE TABLE fleet_transactions (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES fleet_accounts(id),
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    vehicle_plate VARCHAR(32) NOT NULL,
    driver_name VARCHAR(120) NOT NULL,
    grade VARCHAR(32) NOT NULL,
    litres NUMERIC(12, 2) NOT NULL,
    amount_fcfa BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE shop_items (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    sku VARCHAR(48) NOT NULL,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(32) NOT NULL,
    stock_qty INT NOT NULL,
    reorder_level INT NOT NULL,
    unit_price_fcfa BIGINT NOT NULL
);

CREATE TABLE purchase_orders (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    supplier_name VARCHAR(160) NOT NULL,
    grade VARCHAR(32) NOT NULL,
    ordered_litres NUMERIC(12, 2) NOT NULL,
    unit_cost_fcfa BIGINT NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tank_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    tank_id VARCHAR(64) NOT NULL REFERENCES fuel_tanks(id),
    purchase_order_id VARCHAR(64),
    supplier_name VARCHAR(160) NOT NULL,
    bol_litres NUMERIC(12, 2) NOT NULL,
    actual_received_litres NUMERIC(12, 2) NOT NULL,
    unit_cost_fcfa BIGINT NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dipstick_readings (
    id VARCHAR(64) PRIMARY KEY,
    tank_id VARCHAR(64) NOT NULL REFERENCES fuel_tanks(id),
    book_litres NUMERIC(12, 2) NOT NULL,
    measured_litres NUMERIC(12, 2) NOT NULL,
    variance_litres NUMERIC(12, 2) NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE accounts (
    code VARCHAR(16) PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    account_type VARCHAR(24) NOT NULL -- ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
);

CREATE TABLE journal_entries (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    reference VARCHAR(64) NOT NULL,
    source_event VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_lines (
    id VARCHAR(64) PRIMARY KEY,
    journal_entry_id VARCHAR(64) NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(16) NOT NULL REFERENCES accounts(code),
    debit_fcfa BIGINT NOT NULL DEFAULT 0,
    credit_fcfa BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT chk_debit_or_credit CHECK (debit_fcfa >= 0 AND credit_fcfa >= 0)
);

CREATE TABLE expenses (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    category VARCHAR(48) NOT NULL,
    description TEXT NOT NULL,
    amount_fcfa BIGINT NOT NULL,
    payment_source VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'POSTED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE treasury_deposits (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    source_account VARCHAR(48) NOT NULL,
    bank_name VARCHAR(120) NOT NULL,
    slip_reference VARCHAR(64) NOT NULL,
    amount_fcfa BIGINT NOT NULL,
    deposited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE outbox_events (
    event_id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(80) NOT NULL,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(64) NOT NULL,
    payload_json TEXT NOT NULL,
    summary TEXT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE api_keys (
    id VARCHAR(64) PRIMARY KEY,
    label VARCHAR(120) NOT NULL,
    key_prefix VARCHAR(24) NOT NULL,
    key_hash VARCHAR(128) NOT NULL,
    scopes_csv VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    target_url TEXT NOT NULL,
    subscribed_events_csv TEXT NOT NULL,
    hmac_secret_hash VARCHAR(128) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE idempotency_records (
    idempotency_key VARCHAR(64) PRIMARY KEY,
    endpoint VARCHAR(160) NOT NULL,
    response_code INT NOT NULL,
    response_body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Standard SYSCOHADA / IFRS Petrol Station Chart of Accounts
INSERT INTO accounts (code, name, account_type) VALUES
    ('1010', 'Cash on Hand & Safe', 'ASSET'),
    ('1020', 'Mobile Money Clearing (OM/MoMo)', 'ASSET'),
    ('1030', 'Bank Operating Account', 'ASSET'),
    ('1100', 'Fleet Accounts Receivable', 'ASSET'),
    ('1200', 'Fuel & Lubricant Inventory', 'ASSET'),
    ('2010', 'Supplier Accounts Payable', 'LIABILITY'),
    ('2200', 'Fuel VAT & Excise Payable', 'LIABILITY'),
    ('3010', 'Owner Paid-In Capital', 'EQUITY'),
    ('4010', 'Forecourt Fuel Sales Revenue', 'REVENUE'),
    ('4020', 'Lubricants & Shop Revenue', 'REVENUE'),
    ('5010', 'Cost of Fuel Sold (COGS)', 'EXPENSE'),
    ('6010', 'Station Operating Expenses', 'EXPENSE'),
    ('6100', 'Shift Cash Over / Short Variance', 'EXPENSE');
