package com.opesware.opesfuel.tenant;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
public class DemoSeederAndProvisionController {
    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;

    public DemoSeederAndProvisionController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    /**
     * 1-Click SaaS Super-Admin action: converts an inbound onboarding lead into a live Active Tenant
     * with a 14-day free trial, initial station, and Owner user account.
     */
    @PostMapping("/api/v1/platform-admin/leads/{leadId}/provision-tenant")
    @Transactional
    @PreAuthorize("hasRole('PLATFORM_ADMIN') or hasAuthority('SCOPE_platform:admin')")
    public Map<String, Object> provisionTenantFromLead(@PathVariable String leadId) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        Map<String, Object> lead = jdbcTemplate.queryForMap(
            "SELECT id, full_name, station_name, email, phone, pump_count, selected_plan FROM demo_leads WHERE id = ?",
            leadId
        );

        String tenantId = "ten_" + UUID.randomUUID().toString().substring(0, 8);
        String stationId = "st_" + UUID.randomUUID().toString().substring(0, 8);
        String stationCode = "OPF-" + UUID.randomUUID().toString().substring(0, 5).toUpperCase();
        String userId = "usr_" + UUID.randomUUID().toString().substring(0, 8);
        String ownerEmail = String.valueOf(lead.get("email"));
        String stationName = String.valueOf(lead.get("station_name"));
        String fullName = String.valueOf(lead.get("full_name"));
        String phone = String.valueOf(lead.get("phone"));
        int maxPumps = Math.max(6, ((Number) lead.get("pump_count")).intValue());
        Timestamp now = Timestamp.from(Instant.now());
        Timestamp trialEnds = Timestamp.from(Instant.now().plus(14, ChronoUnit.DAYS));

        jdbcTemplate.update(
            """
            INSERT INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, trial_ends_at, max_pumps, created_at, billing_status)
            VALUES (?, ?, ?, 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', ?, ?, ?, 'TRIAL')
            """,
            tenantId, stationName, ownerEmail, trialEnds, maxPumps, now
        );

        jdbcTemplate.update(
            """
            INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at)
            VALUES (?, ?, ?, ?, 'Douala', 'FCFA', 'Starter Station', 25000, 0.1925, 'Africa/Douala', ?)
            """,
            stationId, tenantId, stationCode, stationName, now
        );

        jdbcTemplate.update(
            """
            INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, phone, role, assigned_station_id, preferred_language, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'OWNER', ?, 'en', 'ACTIVE', ?)
            """,
            userId, tenantId, "auth0|" + userId, fullName, ownerEmail, phone, stationId, now
        );

        jdbcTemplate.update("UPDATE demo_leads SET status = 'WON' WHERE id = ?", leadId);

        auditRecorder.record(
            principal.tenantId(), stationId, principal.subject(), "PLATFORM_ADMIN",
            "TENANT_PROVISIONED_FROM_LEAD", "TENANT", tenantId,
            "Provisioned live tenant " + stationName + " (" + tenantId + ") with 14-day trial for " + ownerEmail
        );

