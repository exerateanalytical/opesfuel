-- V7: Pre-Launch Production Modules — HR Suite, Unified Audit Log, Cash Safe/Vault,
-- Pump Calibration (20L Return-to-Tank) & Maintenance, Price History, Outbound Mailer,
-- Payment Gateway Checkouts, and Explicit 5-Role User Accounts Registry.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS max_pumps INTEGER NOT NULL DEFAULT 12;

-- 1. Explicit User Accounts Registry (All 5 Enterprise Account Types)
CREATE TABLE IF NOT EXISTS user_accounts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    auth0_sub VARCHAR(128) NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    email VARCHAR(180) NOT NULL,
    phone VARCHAR(64),
    role VARCHAR(32) NOT NULL,
    assigned_station_id VARCHAR(64),
    preferred_language VARCHAR(8) NOT NULL DEFAULT 'en',
    email_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_accounts_tenant ON user_accounts (tenant_id, role);

INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, phone, role, assigned_station_id, preferred_language)
SELECT 'usr_platform_admin', 'ten_opes_cm', 'auth0|platform_admin', 'Dr. Alain Mbarga', 'admin@opesware.com', '+237 699 000 001', 'PLATFORM_ADMIN', NULL, 'en'
WHERE NOT EXISTS (SELECT 1 FROM user_accounts WHERE id = 'usr_platform_admin');

INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, phone, role, assigned_station_id, preferred_language)
SELECT 'usr_owner_01', 'ten_opes_cm', 'auth0|owner_01', 'Jean-Paul Nkomo', 'owner@opesfuel.cm', '+237 699 112 233', 'OWNER', NULL, 'en'
WHERE NOT EXISTS (SELECT 1 FROM user_accounts WHERE id = 'usr_owner_01');

INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, phone, role, assigned_station_id, preferred_language)
SELECT 'usr_manager_01', 'ten_opes_cm', 'auth0|manager_01', 'Clarisse Ewondo', 'manager@opesfuel.cm', '+237 677 445 566', 'MANAGER', 'st_plateau', 'fr'
WHERE NOT EXISTS (SELECT 1 FROM user_accounts WHERE id = 'usr_manager_01');

INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, phone, role, assigned_station_id, preferred_language)
SELECT 'usr_attendant_01', 'ten_opes_cm', 'auth0|attendant_01', 'Samuel Tchoupo', 'attendant@opesfuel.cm', '+237 655 778 899', 'ATTENDANT', 'st_plateau', 'fr'
WHERE NOT EXISTS (SELECT 1 FROM user_accounts WHERE id = 'usr_attendant_01');

INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, phone, role, assigned_station_id, preferred_language)
SELECT 'usr_accountant_01', 'ten_opes_cm', 'auth0|accountant_01', 'Mireille Fotso', 'accountant@opesfuel.cm', '+237 691 334 455', 'ACCOUNTANT', NULL, 'fr'
WHERE NOT EXISTS (SELECT 1 FROM user_accounts WHERE id = 'usr_accountant_01');

-- 2. Unified Security & Operations Audit Trail
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64),
    actor_email VARCHAR(180) NOT NULL,
    actor_role VARCHAR(32) NOT NULL,
    action VARCHAR(64) NOT NULL,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs (tenant_id, created_at DESC);

-- 3. Pump 20L Calibration (Return-to-Tank) & Dispenser Maintenance Logs
CREATE TABLE IF NOT EXISTS pump_calibrations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    pump_id VARCHAR(64) NOT NULL,
    tank_id VARCHAR(64) NOT NULL,
    test_litres NUMERIC(12, 2) NOT NULL,
    returned_to_tank BOOLEAN NOT NULL DEFAULT TRUE,
    opening_totalizer NUMERIC(14, 2) NOT NULL,
    closing_totalizer NUMERIC(14, 2) NOT NULL,
    inspector_name VARCHAR(160) NOT NULL,
    notes TEXT,
    tested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pump_calibrations_station ON pump_calibrations (tenant_id, station_id, tested_at DESC);

CREATE TABLE IF NOT EXISTS pump_maintenance_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    pump_id VARCHAR(64) NOT NULL,
    maintenance_type VARCHAR(64) NOT NULL,
    description TEXT NOT NULL,
    cost_fcfa BIGINT NOT NULL DEFAULT 0,
    technician VARCHAR(160) NOT NULL,
    out_of_service BOOLEAN NOT NULL DEFAULT FALSE,
    next_due_date VARCHAR(32),
    logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pump_maintenance_station ON pump_maintenance_logs (tenant_id, station_id, logged_at DESC);

