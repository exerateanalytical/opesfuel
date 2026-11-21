-- V5: Production Modules Schema (Tenant Settings, Identity Invites, Attendance Timesheets, Fleet Vehicles,
--     Suppliers, Fiscal Periods, SaaS Billing Invoices & Payments, AI Audit Logs, Notifications, Webhook Delivery Logs)

-- 1. Enrich Tenants & Stations with Production Configuration
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS default_currency VARCHAR(8) NOT NULL DEFAULT 'FCFA';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS country_code VARCHAR(8) NOT NULL DEFAULT 'CM';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Douala';

ALTER TABLE stations ADD COLUMN IF NOT EXISTS address VARCHAR(255);
ALTER TABLE stations ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.1925;
ALTER TABLE stations ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Douala';

-- 2. Identity & Staff Invitations
CREATE TABLE IF NOT EXISTS user_invites (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    email VARCHAR(160) NOT NULL,
    role VARCHAR(32) NOT NULL,
    invite_token VARCHAR(128) NOT NULL UNIQUE,
    status VARCHAR(24) NOT NULL DEFAULT 'PENDING',
    invited_by VARCHAR(160) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_invites_tenant ON user_invites (tenant_id, created_at DESC);

-- 3. Workforce Attendance Timesheet Audit Log
CREATE TABLE IF NOT EXISTS attendance_logs (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    clock_in_at TIMESTAMPTZ NOT NULL,
    clock_out_at TIMESTAMPTZ,
    worked_minutes BIGINT,
    recorded_by VARCHAR(160) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_emp ON attendance_logs (employee_id, clock_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_station ON attendance_logs (station_id, clock_in_at DESC);

-- 4. Inventory Suppliers Master & ATG IoT Telemetry
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
    name VARCHAR(160) NOT NULL,
    tax_id VARCHAR(64),
    contact_phone VARCHAR(48),
    contact_email VARCHAR(160),
    payment_terms_days INT NOT NULL DEFAULT 15,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_tenant ON suppliers (tenant_id);

-- 5. Corporate Fleet Vehicle Registry
CREATE TABLE IF NOT EXISTS fleet_vehicles (
    id VARCHAR(64) PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL REFERENCES fleet_accounts(id) ON DELETE CASCADE,
    plate_number VARCHAR(32) NOT NULL,
    driver_name VARCHAR(120) NOT NULL,
    allowed_grade VARCHAR(32),
    monthly_litre_cap NUMERIC(12, 2),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (account_id, plate_number)
);
CREATE INDEX IF NOT EXISTS idx_fleet_vehicles_account ON fleet_vehicles (account_id);

-- 6. Accounting Fiscal Periods (Close / Lock Controls)
CREATE TABLE IF NOT EXISTS fiscal_periods (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id),
    period_key VARCHAR(16) NOT NULL, -- e.g. '2026-11'
    status VARCHAR(16) NOT NULL DEFAULT 'OPEN', -- OPEN | CLOSED
    closed_by VARCHAR(160),
    closed_at TIMESTAMPTZ,
    UNIQUE (station_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_fiscal_periods_station ON fiscal_periods (station_id, period_key DESC);

-- 7. SaaS Billing Invoices & Payment Settlements
CREATE TABLE IF NOT EXISTS billing_invoices (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
    invoice_number VARCHAR(48) NOT NULL UNIQUE,
    period_label VARCHAR(32) NOT NULL,
    station_count INT NOT NULL,
    subtotal_fcfa BIGINT NOT NULL CHECK (subtotal_fcfa >= 0),
    ai_addon_fcfa BIGINT NOT NULL DEFAULT 0 CHECK (ai_addon_fcfa >= 0),
    total_fcfa BIGINT NOT NULL CHECK (total_fcfa >= 0),
    currency VARCHAR(8) NOT NULL DEFAULT 'FCFA',
    status VARCHAR(24) NOT NULL DEFAULT 'ISSUED', -- ISSUED | PAID | VOID
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_tenant ON billing_invoices (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS billing_payments (
    id VARCHAR(64) PRIMARY KEY,
    invoice_id VARCHAR(64) NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
    amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
    payment_channel VARCHAR(32) NOT NULL, -- ORANGE_MONEY | MTN_MOMO | BANK_TRANSFER | CARD
    provider_reference VARCHAR(128) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice ON billing_payments (invoice_id);

-- 8. AI Copilot Audit History & Metering
CREATE TABLE IF NOT EXISTS ai_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    operation_type VARCHAR(24) NOT NULL, -- ANALYZE | CHAT
    model_name VARCHAR(64) NOT NULL,
    prompt_summary TEXT NOT NULL,
    response_text TEXT NOT NULL,
    estimated_tokens INT NOT NULL DEFAULT 0,
    requested_by VARCHAR(160) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_audit_station ON ai_audit_logs (station_id, created_at DESC);

-- 9. Operational & Financial Alert Notifications
CREATE TABLE IF NOT EXISTS alert_notifications (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id),
    station_id VARCHAR(64),
    severity VARCHAR(16) NOT NULL, -- INFO | WARNING | CRITICAL
    category VARCHAR(48) NOT NULL, -- DIPSTICK_VARIANCE | CASH_VARIANCE | LOW_STOCK | DEMO_LEAD | STAFF_INVITE | BILLING
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    read_flag BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_unread ON alert_notifications (tenant_id, read_flag, created_at DESC);

-- 10. Webhook Delivery Audit Log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id VARCHAR(64) PRIMARY KEY,
    webhook_id VARCHAR(64) NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
    event_id VARCHAR(64) NOT NULL,
    event_type VARCHAR(80) NOT NULL,
    http_status INT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    duration_ms BIGINT NOT NULL DEFAULT 0,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_wh ON webhook_deliveries (webhook_id, attempted_at DESC);

-- Seed default depot supplier for demo tenant
INSERT INTO suppliers (id, tenant_id, name, tax_id, contact_phone, contact_email, payment_terms_days)
VALUES ('sup_scdp_01', 'ten_opes_cm', 'SCDP Depot Douala', 'M010100001122S', '+237 233 40 50 00', 'dispatch@scdp.cm', 15)
ON CONFLICT (id) DO NOTHING;