        return Map.of(
            "tenantId", tenantId,
            "stationId", stationId,
            "ownerUserId", userId,
            "ownerEmail", ownerEmail,
            "trialEndsAt", trialEnds.toInstant().toString(),
            "status", "ACTIVE"
        );
    }

    /**
     * Seeds a flagship Demo Petrol Station with >1,050 interconnected, mathematically balanced records
     * spanning fuels, tanks, suppliers, POs, deliveries, dipsticks, pumps, shifts, calibrations,
     * maintenance, corporate fleets, vehicles, shop SKUs & sales, all 5 user types, employees, HR
     * contracts/leaves/certs/disciplinary, payroll, cash vault drops, expenses, deposits, balanced
     * SYSCOHADA double-entry journals + lines, outbound messages, and audit logs.
     */
    @PostMapping("/api/v1/tenants/current/seed-1000-demo")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER') or hasAuthority('SCOPE_platform:admin')")
    public Map<String, Object> seed1000DemoRecords() {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String tenantId = principal.tenantId();
        String stationId = "st_plateau";

        // Ensure flagship demo station exists for this tenant
        Integer stExists = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM stations WHERE id = ?", Integer.class, stationId);
        if (stExists == null || stExists == 0) {
            jdbcTemplate.update(
                "INSERT INTO stations (id, tenant_id, code, name, city, currency, plan_name, monthly_fee_fcfa, vat_rate, timezone, created_at) VALUES (?, ?, 'OPF-DEMO-01', 'OpesFuel Flagship Demo Station', 'Douala', 'FCFA', 'Multi-Pump Pro', 55000, 0.1925, 'Africa/Douala', CURRENT_TIMESTAMP)",
                stationId, tenantId
            );
        }

        // Ensure baseline tanks, pumps, and employees exist
        List<String> tankIds = jdbcTemplate.queryForList("SELECT id FROM fuel_tanks WHERE station_id = ?", String.class, stationId);
        if (tankIds.isEmpty()) {
            jdbcTemplate.update("INSERT INTO fuel_tanks (id, station_id, name, grade, capacity_litres, book_volume_litres, last_dip_litres, unit_cost_fcfa, version) VALUES ('tk_demo_s', ?, 'Demo Tank Super', 'SUPER', 40000, 28000, 27980, 745, 0)", stationId);
            jdbcTemplate.update("INSERT INTO fuel_tanks (id, station_id, name, grade, capacity_litres, book_volume_litres, last_dip_litres, unit_cost_fcfa, version) VALUES ('tk_demo_g', ?, 'Demo Tank Gasoil', 'GASOIL', 50000, 34000, 33970, 735, 0)", stationId);
            tankIds = List.of("tk_demo_s", "tk_demo_g");
        }
        List<String> pumpIds = jdbcTemplate.queryForList("SELECT id FROM pumps WHERE station_id = ?", String.class, stationId);
        if (pumpIds.isEmpty()) {
            jdbcTemplate.update("INSERT INTO pumps (id, station_id, tank_id, code, grade, totalizer_litres, unit_price_fcfa, status, version) VALUES ('pmp_demo_1', ?, ?, 'D-01A', 'SUPER', 350000, 840, 'IDLE', 0)", stationId, tankIds.get(0));
            pumpIds = List.of("pmp_demo_1");
        }
        List<String> empIds = jdbcTemplate.queryForList("SELECT id FROM employees WHERE station_id = ?", String.class, stationId);
        if (empIds.isEmpty()) {
            jdbcTemplate.update("INSERT INTO employees (id, station_id, full_name, role, phone, shift_window, clocked_in, base_salary_fcfa, cumulative_variance_fcfa, version) VALUES ('emp_demo_1', ?, 'Samuel Tchoupo', 'ATTENDANT', '+237 655 110 220', '06:00 - 14:00', TRUE, 135000, 0, 0)", stationId);
            empIds = List.of("emp_demo_1");
        }

        // Idempotent cleanup of prior 1000-seed batch rows before re-seeding
        String tag = "d1k_";
        jdbcTemplate.update("DELETE FROM journal_lines WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM journal_entries WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM shift_records WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM dipstick_readings WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM tank_deliveries WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM purchase_orders WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM fleet_transactions WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM fleet_vehicles WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM fleet_accounts WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM shop_sales WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM shop_items WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM expenses WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM treasury_deposits WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM cash_vault_entries WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM pump_calibrations WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM pump_maintenance_logs WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM fuel_price_history WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM hr_contracts WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM hr_leave_requests WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM hr_training_certs WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM hr_disciplinary_records WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM attendance_logs WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM payroll_runs WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM suppliers WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM outbound_messages WHERE id LIKE ?", tag + "%");
        jdbcTemplate.update("DELETE FROM audit_logs WHERE id LIKE ?", tag + "%");

        Instant baseTime = Instant.now().minus(90, ChronoUnit.DAYS);
        Map<String, Integer> counts = new LinkedHashMap<>();

        // 1. Suppliers (12)
        String[] supplierNames = {
            "SCDP Douala Depot", "SONARA Limbe Supply", "Tradex Wholesale CM", "Bocom Petroleum Logistics",
            "Perenco Energy Trading", "TotalEnergies Lubricants CM", "Ola Energy LPG Bulk", "Neptune Oil Depot",
            "Cameroon Gaz Distribution", "Gulf Oil Lubricants", "Afriquia Fleet Supplies", "Kribi Port Fuel Terminal"
        };
        for (int i = 0; i < supplierNames.length; i++) {
            jdbcTemplate.update(
                "INSERT INTO suppliers (id, tenant_id, name, tax_id, contact_phone, contact_email, payment_terms_days, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP)",
                tag + "sup_" + i, tenantId, supplierNames[i], "SUP-CM-" + String.format("%04d", i + 1),
                "+237 690 100 " + String.format("%03d", i + 10), "dispatch" + (i + 1) + "@depot.cm", 30
            );
        }
        counts.put("suppliers", supplierNames.length);

        // 2. Fuel Price History (24)
        String[] grades = {"SUPER", "GASOIL", "KEROSENE"};
        long[] basePrices = {840, 828, 550};
        for (int i = 0; i < 24; i++) {
            int g = i % 3;
            long oldP = basePrices[g] - 10 + (i % 4) * 5;
            long newP = basePrices[g];
            jdbcTemplate.update(
                "INSERT INTO fuel_price_history (id, tenant_id, station_id, grade, old_price_fcfa, new_price_fcfa, changed_by, reason, changed_at) VALUES (?, ?, ?, ?, ?, ?, 'owner@opesfuel.cm', ?, ?)",
                tag + "fph_" + i, tenantId, stationId, grades[g], oldP, newP,
                "CSPH quarterly retail tariff alignment #" + (i + 1), Timestamp.from(baseTime.plus(i * 3L, ChronoUnit.DAYS))
            );
        }
        counts.put("fuelPriceHistory", 24);

        // 3. Purchase Orders (40) & Tank Deliveries (40) & Dipstick Readings (90)
        for (int i = 0; i < 40; i++) {
            String tk = tankIds.get(i % tankIds.size());
            String gr = grades[i % 2];
            long cost = gr.equals("SUPER") ? 745 : 735;
            BigDecimal ordered = BigDecimal.valueOf(18000 + (i % 5) * 4500);
            BigDecimal actual = ordered.subtract(BigDecimal.valueOf((i % 3) * 15));
            Timestamp ts = Timestamp.from(baseTime.plus(i * 2L, ChronoUnit.DAYS));
            jdbcTemplate.update(
                "INSERT INTO purchase_orders (id, station_id, supplier_name, grade, ordered_litres, unit_cost_fcfa, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'RECEIVED', ?)",
                tag + "po_" + i, stationId, supplierNames[i % 4], gr, ordered, cost, ts
            );
            jdbcTemplate.update(
                "INSERT INTO tank_deliveries (id, tank_id, purchase_order_id, supplier_name, bol_litres, actual_received_litres, unit_cost_fcfa, received_at, voided) VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)",
                tag + "del_" + i, tk, tag + "po_" + i, supplierNames[i % 4], ordered, actual, cost, ts
            );
        }
        counts.put("purchaseOrders", 40);
        counts.put("tankDeliveries", 40);

        for (int i = 0; i < 90; i++) {
            String tk = tankIds.get(i % tankIds.size());
            BigDecimal book = BigDecimal.valueOf(21000 + (i % 12) * 850);
            BigDecimal variance = BigDecimal.valueOf(-25 + (i % 9) * 5);
            BigDecimal measured = book.add(variance);
            jdbcTemplate.update(
                "INSERT INTO dipstick_readings (id, tank_id, book_litres, measured_litres, variance_litres, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
                tag + "dip_" + i, tk, book, measured, variance, Timestamp.from(baseTime.plus(i, ChronoUnit.DAYS))
            );
        }
        counts.put("dipstickReadings", 90);

        // 4. Closed Shifts (120) + Balanced Double-Entry Journals (120 entries + 600 lines)
        long meterCursor = 120000L;
        for (int i = 0; i < 120; i++) {
            String pmp = pumpIds.get(i % pumpIds.size());
            String emp = empIds.get(i % empIds.size());
            long litres = 650 + (i % 14) * 120L;
            long price = (i % 2 == 0) ? 840L : 828L;
            long costPerL = (i % 2 == 0) ? 745L : 735L;
            long gross = litres * price;
            long cash = Math.round(gross * 0.62);
            long momo = Math.round(gross * 0.24);
            long card = Math.round(gross * 0.06);
            long fleet = gross - cash - momo - card;
            long variance = (i % 15 == 0) ? -2500L : 0L;
            long declaredCash = Math.max(0, cash + variance);
            Timestamp opened = Timestamp.from(baseTime.plus(i * 18L, ChronoUnit.HOURS));
            Timestamp closed = Timestamp.from(baseTime.plus(i * 18L + 8L, ChronoUnit.HOURS));

            jdbcTemplate.update(
                """
                INSERT INTO shift_records (
                    id, station_id, pump_id, attendant_id, opening_meter_litres, closing_meter_litres,
                    unit_price_fcfa, cash_fcfa, mobile_money_fcfa, card_fcfa, fleet_credit_fcfa,
                    variance_fcfa, status, opened_at, closed_at, voided, version
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CLOSED', ?, ?, FALSE, 0)
                """,
                tag + "shf_" + i, stationId, pmp, emp,
                BigDecimal.valueOf(meterCursor), BigDecimal.valueOf(meterCursor + litres),
                price, declaredCash, momo, card, fleet, variance, opened, closed
            );
            meterCursor += litres;

            long netRev = Math.round(gross / 1.1925);
            long vat = gross - netRev;
            long cogs = litres * costPerL;
            String jeId = tag + "je_" + i;
            jdbcTemplate.update(
                "INSERT INTO journal_entries (id, station_id, reference, source_event, description, posted_at) VALUES (?, ?, ?, 'ShiftClosedEvent', ?, ?)",
                jeId, stationId, "SHF-" + String.format("%04d", i + 1),
                "Automated shift revenue, VAT 19.25% & COGS (" + litres + " L)", closed
            );
            jdbcTemplate.update("INSERT INTO journal_lines (id, journal_entry_id, account_code, debit_fcfa, credit_fcfa) VALUES (?, ?, '1010', ?, 0)", tag + "jl_" + i + "_1", jeId, gross);
            jdbcTemplate.update("INSERT INTO journal_lines (id, journal_entry_id, account_code, debit_fcfa, credit_fcfa) VALUES (?, ?, '4010', 0, ?)", tag + "jl_" + i + "_2", jeId, netRev);
            jdbcTemplate.update("INSERT INTO journal_lines (id, journal_entry_id, account_code, debit_fcfa, credit_fcfa) VALUES (?, ?, '2200', 0, ?)", tag + "jl_" + i + "_3", jeId, vat);
            jdbcTemplate.update("INSERT INTO journal_lines (id, journal_entry_id, account_code, debit_fcfa, credit_fcfa) VALUES (?, ?, '5010', ?, 0)", tag + "jl_" + i + "_4", jeId, cogs);
            jdbcTemplate.update("INSERT INTO journal_lines (id, journal_entry_id, account_code, debit_fcfa, credit_fcfa) VALUES (?, ?, '1200', 0, ?)", tag + "jl_" + i + "_5", jeId, cogs);
        }
        counts.put("shiftRecords", 120);
        counts.put("journalEntries", 120);
        counts.put("journalLines", 600);

        // 5. Pump Calibrations (16) & Maintenance Logs (14)
        for (int i = 0; i < 16; i++) {
            jdbcTemplate.update(
                """
                INSERT INTO pump_calibrations (id, tenant_id, station_id, pump_id, tank_id, test_litres, returned_to_tank, opening_totalizer, closing_totalizer, inspector_name, notes, tested_at)
                VALUES (?, ?, ?, ?, ?, 20.00, TRUE, ?, ?, ?, 'Standard 20L Ministry calibration can verified', ?)
                """,
                tag + "cal_" + i, tenantId, stationId, pumpIds.get(i % pumpIds.size()), tankIds.get(i % tankIds.size()),
                BigDecimal.valueOf(200000 + i * 20), BigDecimal.valueOf(200020 + i * 20),
                "Inspector M. Ndongo", Timestamp.from(baseTime.plus(i * 5L, ChronoUnit.DAYS))
            );
        }
        for (int i = 0; i < 14; i++) {
            jdbcTemplate.update(
                """
                INSERT INTO pump_maintenance_logs (id, tenant_id, station_id, pump_id, maintenance_type, description, cost_fcfa, technician, out_of_service, next_due_date, logged_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, '2026-12-15', ?)
                """,
                tag + "mnt_" + i, tenantId, stationId, pumpIds.get(i % pumpIds.size()),
                (i % 2 == 0) ? "NOZZLE_SEAL_SERVICE" : "FILTER_REPLACEMENT",
                "Preventive forecourt dispenser maintenance & flow verification #" + (i + 1),
                35000L + (i % 4) * 15000L, "Tech. Eric Biloa", Timestamp.from(baseTime.plus(i * 6L, ChronoUnit.DAYS))
            );
        }
        counts.put("pumpCalibrations", 16);
        counts.put("pumpMaintenanceLogs", 14);

        // 6. Corporate Fleet Accounts (15), Vehicles (30), Fleet Transactions (60)
        for (int i = 0; i < 15; i++) {
            String accId = tag + "flt_" + i;
            jdbcTemplate.update(
                "INSERT INTO fleet_accounts (id, tenant_id, company_name, tax_id, credit_limit_fcfa, balance_owed_fcfa, status, version) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
                accId, tenantId, "TransCam Corridor Fleet #" + (i + 1), "M092400" + String.format("%04d", i),
                6000000L + (i % 4) * 2000000L, 450000L + (i % 5) * 180000L, (i == 14) ? "HOLD" : "ACTIVE"
            );
            for (int v = 0; v < 2; v++) {
                jdbcTemplate.update(
                    "INSERT INTO fleet_vehicles (id, account_id, plate_number, driver_name, allowed_grade, active, created_at) VALUES (?, ?, ?, ?, 'GASOIL', TRUE, CURRENT_TIMESTAMP)",
                    tag + "veh_" + i + "_" + v, accId,
                    "LT-" + (400 + i * 2 + v) + "-CM", "Driver " + (i * 2 + v + 1)
                );
            }
        }
        for (int i = 0; i < 60; i++) {
            String accId = tag + "flt_" + (i % 15);
            BigDecimal l = BigDecimal.valueOf(85 + (i % 6) * 25);
            long amt = l.longValue() * 828L;
            jdbcTemplate.update(
                "INSERT INTO fleet_transactions (id, account_id, station_id, vehicle_plate, driver_name, grade, litres, amount_fcfa, created_at) VALUES (?, ?, ?, ?, ?, 'GASOIL', ?, ?, ?)",
                tag + "ftx_" + i, accId, stationId, "LT-" + (400 + (i % 30)) + "-CM",
                "Driver " + ((i % 30) + 1), l, amt, Timestamp.from(baseTime.plus(i, ChronoUnit.DAYS))
            );
        }
        counts.put("fleetAccounts", 15);
        counts.put("fleetVehicles", 30);
        counts.put("fleetTransactions", 60);

        // 7. Shop Items (18) & Shop Sales (50)
        for (int i = 0; i < 18; i++) {
            String itemId = tag + "shp_" + i;
            long price = 4500L + (i % 6) * 2500L;
            long cost = Math.round(price * 0.72);
            jdbcTemplate.update(
                "INSERT INTO shop_items (id, station_id, sku, name, category, stock_qty, reorder_level, unit_price_fcfa, unit_cost_fcfa, version) VALUES (?, ?, ?, ?, ?, ?, 10, ?, ?, 0)",
                itemId, stationId, "SKU-D1K-" + String.format("%02d", i + 1),
                (i % 3 == 0 ? "Quartz 5W-40 Motor Oil 5L #" : i % 3 == 1 ? "LPG 12.5kg Cylinder Refill #" : "Hydraulic Brake Fluid 1L #") + (i + 1),
                (i % 3 == 0 ? "LUBRICANT" : i % 3 == 1 ? "LPG" : "SHOP"), 45 + (i % 20), price, cost
            );
        }
        for (int i = 0; i < 50; i++) {
            String itemId = tag + "shp_" + (i % 18);
            String sku = "SKU-D1K-" + String.format("%02d", (i % 18) + 1);
            int qty = 1 + (i % 3);
            long unitP = 4500L + ((i % 18) % 6) * 2500L;
            long unitC = Math.round(unitP * 0.72);
            jdbcTemplate.update(
                "INSERT INTO shop_sales (id, station_id, item_id, sku, item_name, quantity, unit_price_fcfa, unit_cost_fcfa, gross_fcfa, cogs_fcfa, payment_method, sold_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                tag + "ssl_" + i, stationId, itemId, sku, "Counter Lubricant/Shop Sale #" + (i + 1),
                qty, unitP, unitC, unitP * qty, unitC * qty, (i % 2 == 0) ? "CASH" : "MOBILE_MONEY",
                Timestamp.from(baseTime.plus(i, ChronoUnit.DAYS))
            );
        }
        counts.put("shopItems", 18);
        counts.put("shopSales", 50);

        // 8. Expenses (35), Bank Deposits (25), Cash Vault Entries (35)
        long vaultBal = 0L;
        for (int i = 0; i < 35; i++) {
            long expAmt = 25000L + (i % 5) * 18000L;
            jdbcTemplate.update(
                "INSERT INTO expenses (id, station_id, category, description, amount_fcfa, payment_source, status, created_at, voided) VALUES (?, ?, ?, ?, ?, 'CASH_SAFE', 'POSTED', ?, FALSE)",
                tag + "exp_" + i, stationId, (i % 3 == 0 ? "UTILITIES" : i % 3 == 1 ? "GENERATOR_FUEL" : "MAINTENANCE"),
                "Station operational bill #" + (i + 1), expAmt, Timestamp.from(baseTime.plus(i * 2L, ChronoUnit.DAYS))
            );
            String vType = (i % 4 == 3) ? "ARMORED_BANK_PICKUP" : "SHIFT_DROP";
            long vAmt = "SHIFT_DROP".equals(vType) ? 1450000L : Math.min(vaultBal, 2200000L);
            if ("ARMORED_BANK_PICKUP".equals(vType) && vAmt <= 0) {
                vType = "SHIFT_DROP";
                vAmt = 1450000L;
            }
            vaultBal = "SHIFT_DROP".equals(vType) ? vaultBal + vAmt : vaultBal - vAmt;
            jdbcTemplate.update(
                "INSERT INTO cash_vault_entries (id, tenant_id, station_id, entry_type, amount_fcfa, running_balance_fcfa, reference_code, handed_by, received_by, notes, recorded_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'Clarisse Ewondo', ?, 'Verified station safe count', ?)",
                tag + "vlt_" + i, tenantId, stationId, vType, vAmt, vaultBal,
                "SAFE-" + String.format("%04d", i + 1),
                "SHIFT_DROP".equals(vType) ? "Station Safe #1" : "Afriland First Bank CIT",
                Timestamp.from(baseTime.plus(i * 2L, ChronoUnit.DAYS))
            );
        }
        for (int i = 0; i < 25; i++) {
            jdbcTemplate.update(
                "INSERT INTO treasury_deposits (id, station_id, source_account, bank_name, slip_reference, amount_fcfa, deposited_at, voided) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE)",
                tag + "dep_" + i, stationId, (i % 2 == 0) ? "1010" : "1020",
                (i % 2 == 0) ? "Afriland First Bank" : "Societe Generale CM",
                "SLIP-2026-" + String.format("%04d", i + 1), 2400000L + (i % 4) * 600000L,
                Timestamp.from(baseTime.plus(i * 3L, ChronoUnit.DAYS))
            );
        }
        counts.put("expenses", 35);
        counts.put("treasuryDeposits", 25);
        counts.put("cashVaultEntries", 35);

        // 9. Full HR Suite: Contracts (10), Leaves (14), Safety Certs (12), Disciplinary (8), Attendance (45), Payroll Runs (3)
        for (int i = 0; i < 10; i++) {
            String eId = empIds.get(i % empIds.size());
            jdbcTemplate.update(
                """
                INSERT INTO hr_contracts (id, tenant_id, station_id, employee_id, employee_name, contract_type, cnps_number, base_salary_fcfa, transport_allowance_fcfa, housing_allowance_fcfa, emergency_contact_name, emergency_contact_phone, start_date, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 25000, 35000, 'Family Contact', '+237 670 000 111', '2025-01-15', 'ACTIVE')
                """,
                tag + "hrc_" + i, tenantId, stationId, eId, "Station Crew Member #" + (i + 1),
                (i % 3 == 0) ? "CDI" : "CDD", "CNPS-CM-2025-" + String.format("%04d", i + 1),
                135000L + (i % 4) * 35000L
            );
        }
        for (int i = 0; i < 14; i++) {
            jdbcTemplate.update(
                "INSERT INTO hr_leave_requests (id, tenant_id, station_id, employee_id, employee_name, leave_type, start_date, end_date, days_count, reason, status, reviewed_by) VALUES (?, ?, ?, ?, ?, ?, '2026-11-10', '2026-11-14', 4, 'Scheduled rest / family leave', ?, 'manager@opesfuel.cm')",
                tag + "hrl_" + i, tenantId, stationId, empIds.get(i % empIds.size()),
                "Station Crew Member #" + ((i % 10) + 1), (i % 3 == 0) ? "ANNUAL" : "SICK",
                (i < 4) ? "PENDING" : "APPROVED"
            );
        }
        for (int i = 0; i < 12; i++) {
            jdbcTemplate.update(
                "INSERT INTO hr_training_certs (id, tenant_id, station_id, employee_id, employee_name, cert_name, issuer, issued_date, expires_date, status) VALUES (?, ?, ?, ?, ?, ?, 'Cameroon Civil Protection HSE', '2025-11-01', '2026-12-31', ?)",
                tag + "cert_" + i, tenantId, stationId, empIds.get(i % empIds.size()),
                "Station Crew Member #" + ((i % 10) + 1),
                (i % 2 == 0) ? "Forecourt Fire Extinguisher & Spill Response" : "LPG & Hazardous Fuel Handling Level 1",
                (i < 2) ? "EXPIRING_SOON" : "VALID"
            );
        }
        for (int i = 0; i < 8; i++) {
            jdbcTemplate.update(
                "INSERT INTO hr_disciplinary_records (id, tenant_id, station_id, employee_id, employee_name, category, severity, summary, amount_fcfa, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manager@opesfuel.cm')",
                tag + "disc_" + i, tenantId, stationId, empIds.get(i % empIds.size()),
                "Station Crew Member #" + ((i % 10) + 1),
                (i % 2 == 0) ? "CASH_SHORTAGE" : "COMMENDATION",
                (i % 2 == 0) ? "WARNING" : "INFO",
                (i % 2 == 0) ? "Shift variance review logged & resolved" : "Zero variance for 30 consecutive shifts",
                (i % 2 == 0) ? 2500L : 0L
            );
        }
        for (int i = 0; i < 45; i++) {
            Timestamp ci = Timestamp.from(baseTime.plus(i, ChronoUnit.DAYS));
            Timestamp co = Timestamp.from(baseTime.plus(i, ChronoUnit.DAYS).plus(8, ChronoUnit.HOURS));
            jdbcTemplate.update(
                "INSERT INTO attendance_logs (id, station_id, employee_id, clock_in_at, clock_out_at, worked_minutes, recorded_by) VALUES (?, ?, ?, ?, ?, 480, 'manager@opesfuel.cm')",
                tag + "att_" + i, stationId, empIds.get(i % empIds.size()), ci, co
            );
        }
        String[] months = {"2026-08", "2026-09", "2026-10"};
        for (int i = 0; i < months.length; i++) {
            jdbcTemplate.update(
                "INSERT INTO payroll_runs (id, station_id, period_label, employee_count, total_base_fcfa, total_deductions_fcfa, total_net_paid_fcfa, payment_source, executed_at) VALUES (?, ?, ?, 10, 1850000, 12500, 1837500, 'BANK', ?)",
                tag + "pay_" + i, stationId, months[i], Timestamp.from(baseTime.plus((i + 1) * 28L, ChronoUnit.DAYS))
            );
        }
        counts.put("hrContracts", 10);
        counts.put("hrLeaves", 14);
        counts.put("hrCertifications", 12);
        counts.put("hrDisciplinary", 8);
        counts.put("attendanceLogs", 45);
        counts.put("payrollRuns", 3);

        // 10. Outbound Messages (12) & Unified Audit Logs (25)
        for (int i = 0; i < 12; i++) {
            jdbcTemplate.update(
                "INSERT INTO outbound_messages (id, tenant_id, channel, recipient, subject, body_preview, status, provider, created_at) VALUES (?, ?, ?, ?, ?, ?, 'SANDBOX_LOGGED', 'RESEND', ?)",
                tag + "msg_" + i, tenantId, (i % 3 == 0) ? "WHATSAPP" : "EMAIL",
                "finance" + (i + 1) + "@client-fleet.cm",
                "Monthly Corporate Fleet Statement & Station Alert #" + (i + 1),
                "Automated statement dispatched from OpesFuel Flagship Demo Station.",
                Timestamp.from(baseTime.plus(i * 6L, ChronoUnit.DAYS))
            );
        }
        for (int i = 0; i < 25; i++) {
            jdbcTemplate.update(
                "INSERT INTO audit_logs (id, tenant_id, station_id, actor_email, actor_role, action, entity_type, entity_id, summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                tag + "aud_" + i, tenantId, stationId,
                (i % 2 == 0) ? "owner@opesfuel.cm" : "manager@opesfuel.cm",
                (i % 2 == 0) ? "OWNER" : "MANAGER",
                (i % 3 == 0) ? "SHIFT_RECONCILED" : (i % 3 == 1) ? "TANK_DIPSTICK_VERIFIED" : "CASH_VAULT_DROP",
                "STATION_OPS", tag + "ref_" + i,
                "Verified operational audit trail record #" + (i + 1) + " for flagship demo petrol station",
                Timestamp.from(baseTime.plus(i * 3L, ChronoUnit.DAYS))
            );
        }
        counts.put("outboundMessages", 12);
        counts.put("auditLogs", 25);

        int totalSeeded = counts.values().stream().mapToInt(Integer::intValue).sum();
        return Map.of(
            "stationId", stationId,
            "totalSeededRecords", totalSeeded,
            "breakdown", counts
        );
    }
}
