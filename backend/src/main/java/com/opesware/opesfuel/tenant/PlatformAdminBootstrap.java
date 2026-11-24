package com.opesware.opesfuel.tenant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Sets the real platform-admin login without touching the database by hand.
 * Set OPESFUEL_BOOTSTRAP_ADMIN_EMAIL to the address you will sign in with (Auth0, verified). Idempotent; no-op when empty.
 */
@Component
class PlatformAdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PlatformAdminBootstrap.class);
    private final JdbcTemplate jdbc;
    private final String adminEmail;

    PlatformAdminBootstrap(JdbcTemplate jdbc, @Value("${opesfuel.bootstrap.admin-email:}") String adminEmail) {
        this.jdbc = jdbc;
        this.adminEmail = adminEmail == null ? "" : adminEmail.trim().toLowerCase();
    }

    @Override
    public void run(ApplicationArguments args) {
        if (adminEmail.isEmpty()) return;
        try {
            Integer tenants = jdbc.queryForObject("SELECT COUNT(*) FROM tenants WHERE id = 'ten_opes_cm'", Integer.class);
            if (tenants == null || tenants == 0) {
                log.warn("Bootstrap admin skipped: operator tenant ten_opes_cm not found.");
                return;
            }
            int updated = jdbc.update(
                "UPDATE user_accounts SET email = ?, status = 'ACTIVE', role = 'PLATFORM_ADMIN' WHERE id = 'usr_platform_admin'", adminEmail);
            if (updated == 0) {
                jdbc.update("""
                    INSERT INTO user_accounts (id, tenant_id, auth0_sub, full_name, email, role, preferred_language, status)
                    VALUES ('usr_platform_admin', 'ten_opes_cm', 'pending|usr_platform_admin', 'Platform Administrator', ?, 'PLATFORM_ADMIN', 'en', 'ACTIVE')
                    """, adminEmail);
            }
            // A different email now owns the admin seat: make sure the login is relinked on next sign-in.
            jdbc.update("UPDATE user_accounts SET auth0_sub = 'pending|usr_platform_admin' WHERE id = 'usr_platform_admin' AND auth0_sub = 'auth0|platform_admin'");
            log.info("Platform admin login set to {}", adminEmail);
        } catch (RuntimeException e) {
            log.warn("Bootstrap admin failed (continuing startup): {}", e.getMessage());
        }
    }
}
