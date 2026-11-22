-- V22: Holding-company multi-subsidiary consolidation (groups, members, inter-company, eliminations)

CREATE TABLE IF NOT EXISTS holding_groups (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    reporting_currency VARCHAR(8) NOT NULL DEFAULT 'XAF',
    parent_tenant_id VARCHAR(64) NOT NULL,
    created_by VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS holding_group_members (
    id VARCHAR(64) PRIMARY KEY,
    group_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    functional_currency VARCHAR(8) NOT NULL DEFAULT 'XAF',
    ownership_pct DOUBLE PRECISION NOT NULL DEFAULT 100,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_holding_member UNIQUE (group_id, tenant_id)
);

-- Subsidiary period financials (submitted per tenant, in functional currency)
CREATE TABLE IF NOT EXISTS subsidiary_financials (
    id VARCHAR(64) PRIMARY KEY,
    group_id VARCHAR(64) NOT NULL,
    tenant_id VARCHAR(64) NOT NULL,
    period_label VARCHAR(16) NOT NULL,
    revenue DOUBLE PRECISION NOT NULL DEFAULT 0,
    cost_of_sales DOUBLE PRECISION NOT NULL DEFAULT 0,
    operating_expenses DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_assets DOUBLE PRECISION NOT NULL DEFAULT 0,
    total_liabilities DOUBLE PRECISION NOT NULL DEFAULT 0,
    equity DOUBLE PRECISION NOT NULL DEFAULT 0,
    receivables_intercompany DOUBLE PRECISION NOT NULL DEFAULT 0,
    payables_intercompany DOUBLE PRECISION NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_sub_fin UNIQUE (group_id, tenant_id, period_label)
);

CREATE TABLE IF NOT EXISTS intercompany_transactions (
    id VARCHAR(64) PRIMARY KEY,
    group_id VARCHAR(64) NOT NULL,
    period_label VARCHAR(16) NOT NULL,
    seller_tenant_id VARCHAR(64) NOT NULL,
    buyer_tenant_id VARCHAR(64) NOT NULL,
    currency VARCHAR(8) NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    description VARCHAR(300),
    eliminated BOOLEAN NOT NULL DEFAULT FALSE,
    created_by VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS consolidation_elimination_entries (
    id VARCHAR(64) PRIMARY KEY,
    group_id VARCHAR(64) NOT NULL,
    period_label VARCHAR(16) NOT NULL,
    intercompany_tx_id VARCHAR(64) NOT NULL,
    debit_account VARCHAR(64) NOT NULL,
    credit_account VARCHAR(64) NOT NULL,
    amount_reporting DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
