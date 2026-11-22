-- V13: SaaS Platform Admin Global Settings, Editable Plan Pricing, Per-Tenant Feature Flags & Operator Directory (Email / Phone / Member ID)

CREATE TABLE IF NOT EXISTS platform_global_settings (
    id VARCHAR(32) PRIMARY KEY,
    xaf_per_usd_rate DOUBLE PRECISION NOT NULL DEFAULT 605.0,
    default_trial_days INT NOT NULL DEFAULT 14,
    grace_period_days INT NOT NULL DEFAULT 7,
    self_signup_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    maintenance_banner VARCHAR(300) DEFAULT '',
    ai_addon_monthly_fcfa BIGINT NOT NULL DEFAULT 30000,
    perpetual_license_annual_fcfa BIGINT NOT NULL DEFAULT 5000000,
    updated_by VARCHAR(128),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS platform_subscription_plans (
    plan_code VARCHAR(32) PRIMARY KEY,
    plan_name VARCHAR(120) NOT NULL,
    monthly_price_fcfa BIGINT NOT NULL,
    monthly_price_usd DOUBLE PRECISION NOT NULL,
    max_stations INT NOT NULL,
    max_pumps INT NOT NULL,
    trial_days INT NOT NULL DEFAULT 14,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
    tenant_id VARCHAR(64) PRIMARY KEY,
    ai_copilot_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    hardware_bridge_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ocpp_ev_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    b2b_wholesale_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    franchise_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    white_label_branding_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    custom_monthly_override_fcfa BIGINT,
    updated_by VARCHAR(128),
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operator_directory_credentials (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    member_id VARCHAR(40) NOT NULL UNIQUE,
    email VARCHAR(160) NOT NULL UNIQUE,
    phone_number VARCHAR(40) NOT NULL UNIQUE,
    full_name VARCHAR(140) NOT NULL,
    role VARCHAR(32) NOT NULL,
    station_id VARCHAR(64),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
