package com.opesware.opesfuel.enterprise;

import com.opesware.opesfuel.notifications.OutboundMessagingService;
import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.*;

record EnrollLoyaltyMemberCommand(
    @NotBlank String phone,
    String fullName,
    String fleetAccount
) {}

record UpsertEarnRuleCommand(
    @NotBlank String fuelGrade,
    double pointsPerLitre,
    double pointsPer1000Xaf
) {}

record CreateLoyaltyCampaignCommand(
    @NotBlank String name,
    @NotBlank String campaignType,
    double discountPct,
    String fuelGrade,
    Integer startHour,
    Integer endHour,
    String fleetAccount,
    String validFrom,
    String validTo
) {}

record EarnLoyaltyPointsCommand(
    @NotBlank String phone,
    @NotBlank String fuelGrade,
    @Positive double litres,
    @Min(100) long amountXaf,
    String reference
) {}

record RedeemLoyaltyPointsCommand(
    @NotBlank String phone,
    @Min(1) long points,
    String reference
) {}

record SendDigitalReceiptCommand(
    @NotBlank String channel,
    @NotBlank String recipientPhone,
    String memberId,
    @NotBlank String stationName,
    @NotBlank String fuelGrade,
    @Positive double litres,
    @Min(100) long totalFcfa,
    String receiptNo
) {}

@RestController
public class LoyaltyAndReceiptsController {

    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final OutboundMessagingService messagingService;
    private final AuditTrailRecorder auditRecorder;

    public LoyaltyAndReceiptsController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        OutboundMessagingService messagingService,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.messagingService = messagingService;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping("/api/v1/loyalty/members")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<Map<String, Object>> listMembers() {
        return jdbcTemplate.queryForList(
            "SELECT * FROM loyalty_members WHERE tenant_id = ? ORDER BY lifetime_points DESC LIMIT 200",
            accessGuard.currentTenantId()
        );
    }

    @PostMapping("/api/v1/loyalty/members")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    public Map<String, Object> enrollMember(@Valid @RequestBody EnrollLoyaltyMemberCommand cmd) {
        String tenantId = accessGuard.currentTenantId();
        String phone = normalizePhone(cmd.phone());
        String id = "loy_" + UUID.randomUUID().toString().substring(0, 10);
        String passToken = "pass_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);

        jdbcTemplate.update(
            """
            INSERT INTO loyalty_members (id, tenant_id, phone, full_name, pass_token, points_balance, lifetime_points, tier, fleet_account, created_at)
            VALUES (?, ?, ?, ?, ?, 0, 0, 'BRONZE', ?, ?)
            """,
            id, tenantId, phone, cmd.fullName() != null ? cmd.fullName().trim() : "Valued Driver",
            passToken, cmd.fleetAccount(), Timestamp.from(Instant.now())
        );
        return jdbcTemplate.queryForMap("SELECT * FROM loyalty_members WHERE id = ?", id);
    }

    @GetMapping("/api/v1/loyalty/rules")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<Map<String, Object>> listRules() {
        return jdbcTemplate.queryForList(
            "SELECT * FROM loyalty_earn_rules WHERE tenant_id = ? ORDER BY fuel_grade ASC",
            accessGuard.currentTenantId()
        );
    }

