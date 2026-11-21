-- Seed initial OpesFuel FCFA stations, tanks, pumps, staff, fleet accounts, and shop SKUs

INSERT INTO stations (id, code, name, city, currency, plan_name, monthly_fee_fcfa) VALUES
    ('st_plateau', 'OPF-DLA-01', 'OpesFuel Bonanjo Plateau', 'Douala', 'FCFA', 'Multi-Pump Pro', 55000),
    ('st_bastos', 'OPF-YDE-02', 'OpesFuel Bastos Express', 'Yaounde', 'FCFA', 'Starter Station', 25000);

INSERT INTO fuel_prices (id, station_id, grade, price_per_litre_fcfa) VALUES
    ('fp_01', 'st_plateau', 'SUPER', 840),
    ('fp_02', 'st_plateau', 'GASOIL', 828),
    ('fp_03', 'st_plateau', 'KEROSENE', 550);

INSERT INTO fuel_tanks (id, station_id, name, grade, capacity_litres, book_volume_litres, last_dip_litres, unit_cost_fcfa) VALUES
    ('tk_01', 'st_plateau', 'Underground Tank T-01 (Super)', 'SUPER', 35000.00, 24680.00, 24645.00, 745),
    ('tk_02', 'st_plateau', 'Underground Tank T-02 (Gasoil)', 'GASOIL', 45000.00, 31200.00, 31180.00, 735),
    ('tk_03', 'st_plateau', 'Underground Tank T-03 (Kerosene)', 'KEROSENE', 15000.00, 2450.00, 2370.00, 470),
    ('tk_04', 'st_bastos', 'Underground Tank B-01 (Super)', 'SUPER', 30000.00, 19400.00, 19390.00, 745);

INSERT INTO pumps (id, station_id, tank_id, code, grade, totalizer_litres, unit_price_fcfa, status) VALUES
    ('pmp_01', 'st_plateau', 'tk_01', 'P-01A', 'SUPER', 484210.00, 840, 'ACTIVE_SHIFT'),
    ('pmp_02', 'st_plateau', 'tk_02', 'P-02A', 'GASOIL', 612940.00, 828, 'ACTIVE_SHIFT'),
    ('pmp_03', 'st_plateau', 'tk_01', 'P-03B', 'SUPER', 298120.00, 840, 'IDLE'),
    ('pmp_04', 'st_plateau', 'tk_03', 'P-04K', 'KEROSENE', 114300.00, 550, 'IDLE'),
    ('pmp_05', 'st_bastos', 'tk_04', 'B-01A', 'SUPER', 205400.00, 840, 'IDLE');

INSERT INTO employees (id, station_id, full_name, role, phone, shift_window, clocked_in, base_salary_fcfa, cumulative_variance_fcfa) VALUES
    ('emp_01', 'st_plateau', 'Koffi Mensah', 'ATTENDANT', '+237 677 12 45 90', '06:00 - 14:00', TRUE, 145000, -2500),
    ('emp_02', 'st_plateau', 'Samuel Etoundi', 'ATTENDANT', '+237 699 44 10 21', '06:00 - 14:00', TRUE, 145000, 0),
    ('emp_03', 'st_plateau', 'Amina Diallo', 'MANAGER', '+237 655 81 09 32', '07:30 - 17:30', TRUE, 320000, 0),
    ('emp_04', 'st_plateau', 'Clarisse Ndiaye', 'ACCOUNTANT', '+237 670 33 78 15', '08:00 - 17:00', TRUE, 360000, 0);

INSERT INTO fleet_accounts (id, company_name, tax_id, credit_limit_fcfa, balance_owed_fcfa, status) VALUES
    ('flt_01', 'TransCameroun Logistics SA', 'M041200918442K', 5000000, 1420000, 'ACTIVE'),
    ('flt_02', 'Societe Agro-Express SARL', 'M081700441209B', 2500000, 685000, 'ACTIVE');

INSERT INTO shop_items (id, station_id, sku, name, category, stock_qty, reorder_level, unit_price_fcfa) VALUES
    ('sku_01', 'st_plateau', 'LUB-15W40-5L', 'OpesLube Heavy Duty 15W40 (5L)', 'LUBRICANT', 42, 12, 18500),
    ('sku_02', 'st_plateau', 'LUB-5W30-1L', 'Synthetic Motor Oil 5W30 (1L)', 'LUBRICANT', 68, 20, 6500),
    ('sku_03', 'st_plateau', 'LPG-12KG', 'Domestic Cooking Gas Refill 12.5kg', 'LPG', 19, 15, 6500);