-- 4. Fuel Price Change History
CREATE TABLE IF NOT EXISTS fuel_price_history (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    grade VARCHAR(32) NOT NULL,
    old_price_fcfa BIGINT NOT NULL,
    new_price_fcfa BIGINT NOT NULL,
    changed_by VARCHAR(160) NOT NULL,
    reason VARCHAR(255),
    changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_fuel_price_history_station ON fuel_price_history (tenant_id, station_id, changed_at DESC);

-- 5. Cash Safe / Vault Ledger & Manager Handover Register
CREATE TABLE IF NOT EXISTS cash_vault_entries (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    entry_type VARCHAR(32) NOT NULL,
    amount_fcfa BIGINT NOT NULL,
    running_balance_fcfa BIGINT NOT NULL,
    reference_code VARCHAR(80) NOT NULL,
    handed_by VARCHAR(160) NOT NULL,
    received_by VARCHAR(160) NOT NULL,
    notes TEXT,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cash_vault_station ON cash_vault_entries (tenant_id, station_id, recorded_at DESC);

-- 6. Full HR Management Suite Tables
CREATE TABLE IF NOT EXISTS hr_contracts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    employee_id VARCHAR(64) NOT NULL,
    employee_name VARCHAR(160) NOT NULL,
    contract_type VARCHAR(24) NOT NULL DEFAULT 'CDI',
    cnps_number VARCHAR(64),
    base_salary_fcfa BIGINT NOT NULL DEFAULT 0,
    transport_allowance_fcfa BIGINT NOT NULL DEFAULT 0,
    housing_allowance_fcfa BIGINT NOT NULL DEFAULT 0,
    emergency_contact_name VARCHAR(160),
    emergency_contact_phone VARCHAR(64),
    start_date VARCHAR(32) NOT NULL,
    end_date VARCHAR(32),
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hr_contracts_tenant ON hr_contracts (tenant_id, station_id);

CREATE TABLE IF NOT EXISTS hr_leave_requests (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    employee_id VARCHAR(64) NOT NULL,
    employee_name VARCHAR(160) NOT NULL,
    leave_type VARCHAR(32) NOT NULL,
    start_date VARCHAR(32) NOT NULL,
    end_date VARCHAR(32) NOT NULL,
    days_count INTEGER NOT NULL DEFAULT 1,
    reason TEXT,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    reviewed_by VARCHAR(160),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hr_leaves_tenant ON hr_leave_requests (tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS hr_training_certs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    employee_id VARCHAR(64) NOT NULL,
    employee_name VARCHAR(160) NOT NULL,
    cert_name VARCHAR(180) NOT NULL,
    issuer VARCHAR(160) NOT NULL,
    issued_date VARCHAR(32) NOT NULL,
    expires_date VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'VALID'
);
CREATE INDEX IF NOT EXISTS idx_hr_certs_tenant ON hr_training_certs (tenant_id, expires_date);

CREATE TABLE IF NOT EXISTS hr_disciplinary_records (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    station_id VARCHAR(64) NOT NULL,
    employee_id VARCHAR(64) NOT NULL,
    employee_name VARCHAR(160) NOT NULL,
    category VARCHAR(32) NOT NULL,
    severity VARCHAR(24) NOT NULL,
    summary TEXT NOT NULL,
    amount_fcfa BIGINT NOT NULL DEFAULT 0,
    recorded_by VARCHAR(160) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_hr_disc_tenant ON hr_disciplinary_records (tenant_id, recorded_at DESC);

-- 7. Transactional Email / SMS / WhatsApp Outbound Dispatch Log
CREATE TABLE IF NOT EXISTS outbound_messages (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    channel VARCHAR(24) NOT NULL,
    recipient VARCHAR(180) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_preview TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    provider VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_outbound_messages_tenant ON outbound_messages (tenant_id, created_at DESC);

-- 8. Online Payment Gateway Checkout & Webhook Transactions
CREATE TABLE IF NOT EXISTS payment_transactions (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    invoice_id VARCHAR(64) NOT NULL,
    provider VARCHAR(32) NOT NULL,
    external_ref VARCHAR(120) NOT NULL UNIQUE,
    amount_fcfa BIGINT NOT NULL,
    currency VARCHAR(12) NOT NULL DEFAULT 'XAF',
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    checkout_url TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_payment_tx_tenant ON payment_transactions (tenant_id, created_at DESC);
