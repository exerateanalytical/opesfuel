-- V24: SaaS Platform Super-Admin Control Plane (Support Desk, Audited Impersonation, Persisted Licenses, Broadcasts, Tenant Plans & Trials)

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_code VARCHAR(32) NOT NULL DEFAULT 'growth';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_status VARCHAR(24) NOT NULL DEFAULT 'CURRENT';

-- Ensure baseline SaaS plans exist in platform_subscription_plans
INSERT INTO platform_subscription_plans (plan_code, plan_name, monthly_price_fcfa, monthly_price_usd, max_stations, max_pumps, trial_days, active)
SELECT 'starter', 'Starter Station', 25000, 41.32, 1, 6, 14, TRUE
WHERE NOT EXISTS (SELECT 1 FROM platform_subscription_plans WHERE plan_code = 'starter');

INSERT INTO platform_subscription_plans (plan_code, plan_name, monthly_price_fcfa, monthly_price_usd, max_stations, max_pumps, trial_days, active)
SELECT 'growth', 'Multi-Pump Pro', 55000, 90.91, 5, 18, 14, TRUE
WHERE NOT EXISTS (SELECT 1 FROM platform_subscription_plans WHERE plan_code = 'growth');

INSERT INTO platform_subscription_plans (plan_code, plan_name, monthly_price_fcfa, monthly_price_usd, max_stations, max_pumps, trial_days, active)
SELECT 'enterprise', 'Network Enterprise', 120000, 198.35, 999, 999, 30, TRUE
WHERE NOT EXISTS (SELECT 1 FROM platform_subscription_plans WHERE plan_code = 'enterprise');

-- Customer Support Tickets Desk
CREATE TABLE IF NOT EXISTS platform_support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    ticket_number VARCHAR(40) NOT NULL UNIQUE,
    tenant_id VARCHAR(64) NOT NULL,
    tenant_name VARCHAR(180) NOT NULL,
    station_id VARCHAR(64),
    requester_email VARCHAR(180) NOT NULL,
    subject VARCHAR(240) NOT NULL,
    category VARCHAR(48) NOT NULL DEFAULT 'TECHNICAL',
    priority VARCHAR(24) NOT NULL DEFAULT 'MEDIUM',
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    assigned_to VARCHAR(180),
    sla_due_at TIMESTAMP,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON platform_support_tickets (status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON platform_support_tickets (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS platform_support_messages (
    id VARCHAR(64) PRIMARY KEY,
    ticket_id VARCHAR(64) NOT NULL REFERENCES platform_support_tickets(id) ON DELETE CASCADE,
    sender_email VARCHAR(180) NOT NULL,
    sender_role VARCHAR(32) NOT NULL,
    internal_note BOOLEAN NOT NULL DEFAULT FALSE,
    body TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON platform_support_messages (ticket_id, created_at ASC);

-- Audited Super-Admin Tenant Impersonation Sessions
CREATE TABLE IF NOT EXISTS platform_impersonation_sessions (
    id VARCHAR(64) PRIMARY KEY,
    admin_email VARCHAR(180) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    tenant_name VARCHAR(180) NOT NULL,
    ticket_id VARCHAR(64),
    reason VARCHAR(400) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_impersonation_admin ON platform_impersonation_sessions (admin_email, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_impersonation_tenant ON platform_impersonation_sessions (tenant_id, started_at DESC);

-- Persisted Enterprise Software Licenses (Issue & Revoke)
CREATE TABLE IF NOT EXISTS platform_enterprise_licenses (
    id VARCHAR(64) PRIMARY KEY,
    license_key VARCHAR(80) NOT NULL UNIQUE,
    tenant_id VARCHAR(64),
    organization_name VARCHAR(200) NOT NULL,
    tier_name VARCHAR(120) NOT NULL,
    max_stations INT NOT NULL DEFAULT 10,
    annual_fee_fcfa BIGINT NOT NULL DEFAULT 5000000,
    expires_at VARCHAR(32) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',
    revoked_reason VARCHAR(300),
    revoked_at TIMESTAMP,
    issued_by VARCHAR(180) NOT NULL DEFAULT 'superadmin@opesware.com',
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_enterprise_licenses_status ON platform_enterprise_licenses (status, issued_at DESC);

-- Persisted Platform Broadcasts
CREATE TABLE IF NOT EXISTS platform_broadcasts (
    id VARCHAR(64) PRIMARY KEY,
    channel VARCHAR(24) NOT NULL DEFAULT 'IN_APP',
    audience VARCHAR(80) NOT NULL DEFAULT 'ALL_ACTIVE',
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    recipient_count INT NOT NULL DEFAULT 0,
    dispatched_count INT NOT NULL DEFAULT 0,
    sent_by VARCHAR(180) NOT NULL DEFAULT 'superadmin@opesware.com',
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_platform_broadcasts_sent ON platform_broadcasts (sent_at DESC);

-- Seed baseline records safely for out-of-the-box Support Desk & Licenses visibility
INSERT INTO platform_enterprise_licenses (id, license_key, tenant_id, organization_name, tier_name, max_stations, annual_fee_fcfa, expires_at, status, issued_by)
SELECT 'lic_01', 'OPF-ENT-2026-8841-CMR', 'ten_opes_cm', 'OpesFuel Cameroon Flagship', 'Enterprise On-Premises Perpetual', 25, 5000000, '2027-11-30', 'ACTIVE', 'superadmin@opesware.com'
WHERE NOT EXISTS (SELECT 1 FROM platform_enterprise_licenses WHERE id = 'lic_01');

INSERT INTO platform_support_tickets (id, ticket_number, tenant_id, tenant_name, station_id, requester_email, subject, category, priority, status, assigned_to, sla_due_at)
SELECT 'tkt_seed_01', 'SUP-2026-0101', 'ten_opes_cm', 'OpesFuel Cameroon Flagship', 'st_plateau', 'owner@opesfuel.cm', 'Verify MTN MoMo webhook callback timeout on Station Plateau', 'PAYMENTS_MOMO', 'HIGH', 'OPEN', 'superadmin@opesware.com', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM platform_support_tickets WHERE id = 'tkt_seed_01');

INSERT INTO platform_support_messages (id, ticket_id, sender_email, sender_role, internal_note, body)
SELECT 'tmsg_seed_01', 'tkt_seed_01', 'owner@opesfuel.cm', 'OWNER', FALSE, 'We completed a subscription payment via MTN MoMo Cameroon and would like confirmation that the production callback URL is active on our workspace.'
WHERE NOT EXISTS (SELECT 1 FROM platform_support_messages WHERE id = 'tmsg_seed_01');
