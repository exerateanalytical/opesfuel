package com.opesware.opesfuel.tenant;

import com.opesware.opesfuel.OpesFuelApplication;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(classes = OpesFuelApplication.class)
@ActiveProfiles("test")
class PlatformAdminBootstrapTests {

    @Autowired JdbcTemplate jdbc;

    private void fixtures() {
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS user_accounts (
                id VARCHAR(64) PRIMARY KEY, tenant_id VARCHAR(64) NOT NULL, auth0_sub VARCHAR(128) NOT NULL,
                full_name VARCHAR(160) NOT NULL, email VARCHAR(180) NOT NULL, phone VARCHAR(64),
                role VARCHAR(32) NOT NULL, assigned_station_id VARCHAR(64), preferred_language VARCHAR(8) DEFAULT 'en',
                email_alerts_enabled BOOLEAN DEFAULT TRUE, status VARCHAR(24) DEFAULT 'ACTIVE',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )""");
        jdbc.update("DELETE FROM user_accounts WHERE id = 'usr_platform_admin'");
        jdbc.update("DELETE FROM tenants WHERE id = 'ten_opes_cm'");
        jdbc.update("INSERT INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at) "
            + "VALUES ('ten_opes_cm', 'Operator', 'o@x.com', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)");
    }

    @Test
    void setsOrCreatesThePlatformAdminLoginAndIsIdempotent() {
        fixtures();
        jdbc.update("INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, role, status) "
            + "VALUES ('usr_platform_admin', 'ten_opes_cm', 'auth0|platform_admin', 'Seed', 'admin@opesware.com', 'PLATFORM_ADMIN', 'DISABLED')");
        new PlatformAdminBootstrap(jdbc, "  Boss@Example.com ").run(null);
        new PlatformAdminBootstrap(jdbc, "boss@example.com").run(null);
        assertEquals("boss@example.com", jdbc.queryForObject("SELECT email FROM user_accounts WHERE id='usr_platform_admin'", String.class));
        assertEquals("ACTIVE", jdbc.queryForObject("SELECT status FROM user_accounts WHERE id='usr_platform_admin'", String.class));
        assertEquals("pending|usr_platform_admin", jdbc.queryForObject("SELECT auth0_sub FROM user_accounts WHERE id='usr_platform_admin'", String.class));

        jdbc.update("DELETE FROM user_accounts WHERE id = 'usr_platform_admin'");
        new PlatformAdminBootstrap(jdbc, "boss@example.com").run(null);
        assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM user_accounts WHERE id='usr_platform_admin'", Integer.class));
    }

    @Test
    void doesNothingWhenNotConfigured() {
        fixtures();
        new PlatformAdminBootstrap(jdbc, "").run(null);
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM user_accounts WHERE id='usr_platform_admin'", Integer.class));
    }
}
