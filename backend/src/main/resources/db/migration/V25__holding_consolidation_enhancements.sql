-- V25: Holding-Company Consolidation Enhancements (Subsidiary Display Metadata & Baseline Holding Group Seed)

ALTER TABLE holding_group_members ADD COLUMN IF NOT EXISTS entity_name VARCHAR(180);
ALTER TABLE holding_group_members ADD COLUMN IF NOT EXISTS country_label VARCHAR(80);

-- Seed baseline Holding Group safely if not already present
INSERT INTO holding_groups (id, name, reporting_currency, parent_tenant_id, created_by)
SELECT 'hgrp_default', 'OpesEnergy Central & West Africa Holding SA', 'XAF', 'ten_opes_cm', 'group.cfo@opesfuel.com'
WHERE NOT EXISTS (SELECT 1 FROM holding_groups WHERE id = 'hgrp_default');

INSERT INTO holding_group_members (id, group_id, tenant_id, functional_currency, ownership_pct, entity_name, country_label)
SELECT 'hmem_cm_01', 'hgrp_default', 'ten_opes_cm', 'XAF', 100.0, 'OpesFuel Cameroun SA', 'CM (CEMAC)'
WHERE NOT EXISTS (SELECT 1 FROM holding_group_members WHERE group_id = 'hgrp_default' AND tenant_id = 'ten_opes_cm');

INSERT INTO holding_group_members (id, group_id, tenant_id, functional_currency, ownership_pct, entity_name, country_label)
SELECT 'hmem_sn_01', 'hgrp_default', 'ten_opes_sn', 'XOF', 80.0, 'OpesFuel Senegal SA', 'SN (UEMOA)'
WHERE NOT EXISTS (SELECT 1 FROM holding_group_members WHERE group_id = 'hgrp_default' AND tenant_id = 'ten_opes_sn');

INSERT INTO holding_group_members (id, group_id, tenant_id, functional_currency, ownership_pct, entity_name, country_label)
SELECT 'hmem_lr_01', 'hgrp_default', 'ten_opes_lr', 'USD', 100.0, 'OpesFuel Liberia Corp', 'LR (USD)'
WHERE NOT EXISTS (SELECT 1 FROM holding_group_members WHERE group_id = 'hgrp_default' AND tenant_id = 'ten_opes_lr');

-- Seed baseline period financials for 2026-11
INSERT INTO subsidiary_financials (
    id, group_id, tenant_id, period_label, revenue, cost_of_sales, operating_expenses,
    total_assets, total_liabilities, equity, receivables_intercompany, payables_intercompany
)
SELECT 'sfin_cm_202611', 'hgrp_default', 'ten_opes_cm', '2026-11',
       185000000, 148000000, 16500000, 420000000, 155000000, 265000000, 14500000, 0
WHERE NOT EXISTS (SELECT 1 FROM subsidiary_financials WHERE group_id = 'hgrp_default' AND tenant_id = 'ten_opes_cm' AND period_label = '2026-11');

INSERT INTO subsidiary_financials (
    id, group_id, tenant_id, period_label, revenue, cost_of_sales, operating_expenses,
    total_assets, total_liabilities, equity, receivables_intercompany, payables_intercompany
)
SELECT 'sfin_sn_202611', 'hgrp_default', 'ten_opes_sn', '2026-11',
       94000000, 74200000, 9800000, 210000000, 82000000, 128000000, 0, 14500000
WHERE NOT EXISTS (SELECT 1 FROM subsidiary_financials WHERE group_id = 'hgrp_default' AND tenant_id = 'ten_opes_sn' AND period_label = '2026-11');

INSERT INTO subsidiary_financials (
    id, group_id, tenant_id, period_label, revenue, cost_of_sales, operating_expenses,
    total_assets, total_liabilities, equity, receivables_intercompany, payables_intercompany
)
SELECT 'sfin_lr_202611', 'hgrp_default', 'ten_opes_lr', '2026-11',
       112000, 86000, 12000, 340000, 110000, 230000, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM subsidiary_financials WHERE group_id = 'hgrp_default' AND tenant_id = 'ten_opes_lr' AND period_label = '2026-11');

INSERT INTO intercompany_transactions (
    id, group_id, period_label, seller_tenant_id, buyer_tenant_id, currency, amount, description, eliminated, created_by
)
SELECT 'ictx_seed_01', 'hgrp_default', '2026-11', 'ten_opes_cm', 'ten_opes_sn', 'XAF',
       14500000, 'Bulk Gasoil Coastal Transfer (Douala Depot -> Dakar Terminal)', FALSE, 'group.cfo@opesfuel.com'
WHERE NOT EXISTS (SELECT 1 FROM intercompany_transactions WHERE id = 'ictx_seed_01');
