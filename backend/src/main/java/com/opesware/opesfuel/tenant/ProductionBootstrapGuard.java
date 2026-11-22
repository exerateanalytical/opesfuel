package com.opesware.opesfuel.tenant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Production safety guard: when booting with SPRING_PROFILES_ACTIVE=prod on a fresh database
 * where Flyway V2 seeded demo data (ten_opesfuel_cm) and no real customer tenants exist yet,
 * clears fake demo operational rows (shifts, tanks, pumps, fake stations) while preserving
 * the SYSCOHADA Chart of Accounts and Subscription Plans.
 * Set OPESFUEL_CLEAN_DEMO_IN_PROD=false on staging/demo VPS environments to keep demo data.
 */
@Component
@Profile("prod")
public class ProductionBootstrapGuard implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(ProductionBootstrapGuard.class);

    private final JdbcTemplate jdbcTemplate;

    @Value("${opesfuel.demo.clean-on-first-prod-boot:true}")
    private boolean cleanDemoOnFirstProdBoot;

    public ProductionBootstrapGuard(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!cleanDemoOnFirstProdBoot) {
            log.info("OpesFuel PROD bootstrap: OPESFUEL_CLEAN_DEMO_IN_PROD=false — retaining demo dataset.");
            return;
        }
        Integer totalTenants = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM tenants", Integer.class);
        Integer demoTenants = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM tenants WHERE id = 'ten_opesfuel_cm'", Integer.class
        );
        if (totalTenants != null && totalTenants == 1 && demoTenants != null && demoTenants == 1) {
            log.info("OpesFuel PROD bootstrap: purging V2 demo rows for clean production VPS start.");
            String[] tables = {
                "journal_lines", "journal_entries", "expenses", "treasury_deposits",
                "shop_sales", "shop_items", "fleet_transactions", "fleet_vehicles", "fleet_accounts",
                "shift_records", "pumps", "dipstick_readings", "tank_deliveries", "purchase_orders",
                "fuel_tanks", "attendance_logs", "payroll_runs", "employees", "fuel_prices",
                "ai_subscriptions", "stations"
            };
            for (String table : tables) {
                try {
                    jdbcTemplate.update("DELETE FROM " + table);
                } catch (Exception ignored) {
                    // table may not exist in older schemas
                }
            }
            jdbcTemplate.update("DELETE FROM tenants WHERE id = 'ten_opesfuel_cm'");
            log.info("OpesFuel PROD bootstrap complete: database is clean and ready for live customer tenants.");
        }
    }
}
