package com.opesware.opesfuel.fleet;

import com.opesware.opesfuel.billing.MomoPaymentApi;
import com.opesware.opesfuel.notifications.OutboundMessagingService;
import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.FleetPortalAuthFilter;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.util.*;

record InviteFleetPortalUserCommand(
    @NotBlank @Email String email,
    @NotBlank String fullName,
    String phone,
    @NotBlank String temporaryPassword
) {}

record FleetPortalLoginCommand(
    @NotBlank String email,
    @NotBlank String password
) {}

record UpdateVehicleLimitsCommand(
    String cardNumber,
    Double dailyLitreCap,
    Double monthlyLitreCap,
    Long dailyXafCap,
    Long monthlyXafCap,
    String allowedGradesCsv,
    Boolean active
) {}

record FleetPortalPayBalanceCommand(
    @NotBlank String phoneNumber,
    String provider,
    @Min(100) long amountFcfa
) {}

@RestController
public class FleetPortalController {

    private static final SecureRandom RNG = new SecureRandom();
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();

    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;
    private final OutboundMessagingService messagingService;
    private final MomoPaymentApi momoService;

    @Value("${opesfuel.tax.vat-rate:0.1925}")
    private double vatRate;

    public FleetPortalController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder,
        OutboundMessagingService messagingService,
        MomoPaymentApi momoService
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
        this.messagingService = messagingService;
        this.momoService = momoService;
    }

    // --- STATION STAFF MANAGEMENT ---

    @PostMapping("/api/v1/fleet/accounts/{accountId}/portal-users")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> invitePortalUser(
        @PathVariable String accountId,
        @Valid @RequestBody InviteFleetPortalUserCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        Map<String, Object> acc = jdbcTemplate.queryForMap(
            "SELECT id, tenant_id, company_name FROM fleet_accounts WHERE id = ?", accountId
        );
        accessGuard.assertTenantMatch(String.valueOf(acc.get("tenant_id")));

        String userId = "fpu_" + UUID.randomUUID().toString().substring(0, 10);
        String email = cmd.email().trim().toLowerCase();
        String hash = passwordEncoder.encode(cmd.temporaryPassword());
        Timestamp now = Timestamp.from(Instant.now());

        jdbcTemplate.update(
            """
            INSERT INTO fleet_portal_users (id, tenant_id, fleet_account_id, email, password_hash, full_name, phone, active, invited_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?)
            """,
            userId, principal.tenantId(), accountId, email, hash, cmd.fullName().trim(),
            cmd.phone() != null ? cmd.phone().trim() : null, principal.subject(), now
        );

        try {
            messagingService.dispatch(
                principal.tenantId(), principal.subject(), "EMAIL", email,
                "Welcome to OpesFuel Corporate Fleet Portal — " + acc.get("company_name"),
                "Hello " + cmd.fullName() + ", your corporate fleet portal account for " + acc.get("company_name")
                    + " is active. Sign in at /#/fleet-portal with email " + email + ".",
                "FLEET_PORTAL_INVITE"
            );
        } catch (Exception ignored) {
            // Do not roll back invite if email provider is not yet configured
        }

        auditRecorder.record(
            principal.tenantId(), null, principal.subject(), "OWNER",
            "FLEET_PORTAL_USER_INVITED", "FLEET_ACCOUNT", accountId,
            "Invited fleet portal user " + email + " for " + acc.get("company_name")
        );

        return Map.of(
            "id", userId,
            "fleetAccountId", accountId,
            "companyName", acc.get("company_name"),
            "email", email,
            "fullName", cmd.fullName().trim(),
            "active", true
        );
    }

    @GetMapping("/api/v1/fleet/accounts/{accountId}/portal-users")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listPortalUsers(@PathVariable String accountId) {
        Map<String, Object> acc = jdbcTemplate.queryForMap(
            "SELECT tenant_id FROM fleet_accounts WHERE id = ?", accountId
        );
        accessGuard.assertTenantMatch(String.valueOf(acc.get("tenant_id")));
        return jdbcTemplate.queryForList(
            "SELECT id, fleet_account_id, email, full_name, phone, active, invited_by, created_at, last_login_at FROM fleet_portal_users WHERE fleet_account_id = ? ORDER BY created_at DESC",
            accountId
        );
    }

    // --- PUBLIC FLEET CLIENT LOGIN ---

    @PostMapping("/api/v1/public/fleet-portal/login")
    @Transactional
    public Map<String, Object> login(@Valid @RequestBody FleetPortalLoginCommand cmd) {
        String email = cmd.email().trim().toLowerCase();
        List<Map<String, Object>> users = jdbcTemplate.queryForList(
            "SELECT * FROM fleet_portal_users WHERE email = ? AND active = TRUE", email
        );
        if (users.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid corporate fleet credentials.");
        }
        Map<String, Object> u = users.get(0);
        if (!passwordEncoder.matches(cmd.password(), String.valueOf(u.get("password_hash")))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid corporate fleet credentials.");
        }

        String rawToken = FleetPortalAuthFilter.FLEET_TOKEN_PREFIX + randomHex(24);
        String tokenHash = FleetPortalAuthFilter.sha256(rawToken);
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(12L * 3600L);

        String userId = String.valueOf(u.get("id"));
        String tenantId = String.valueOf(u.get("tenant_id"));
        String accountId = String.valueOf(u.get("fleet_account_id"));

        jdbcTemplate.update(
            """
            INSERT INTO fleet_portal_sessions (token_hash, user_id, tenant_id, fleet_account_id, email, expires_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            tokenHash, userId, tenantId, accountId, email, Timestamp.from(expiresAt), Timestamp.from(now)
        );
        jdbcTemplate.update("UPDATE fleet_portal_users SET last_login_at = ? WHERE id = ?", Timestamp.from(now), userId);

        Map<String, Object> acc = jdbcTemplate.queryForMap(
            "SELECT company_name, tax_id, status FROM fleet_accounts WHERE id = ?", accountId
        );

        return Map.of(
            "token", rawToken,
            "role", "FLEET_CLIENT",
            "expiresAt", expiresAt.toString(),
            "user", Map.of(
                "id", userId,
                "email", email,
                "fullName", u.get("full_name"),
                "fleetAccountId", accountId,
                "companyName", acc.get("company_name"),
                "taxId", acc.get("tax_id"),
                "accountStatus", acc.get("status")
            )
        );
    }

    // --- SELF-SERVICE FLEET CLIENT PORTAL (STRICTLY SCOPED TO OWN ACCOUNT) ---

    @GetMapping("/api/v1/fleet-portal/dashboard")
    @PreAuthorize("hasRole('FLEET_CLIENT')")
    public Map<String, Object> dashboard(HttpServletRequest req) {
        Scope scope = resolveScope(req);
        Map<String, Object> acc = jdbcTemplate.queryForMap(
            "SELECT id, company_name, tax_id, credit_limit_fcfa, balance_owed_fcfa, status FROM fleet_accounts WHERE id = ? AND tenant_id = ?",
            scope.accountId(), scope.tenantId()
        );
        long creditLimit = ((Number) acc.get("credit_limit_fcfa")).longValue();
        long balanceOwed = ((Number) acc.get("balance_owed_fcfa")).longValue();

        Instant monthStart = YearMonth.now(ZoneOffset.UTC).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Map<String, Object> mtd = jdbcTemplate.queryForMap(
            "SELECT COALESCE(SUM(amount_fcfa), 0) AS spend, COALESCE(SUM(litres), 0) AS litres, COUNT(*) AS tx_count FROM fleet_transactions WHERE account_id = ? AND created_at >= ?",
            scope.accountId(), Timestamp.from(monthStart)
        );
        Integer vehCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM fleet_vehicles WHERE account_id = ?", Integer.class, scope.accountId()
        );

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("fleetAccountId", acc.get("id"));
        res.put("companyName", acc.get("company_name"));
        res.put("taxId", acc.get("tax_id"));
        res.put("status", acc.get("status"));
        res.put("creditLimitFcfa", creditLimit);
        res.put("balanceOwedFcfa", balanceOwed);
        res.put("availableCreditFcfa", Math.max(0L, creditLimit - balanceOwed));
        res.put("monthSpendFcfa", ((Number) mtd.get("spend")).longValue());
        res.put("monthLitres", ((Number) mtd.get("litres")).doubleValue());
        res.put("monthTransactions", ((Number) mtd.get("tx_count")).intValue());
        res.put("vehicleCount", vehCount != null ? vehCount : 0);
        return res;
    }

    @GetMapping("/api/v1/fleet-portal/fuelings")
    @PreAuthorize("hasRole('FLEET_CLIENT')")
    public List<Map<String, Object>> fuelings(
        HttpServletRequest req,
        @RequestParam(required = false) String vehiclePlate,
        @RequestParam(required = false) String driverName,
        @RequestParam(required = false) String from,
        @RequestParam(required = false) String to
    ) {
        Scope scope = resolveScope(req);
        StringBuilder sql = new StringBuilder(
            "SELECT id, station_id, vehicle_plate, driver_name, grade, litres, amount_fcfa, created_at FROM fleet_transactions WHERE account_id = ?"
        );
        List<Object> params = new ArrayList<>();
        params.add(scope.accountId());
        if (vehiclePlate != null && !vehiclePlate.isBlank()) {
            sql.append(" AND UPPER(vehicle_plate) LIKE ?");
            params.add("%" + vehiclePlate.trim().toUpperCase() + "%");
        }
        if (driverName != null && !driverName.isBlank()) {
            sql.append(" AND UPPER(driver_name) LIKE ?");
            params.add("%" + driverName.trim().toUpperCase() + "%");
        }
        if (from != null && !from.isBlank()) {
            sql.append(" AND created_at >= ?");
            params.add(Timestamp.from(Instant.parse(from.length() == 10 ? from + "T00:00:00Z" : from)));
        }
        if (to != null && !to.isBlank()) {
            sql.append(" AND created_at <= ?");
            params.add(Timestamp.from(Instant.parse(to.length() == 10 ? to + "T23:59:59Z" : to)));
        }
        sql.append(" ORDER BY created_at DESC LIMIT 300");
        return jdbcTemplate.queryForList(sql.toString(), params.toArray());
    }

    @GetMapping(value = "/api/v1/fleet-portal/fuelings.csv", produces = "text/csv")
    @PreAuthorize("hasRole('FLEET_CLIENT')")
    public ResponseEntity<String> exportFuelingsCsv(
        HttpServletRequest req,
        @RequestParam(required = false) String vehiclePlate,
        @RequestParam(required = false) String driverName
    ) {
        List<Map<String, Object>> rows = fuelings(req, vehiclePlate, driverName, null, null);
        StringBuilder sb = new StringBuilder("TransactionId,StationId,VehiclePlate,DriverName,FuelGrade,Litres,AmountFCFA,Timestamp\n");
        for (Map<String, Object> r : rows) {
            sb.append(csv(r.get("id"))).append(',')
              .append(csv(r.get("station_id"))).append(',')
              .append(csv(r.get("vehicle_plate"))).append(',')
              .append(csv(r.get("driver_name"))).append(',')
              .append(csv(r.get("grade"))).append(',')
              .append(csv(r.get("litres"))).append(',')
              .append(csv(r.get("amount_fcfa"))).append(',')
              .append(csv(r.get("created_at"))).append('\n');
        }
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"fleet-fuelings.csv\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(sb.toString());
    }

    @GetMapping("/api/v1/fleet-portal/vehicles")
    @PreAuthorize("hasRole('FLEET_CLIENT')")
    public List<Map<String, Object>> vehicles(HttpServletRequest req) {
        Scope scope = resolveScope(req);
        List<Map<String, Object>> vehicles = jdbcTemplate.queryForList(
            "SELECT id, plate_number, driver_name, allowed_grade, monthly_litre_cap, active FROM fleet_vehicles WHERE account_id = ? ORDER BY plate_number ASC",
            scope.accountId()
        );
        List<Map<String, Object>> limits = jdbcTemplate.queryForList(
            "SELECT * FROM fleet_vehicle_limits WHERE fleet_account_id = ? AND tenant_id = ?",
            scope.accountId(), scope.tenantId()
        );
        Map<String, Map<String, Object>> byPlate = new HashMap<>();
        for (Map<String, Object> l : limits) {
            byPlate.put(String.valueOf(l.get("vehicle_plate")).toUpperCase(), l);
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> v : vehicles) {
            Map<String, Object> row = new LinkedHashMap<>(v);
            Map<String, Object> lim = byPlate.get(String.valueOf(v.get("plate_number")).toUpperCase());
            if (lim != null) {
                row.put("cardNumber", lim.get("card_number"));
                row.put("dailyLitreCap", lim.get("daily_litre_cap"));
                row.put("monthlyLitreCap", lim.get("monthly_litre_cap"));
                row.put("dailyXafCap", lim.get("daily_xaf_cap"));
                row.put("monthlyXafCap", lim.get("monthly_xaf_cap"));
                row.put("allowedGradesCsv", lim.get("allowed_grades_csv"));
                row.put("limitActive", lim.get("active"));
            }
            result.add(row);
        }
        return result;
    }

    @PutMapping("/api/v1/fleet-portal/vehicles/{plate}/limits")
    @Transactional
    @PreAuthorize("hasRole('FLEET_CLIENT')")
    public Map<String, Object> updateVehicleLimits(
        HttpServletRequest req,
        @PathVariable String plate,
        @RequestBody UpdateVehicleLimitsCommand cmd
    ) {
        Scope scope = resolveScope(req);
        String normalizedPlate = plate.trim().toUpperCase();
        String id = "fvl_" + UUID.randomUUID().toString().substring(0, 10);
        Timestamp now = Timestamp.from(Instant.now());

        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
            "SELECT id FROM fleet_vehicle_limits WHERE tenant_id = ? AND fleet_account_id = ? AND vehicle_plate = ?",
            scope.tenantId(), scope.accountId(), normalizedPlate
        );
        if (existing.isEmpty()) {
            jdbcTemplate.update(
                """
                INSERT INTO fleet_vehicle_limits (
                    id, tenant_id, fleet_account_id, vehicle_plate, card_number,
                    daily_litre_cap, monthly_litre_cap, daily_xaf_cap, monthly_xaf_cap,
                    allowed_grades_csv, active, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id, scope.tenantId(), scope.accountId(), normalizedPlate, cmd.cardNumber(),
                cmd.dailyLitreCap(), cmd.monthlyLitreCap(), cmd.dailyXafCap(), cmd.monthlyXafCap(),
                cmd.allowedGradesCsv(), cmd.active() != null ? cmd.active() : true, now
            );
        } else {
            id = String.valueOf(existing.get(0).get("id"));
            jdbcTemplate.update(
                """
                UPDATE fleet_vehicle_limits
                SET card_number = ?, daily_litre_cap = ?, monthly_litre_cap = ?, daily_xaf_cap = ?,
                    monthly_xaf_cap = ?, allowed_grades_csv = ?, active = ?, updated_at = ?
                WHERE id = ?
                """,
                cmd.cardNumber(), cmd.dailyLitreCap(), cmd.monthlyLitreCap(), cmd.dailyXafCap(),
                cmd.monthlyXafCap(), cmd.allowedGradesCsv(), cmd.active() != null ? cmd.active() : true, now, id
            );
        }
        return jdbcTemplate.queryForMap("SELECT * FROM fleet_vehicle_limits WHERE id = ?", id);
    }

    @GetMapping("/api/v1/fleet-portal/statements/{period}")
    @PreAuthorize("hasRole('FLEET_CLIENT')")
    public Map<String, Object> monthlyVatStatement(HttpServletRequest req, @PathVariable String period) {
        Scope scope = resolveScope(req);
        YearMonth ym = YearMonth.parse(period);
        Instant start = ym.atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant end = ym.plusMonths(1).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);

        Map<String, Object> acc = jdbcTemplate.queryForMap(
            "SELECT id, company_name, tax_id, credit_limit_fcfa, balance_owed_fcfa FROM fleet_accounts WHERE id = ? AND tenant_id = ?",
            scope.accountId(), scope.tenantId()
        );
        List<Map<String, Object>> txs = jdbcTemplate.queryForList(
            "SELECT id, station_id, vehicle_plate, driver_name, grade, litres, amount_fcfa, created_at FROM fleet_transactions WHERE account_id = ? AND created_at >= ? AND created_at < ? ORDER BY created_at ASC",
            scope.accountId(), Timestamp.from(start), Timestamp.from(end)
        );
        long grossFcfa = txs.stream().mapToLong(r -> ((Number) r.get("amount_fcfa")).longValue()).sum();
        double totalLitres = txs.stream().mapToDouble(r -> ((Number) r.get("litres")).doubleValue()).sum();
        long netHtFcfa = Math.round(grossFcfa / (1.0 + vatRate));
        long vatFcfa = grossFcfa - netHtFcfa;

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("period", period);
        res.put("companyName", acc.get("company_name"));
        res.put("taxId", acc.get("tax_id"));
        res.put("vatRate", vatRate);
        res.put("netHtFcfa", netHtFcfa);
        res.put("vatFcfa", vatFcfa);
        res.put("totalTtcFcfa", grossFcfa);
        res.put("totalLitres", totalLitres);
        res.put("balanceOwedFcfa", ((Number) acc.get("balance_owed_fcfa")).longValue());
        res.put("transactions", txs);
        res.put("generatedAt", Instant.now().toString());
        return res;
    }

    @PostMapping("/api/v1/fleet-portal/pay-balance")
    @PreAuthorize("hasRole('FLEET_CLIENT')")
    public Map<String, Object> payBalanceViaMomo(
        HttpServletRequest req,
        @RequestHeader(value = "Idempotency-Key", required = false) String idemKey,
        @Valid @RequestBody FleetPortalPayBalanceCommand cmd
    ) {
        Scope scope = resolveScope(req);
        return momoService.initiatePayment(
            scope.tenantId(),
            scope.email(),
            "FLEET_BALANCE",
            scope.accountId(),
            cmd.amountFcfa(),
            cmd.phoneNumber(),
            cmd.provider(),
            "Fleet balance settlement " + scope.accountId(),
            idemKey
        );
    }

    private Scope resolveScope(HttpServletRequest req) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        Object attr = req.getAttribute(FleetPortalAuthFilter.REQUEST_ATTR_FLEET_ACCOUNT_ID);
        String accountId = attr != null ? String.valueOf(attr)
            : principal.allowedStationIds().stream().findFirst().orElse(null);
        if (accountId == null || accountId.isBlank()) {
            throw new AccessDeniedException("Fleet portal session is not bound to a corporate fleet account.");
        }
        return new Scope(principal.tenantId(), accountId, principal.subject());
    }

    private record Scope(String tenantId, String accountId, String email) {}

    private static String randomHex(int bytes) {
        byte[] buf = new byte[bytes];
        RNG.nextBytes(buf);
        return HexFormat.of().formatHex(buf);
    }

    private static String csv(Object val) {
        String s = val == null ? "" : String.valueOf(val).replace("\"", "\"\"");
        return "\"" + s + "\"";
    }
}
