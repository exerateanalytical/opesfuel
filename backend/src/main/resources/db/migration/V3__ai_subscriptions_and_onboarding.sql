-- V3: AI Paid Copilot Add-On Subscriptions & Station Institutional Onboarding Milestones

CREATE TABLE ai_subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL UNIQUE REFERENCES stations(id) ON DELETE CASCADE,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    plan_code VARCHAR(48) NOT NULL DEFAULT 'AI_COPILOT_ADDON',
    monthly_fee_fcfa BIGINT NOT NULL DEFAULT 25000,
    activated_at TIMESTAMPTZ
);

CREATE TABLE station_onboarding_steps (
    id VARCHAR(64) PRIMARY KEY,
    station_id VARCHAR(64) NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    step_key VARCHAR(64) NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (station_id, step_key)
);

CREATE TABLE institutional_fuel_catalog (
    grade VARCHAR(32) PRIMARY KEY,
    label VARCHAR(120) NOT NULL,
    category VARCHAR(32) NOT NULL,
    unit_label VARCHAR(24) NOT NULL DEFAULT 'Litres',
    default_capacity_litres NUMERIC(12, 2) NOT NULL,
    default_opening_litres NUMERIC(12, 2) NOT NULL,
    default_unit_cost_fcfa BIGINT NOT NULL,
    default_selling_price_fcfa BIGINT NOT NULL
);

INSERT INTO institutional_fuel_catalog (
    grade, label, category, unit_label, default_capacity_litres, default_opening_litres, default_unit_cost_fcfa, default_selling_price_fcfa
) VALUES
    ('SUPER', 'Super Petrol (SP95)', 'LIQUID_FUEL', 'Litres', 40000.00, 24500.00, 642, 840),
    ('GASOIL', 'Diesel / Gasoil', 'LIQUID_FUEL', 'Litres', 50000.00, 31000.00, 615, 828),
    ('KEROSENE', 'Kerosene / Petrole Lampant', 'LIQUID_FUEL', 'Litres', 20000.00, 11200.00, 410, 535),
    ('LPG_BULK', 'LPG Autogas / Gaz GPL', 'GASEOUS_FUEL', 'Litres', 15000.00, 8500.00, 445, 620),
    ('HEAVY_FUEL', 'Heavy Fuel / Generator Diesel', 'INDUSTRIAL_FUEL', 'Litres', 30000.00, 14000.00, 560, 765)
ON CONFLICT (grade) DO NOTHING;