    @PostMapping("/api/v1/loyalty/rules")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> upsertEarnRule(@Valid @RequestBody UpsertEarnRuleCommand cmd) {
        String tenantId = accessGuard.currentTenantId();
        String grade = cmd.fuelGrade().trim().toUpperCase();
        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
            "SELECT id FROM loyalty_earn_rules WHERE tenant_id = ? AND fuel_grade = ?", tenantId, grade
        );
        String id;
        if (existing.isEmpty()) {
            id = "lrul_" + UUID.randomUUID().toString().substring(0, 10);
            jdbcTemplate.update(
                "INSERT INTO loyalty_earn_rules (id, tenant_id, fuel_grade, points_per_litre, points_per_1000_xaf, active, created_at) VALUES (?, ?, ?, ?, ?, TRUE, ?)",
                id, tenantId, grade, cmd.pointsPerLitre(), cmd.pointsPer1000Xaf(), Timestamp.from(Instant.now())
            );
        } else {
            id = String.valueOf(existing.get(0).get("id"));
            jdbcTemplate.update(
                "UPDATE loyalty_earn_rules SET points_per_litre = ?, points_per_1000_xaf = ?, active = TRUE WHERE id = ?",
                cmd.pointsPerLitre(), cmd.pointsPer1000Xaf(), id
            );
        }
        return jdbcTemplate.queryForMap("SELECT * FROM loyalty_earn_rules WHERE id = ?", id);
    }

    @GetMapping("/api/v1/loyalty/campaigns")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT','ACCOUNTANT')")
    public List<Map<String, Object>> listCampaigns() {
        return jdbcTemplate.queryForList(
            "SELECT * FROM loyalty_campaigns WHERE tenant_id = ? ORDER BY created_at DESC",
            accessGuard.currentTenantId()
        );
    }

    @PostMapping("/api/v1/loyalty/campaigns")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    public Map<String, Object> createCampaign(@Valid @RequestBody CreateLoyaltyCampaignCommand cmd) {
        String id = "lcmp_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO loyalty_campaigns (
                id, tenant_id, name, campaign_type, discount_pct, fuel_grade,
                start_hour, end_hour, fleet_account, valid_from, valid_to, active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, ?)
            """,
            id, accessGuard.currentTenantId(), cmd.name().trim(), cmd.campaignType().trim().toUpperCase(),
            cmd.discountPct(), cmd.fuelGrade() != null ? cmd.fuelGrade().trim().toUpperCase() : null,
            cmd.startHour(), cmd.endHour(), cmd.fleetAccount(),
            cmd.validFrom() != null && !cmd.validFrom().isBlank() ? Date.valueOf(cmd.validFrom()) : null,
            cmd.validTo() != null && !cmd.validTo().isBlank() ? Date.valueOf(cmd.validTo()) : null,
            Timestamp.from(Instant.now())
        );
        return jdbcTemplate.queryForMap("SELECT * FROM loyalty_campaigns WHERE id = ?", id);
    }

    @PostMapping("/api/v1/loyalty/earn")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    public Map<String, Object> earnPoints(@Valid @RequestBody EarnLoyaltyPointsCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String tenantId = principal.tenantId();
        String phone = normalizePhone(cmd.phone());
        String grade = cmd.fuelGrade().trim().toUpperCase();

        Map<String, Object> member = findOrCreateMember(tenantId, phone);
        String memberId = String.valueOf(member.get("id"));
        String fleetAccount = member.get("fleet_account") != null ? String.valueOf(member.get("fleet_account")) : null;

        // Evaluate active campaigns (happy-hour / fleet rebate)
        int currentHour = ZonedDateTime.now(ZoneOffset.UTC).getHour();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        List<Map<String, Object>> campaigns = jdbcTemplate.queryForList(
            "SELECT * FROM loyalty_campaigns WHERE tenant_id = ? AND active = TRUE", tenantId
        );
        double bestDiscountPct = 0;
        String appliedCampaignId = null;
        for (Map<String, Object> c : campaigns) {
            String cGrade = c.get("fuel_grade") != null ? String.valueOf(c.get("fuel_grade")) : null;
            if (cGrade != null && !cGrade.isBlank() && !cGrade.equalsIgnoreCase(grade)) continue;
            if (c.get("valid_from") instanceof Date vf && today.isBefore(vf.toLocalDate())) continue;
            if (c.get("valid_to") instanceof Date vt && today.isAfter(vt.toLocalDate())) continue;

            String cType = String.valueOf(c.get("campaign_type"));
            if ("HAPPY_HOUR".equalsIgnoreCase(cType)) {
                Integer sh = c.get("start_hour") instanceof Number n ? n.intValue() : null;
                Integer eh = c.get("end_hour") instanceof Number n ? n.intValue() : null;
                if (sh != null && eh != null && (currentHour < sh || currentHour > eh)) continue;
            } else if ("FLEET_REBATE".equalsIgnoreCase(cType)) {
                String cFleet = c.get("fleet_account") != null ? String.valueOf(c.get("fleet_account")) : null;
                if (cFleet != null && !cFleet.isBlank() && !cFleet.equalsIgnoreCase(fleetAccount)) continue;
            }
            double pct = ((Number) c.get("discount_pct")).doubleValue();
            if (pct > bestDiscountPct) {
                bestDiscountPct = pct;
                appliedCampaignId = String.valueOf(c.get("id"));
            }
        }
        long discountXaf = Math.round(cmd.amountXaf() * (bestDiscountPct / 100.0));
        long netXaf = Math.max(0L, cmd.amountXaf() - discountXaf);

        // Compute points from earn rules (fallback: 1 pt / litre)
        List<Map<String, Object>> rules = jdbcTemplate.queryForList(
            "SELECT * FROM loyalty_earn_rules WHERE tenant_id = ? AND fuel_grade = ? AND active = TRUE", tenantId, grade
        );
        long earnedPoints;
        if (!rules.isEmpty()) {
            double perLitre = ((Number) rules.get(0).get("points_per_litre")).doubleValue();
            double per1000 = ((Number) rules.get(0).get("points_per_1000_xaf")).doubleValue();
            earnedPoints = Math.max(1L, Math.round(cmd.litres() * perLitre + (netXaf / 1000.0) * per1000));
        } else {
            earnedPoints = Math.max(1L, Math.round(cmd.litres()));
        }

        long newBalance = ((Number) member.get("points_balance")).longValue() + earnedPoints;
        long newLifetime = ((Number) member.get("lifetime_points")).longValue() + earnedPoints;
        String newTier = resolveTier(newLifetime);

        jdbcTemplate.update(
            "UPDATE loyalty_members SET points_balance = ?, lifetime_points = ?, tier = ? WHERE id = ?",
            newBalance, newLifetime, newTier, memberId
        );

        String ledId = "lled_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO loyalty_ledger (
                id, tenant_id, member_id, entry_type, points, fuel_grade, litres,
                amount_xaf, discount_xaf, campaign_id, reference, created_by, created_at
            ) VALUES (?, ?, ?, 'EARN', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ledId, tenantId, memberId, earnedPoints, grade, cmd.litres(), netXaf, discountXaf,
            appliedCampaignId, cmd.reference(), principal.subject(), Timestamp.from(Instant.now())
        );

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("ledgerId", ledId);
        out.put("memberId", memberId);
        out.put("passToken", member.get("pass_token"));
        out.put("earnedPoints", earnedPoints);
        out.put("pointsBalance", newBalance);
        out.put("lifetimePoints", newLifetime);
        out.put("tier", newTier);
        out.put("discountXaf", discountXaf);
        out.put("netAmountXaf", netXaf);
        out.put("appliedCampaignId", appliedCampaignId);
        return out;
    }

    @PostMapping("/api/v1/loyalty/redeem")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    public Map<String, Object> redeemPoints(@Valid @RequestBody RedeemLoyaltyPointsCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String tenantId = principal.tenantId();
        String phone = normalizePhone(cmd.phone());
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT * FROM loyalty_members WHERE tenant_id = ? AND phone = ?", tenantId, phone
        );
        if (rows.isEmpty()) {
            throw new IllegalArgumentException("Loyalty member not found for phone " + phone);
        }
        Map<String, Object> member = rows.get(0);
        long balance = ((Number) member.get("points_balance")).longValue();
        if (balance < cmd.points()) {
            throw new IllegalStateException("Insufficient loyalty points: requested " + cmd.points() + " but balance is " + balance);
        }
        long remaining = balance - cmd.points();
        long xafValue = cmd.points() * 10L; // 1 point = 10 FCFA redemption value
        String memberId = String.valueOf(member.get("id"));

        jdbcTemplate.update("UPDATE loyalty_members SET points_balance = ? WHERE id = ?", remaining, memberId);
        String ledId = "lled_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO loyalty_ledger (
                id, tenant_id, member_id, entry_type, points, amount_xaf, discount_xaf, reference, created_by, created_at
            ) VALUES (?, ?, ?, 'REDEEM', ?, ?, ?, ?, ?, ?)
            """,
            ledId, tenantId, memberId, -cmd.points(), xafValue, xafValue, cmd.reference(), principal.subject(), Timestamp.from(Instant.now())
        );

        return Map.of(
            "ledgerId", ledId,
            "memberId", memberId,
            "pointsRedeemed", cmd.points(),
            "valueFcfa", xafValue,
            "remainingBalance", remaining
        );
    }

    @PostMapping("/api/v1/loyalty/receipts/send")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ATTENDANT')")
    public Map<String, Object> sendDigitalReceipt(@Valid @RequestBody SendDigitalReceiptCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String channel = "SMS".equalsIgnoreCase(cmd.channel()) ? "SMS" : "WHATSAPP";
        String receiptNo = (cmd.receiptNo() != null && !cmd.receiptNo().isBlank())
            ? cmd.receiptNo().trim() : "RCP-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        String body = String.format(
            "%s Digital Fuel Receipt (%s): %.2f L %s = %,d FCFA. Thank you for fueling with OpesFuel!",
            cmd.stationName(), receiptNo, cmd.litres(), cmd.fuelGrade().toUpperCase(), cmd.totalFcfa()
        );

        Map<String, Object> delivery = messagingService.dispatch(
            principal.tenantId(), principal.subject(), channel, cmd.recipientPhone().trim(),
            "Fuel Receipt " + receiptNo, body, "DIGITAL_FUEL_RECEIPT"
        );

        String id = "drcp_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO digital_receipts (id, tenant_id, member_id, channel, recipient, body, outbound_message_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id, principal.tenantId(), cmd.memberId(), channel, cmd.recipientPhone().trim(), body,
            String.valueOf(delivery.get("id")), String.valueOf(delivery.get("status")), Timestamp.from(Instant.now())
        );
        auditRecorder.record(principal.tenantId(), null, principal.subject(), "ATTENDANT",
            "DIGITAL_RECEIPT_SENT", "RECEIPT", id, "Sent " + channel + " receipt " + receiptNo + " to " + cmd.recipientPhone());

        return Map.of(
            "id", id,
            "receiptNo", receiptNo,
            "channel", channel,
            "recipient", cmd.recipientPhone().trim(),
            "status", delivery.get("status"),
            "provider", delivery.get("provider"),
            "body", body
        );
    }

    @GetMapping("/api/v1/public/loyalty/pass/{token}")
    public Map<String, Object> publicLoyaltyPass(@PathVariable String token) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT id, tenant_id, full_name, pass_token, points_balance, lifetime_points, tier, created_at FROM loyalty_members WHERE pass_token = ?",
            token.trim()
        );
        if (rows.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Loyalty pass not found.");
        }
        Map<String, Object> m = rows.get(0);
        List<Map<String, Object>> recent = jdbcTemplate.queryForList(
            "SELECT entry_type, points, fuel_grade, litres, amount_xaf, discount_xaf, created_at FROM loyalty_ledger WHERE member_id = ? ORDER BY created_at DESC LIMIT 20",
            m.get("id")
        );
        List<Map<String, Object>> promos = jdbcTemplate.queryForList(
            "SELECT name, campaign_type, discount_pct, fuel_grade, start_hour, end_hour FROM loyalty_campaigns WHERE tenant_id = ? AND active = TRUE",
            m.get("tenant_id")
        );
        return Map.of(
            "passToken", m.get("pass_token"),
            "memberName", m.get("full_name"),
            "pointsBalance", ((Number) m.get("points_balance")).longValue(),
            "lifetimePoints", ((Number) m.get("lifetime_points")).longValue(),
            "redemptionValueFcfa", ((Number) m.get("points_balance")).longValue() * 10L,
            "tier", m.get("tier"),
            "recentActivity", recent,
            "activePromotions", promos
        );
    }

    private Map<String, Object> findOrCreateMember(String tenantId, String phone) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
            "SELECT * FROM loyalty_members WHERE tenant_id = ? AND phone = ?", tenantId, phone
        );
        if (!rows.isEmpty()) return rows.get(0);
        String id = "loy_" + UUID.randomUUID().toString().substring(0, 10);
        String passToken = "pass_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        jdbcTemplate.update(
            "INSERT INTO loyalty_members (id, tenant_id, phone, full_name, pass_token, points_balance, lifetime_points, tier, created_at) VALUES (?, ?, ?, 'Driver', ?, 0, 0, 'BRONZE', ?)",
            id, tenantId, phone, passToken, Timestamp.from(Instant.now())
        );
        return jdbcTemplate.queryForMap("SELECT * FROM loyalty_members WHERE id = ?", id);
    }

    private static String resolveTier(long lifetimePoints) {
        if (lifetimePoints >= 5000) return "PLATINUM";
        if (lifetimePoints >= 1500) return "GOLD";
        if (lifetimePoints >= 400) return "SILVER";
        return "BRONZE";
    }

    private static String normalizePhone(String raw) {
        String digits = raw.replaceAll("[^0-9]", "");
        return digits.startsWith("237") ? "+" + digits : "+" + digits;
    }
}
