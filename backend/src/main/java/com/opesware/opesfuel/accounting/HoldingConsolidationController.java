package com.opesware.opesfuel.accounting;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

record CreateHoldingGroupCommand(
    @NotBlank String name,
    @NotBlank String reportingCurrency
) {}

record AddSubsidiaryMemberCommand(
    @NotBlank String tenantId,
    @NotBlank String functionalCurrency,
    @Min(1) @Max(100) double ownershipPct
) {}

record SubmitSubsidiaryFinancialsCommand(
    @NotBlank String tenantId,
    @NotBlank String periodLabel,
    double revenue,
    double costOfSales,
    double operatingExpenses,
    double totalAssets,
    double totalLiabilities,
    double equity,
    double receivablesIntercompany,
    double payablesIntercompany
) {}

record RecordIntercompanyTxCommand(
    @NotBlank String periodLabel,
    @NotBlank String sellerTenantId,
    @NotBlank String buyerTenantId,
    @NotBlank String currency,
    @Positive double amount,
    String description
) {}

@RestController
@RequestMapping("/api/v1/consolidation")
public class HoldingConsolidationController {

    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;

    public HoldingConsolidationController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping("/groups")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listGroups() {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        if (principal.hasRole("PLATFORM_ADMIN") || principal.hasRole("GROUP_CFO")) {
            return jdbcTemplate.queryForList("SELECT * FROM holding_groups ORDER BY created_at DESC");
        }
        return jdbcTemplate.queryForList(
            """
            SELECT DISTINCT g.* FROM holding_groups g
            LEFT JOIN holding_group_members m ON m.group_id = g.id
            WHERE g.parent_tenant_id = ? OR m.tenant_id = ?
            ORDER BY g.created_at DESC
            """,
            principal.tenantId(), principal.tenantId()
        );
    }

    @PostMapping("/groups")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO')")
    public Map<String, Object> createGroup(@Valid @RequestBody CreateHoldingGroupCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String id = "hgrp_" + UUID.randomUUID().toString().substring(0, 10);
        String ccy = normalizeCurrency(cmd.reportingCurrency());
        jdbcTemplate.update(
            "INSERT INTO holding_groups (id, name, reporting_currency, parent_tenant_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            id, cmd.name().trim(), ccy, principal.tenantId(), principal.subject(), Timestamp.from(Instant.now())
        );
        auditRecorder.record(principal.tenantId(), null, principal.subject(), "GROUP_CFO",
            "HOLDING_GROUP_CREATED", "HOLDING_GROUP", id, "Created holding group " + cmd.name() + " (" + ccy + ")");
        return jdbcTemplate.queryForMap("SELECT * FROM holding_groups WHERE id = ?", id);
    }

    @PostMapping("/groups/{groupId}/members")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO')")
    public Map<String, Object> addSubsidiary(@PathVariable String groupId, @Valid @RequestBody AddSubsidiaryMemberCommand cmd) {
        String id = "hmem_" + UUID.randomUUID().toString().substring(0, 10);
        String ccy = normalizeCurrency(cmd.functionalCurrency());
        jdbcTemplate.update(
            "INSERT INTO holding_group_members (id, group_id, tenant_id, functional_currency, ownership_pct, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            id, groupId, cmd.tenantId().trim(), ccy, cmd.ownershipPct(), Timestamp.from(Instant.now())
        );
        return jdbcTemplate.queryForMap("SELECT * FROM holding_group_members WHERE id = ?", id);
    }

    @GetMapping("/groups/{groupId}/members")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listMembers(@PathVariable String groupId) {
        return jdbcTemplate.queryForList(
            "SELECT * FROM holding_group_members WHERE group_id = ? ORDER BY ownership_pct DESC", groupId
        );
    }

    @PostMapping("/groups/{groupId}/financials")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO','OWNER','ACCOUNTANT')")
    public Map<String, Object> submitFinancials(
        @PathVariable String groupId,
        @Valid @RequestBody SubmitSubsidiaryFinancialsCommand cmd
    ) {
        List<Map<String, Object>> existing = jdbcTemplate.queryForList(
            "SELECT id FROM subsidiary_financials WHERE group_id = ? AND tenant_id = ? AND period_label = ?",
            groupId, cmd.tenantId(), cmd.periodLabel()
        );
        Timestamp now = Timestamp.from(Instant.now());
        String id;
        if (existing.isEmpty()) {
            id = "sfin_" + UUID.randomUUID().toString().substring(0, 10);
            jdbcTemplate.update(
                """
                INSERT INTO subsidiary_financials (
                    id, group_id, tenant_id, period_label, revenue, cost_of_sales, operating_expenses,
                    total_assets, total_liabilities, equity, receivables_intercompany, payables_intercompany, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                id, groupId, cmd.tenantId(), cmd.periodLabel(), cmd.revenue(), cmd.costOfSales(),
                cmd.operatingExpenses(), cmd.totalAssets(), cmd.totalLiabilities(), cmd.equity(),
                cmd.receivablesIntercompany(), cmd.payablesIntercompany(), now
            );
        } else {
            id = String.valueOf(existing.get(0).get("id"));
            jdbcTemplate.update(
                """
                UPDATE subsidiary_financials
                SET revenue = ?, cost_of_sales = ?, operating_expenses = ?, total_assets = ?,
                    total_liabilities = ?, equity = ?, receivables_intercompany = ?, payables_intercompany = ?, updated_at = ?
                WHERE id = ?
                """,
                cmd.revenue(), cmd.costOfSales(), cmd.operatingExpenses(), cmd.totalAssets(),
                cmd.totalLiabilities(), cmd.equity(), cmd.receivablesIntercompany(), cmd.payablesIntercompany(), now, id
            );
        }
        return jdbcTemplate.queryForMap("SELECT * FROM subsidiary_financials WHERE id = ?", id);
    }

    @PostMapping("/groups/{groupId}/intercompany")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO','ACCOUNTANT')")
    public Map<String, Object> recordIntercompany(
        @PathVariable String groupId,
        @Valid @RequestBody RecordIntercompanyTxCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        if (cmd.sellerTenantId().equals(cmd.buyerTenantId())) {
            throw new IllegalArgumentException("Inter-company transaction requires two distinct subsidiary tenants.");
        }
        String id = "ictx_" + UUID.randomUUID().toString().substring(0, 10);
        jdbcTemplate.update(
            """
            INSERT INTO intercompany_transactions (
                id, group_id, period_label, seller_tenant_id, buyer_tenant_id, currency,
                amount, description, eliminated, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE, ?, ?)
            """,
            id, groupId, cmd.periodLabel(), cmd.sellerTenantId(), cmd.buyerTenantId(),
            normalizeCurrency(cmd.currency()), cmd.amount(), cmd.description(),
            principal.subject(), Timestamp.from(Instant.now())
        );
        return jdbcTemplate.queryForMap("SELECT * FROM intercompany_transactions WHERE id = ?", id);
    }

    @PostMapping("/groups/{groupId}/eliminate")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO')")
    public Map<String, Object> runEliminations(
        @PathVariable String groupId,
        @RequestParam String period
    ) {
        Map<String, Object> group = jdbcTemplate.queryForMap("SELECT * FROM holding_groups WHERE id = ?", groupId);
        String reportingCcy = String.valueOf(group.get("reporting_currency"));
        double fxXafPerUsd = fetchPlatformFxRate();

        List<Map<String, Object>> pending = jdbcTemplate.queryForList(
            "SELECT * FROM intercompany_transactions WHERE group_id = ? AND period_label = ? AND eliminated = FALSE",
            groupId, period
        );
        int eliminatedCount = 0;
        double totalEliminatedReporting = 0;
        Timestamp now = Timestamp.from(Instant.now());

        for (Map<String, Object> tx : pending) {
            double amt = ((Number) tx.get("amount")).doubleValue();
            String txCcy = String.valueOf(tx.get("currency"));
            double amtReporting = convertCurrency(amt, txCcy, reportingCcy, fxXafPerUsd);
            String elId = "elim_" + UUID.randomUUID().toString().substring(0, 10);
            jdbcTemplate.update(
                """
                INSERT INTO consolidation_elimination_entries (
                    id, group_id, period_label, intercompany_tx_id, debit_account, credit_account, amount_reporting, created_at
                ) VALUES (?, ?, ?, ?, '701_INTERCO_REVENUE', '601_INTERCO_COGS', ?, ?)
                """,
                elId, groupId, period, tx.get("id"), amtReporting, now
            );
            jdbcTemplate.update("UPDATE intercompany_transactions SET eliminated = TRUE WHERE id = ?", tx.get("id"));
            eliminatedCount++;
            totalEliminatedReporting += amtReporting;
        }
        return Map.of(
            "groupId", groupId,
            "period", period,
            "reportingCurrency", reportingCcy,
            "fxXafPerUsd", fxXafPerUsd,
            "eliminatedTransactions", eliminatedCount,
            "totalEliminatedReporting", round2(totalEliminatedReporting)
        );
    }

    @GetMapping("/groups/{groupId}/report")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO','OWNER','ACCOUNTANT')")
    public Map<String, Object> consolidatedReport(
        @PathVariable String groupId,
        @RequestParam String period
    ) {
        Map<String, Object> group = jdbcTemplate.queryForMap("SELECT * FROM holding_groups WHERE id = ?", groupId);
        String reportingCcy = String.valueOf(group.get("reporting_currency"));
        double fxXafPerUsd = fetchPlatformFxRate();

        List<Map<String, Object>> members = jdbcTemplate.queryForList(
            "SELECT * FROM holding_group_members WHERE group_id = ?", groupId
        );
        List<Map<String, Object>> financials = jdbcTemplate.queryForList(
            "SELECT * FROM subsidiary_financials WHERE group_id = ? AND period_label = ?", groupId, period
        );
        Map<String, Map<String, Object>> finByTenant = new HashMap<>();
        for (Map<String, Object> f : financials) {
            finByTenant.put(String.valueOf(f.get("tenant_id")), f);
        }

        List<Map<String, Object>> eliminations = jdbcTemplate.queryForList(
            "SELECT * FROM consolidation_elimination_entries WHERE group_id = ? AND period_label = ?", groupId, period
        );
        double totalElimPnl = eliminations.stream().mapToDouble(e -> ((Number) e.get("amount_reporting")).doubleValue()).sum();

        double sumRev = 0, sumCogs = 0, sumOpex = 0, sumAssets = 0, sumLiab = 0, sumEquity = 0;
        double sumIntercoRec = 0, sumIntercoPay = 0;
        double controllingNetIncome = 0, minorityNetIncome = 0;
        double controllingEquity = 0, minorityEquity = 0;

        List<Map<String, Object>> subsidiaryRows = new ArrayList<>();
        for (Map<String, Object> m : members) {
            String tid = String.valueOf(m.get("tenant_id"));
            String funcCcy = String.valueOf(m.get("functional_currency"));
            double ownPct = ((Number) m.get("ownership_pct")).doubleValue();
            double nciPct = Math.max(0.0, 100.0 - ownPct);

            Map<String, Object> f = finByTenant.get(tid);
            double rev = f != null ? convertCurrency(((Number) f.get("revenue")).doubleValue(), funcCcy, reportingCcy, fxXafPerUsd) : 0;
            double cogs = f != null ? convertCurrency(((Number) f.get("cost_of_sales")).doubleValue(), funcCcy, reportingCcy, fxXafPerUsd) : 0;
            double opex = f != null ? convertCurrency(((Number) f.get("operating_expenses")).doubleValue(), funcCcy, reportingCcy, fxXafPerUsd) : 0;
            double assets = f != null ? convertCurrency(((Number) f.get("total_assets")).doubleValue(), funcCcy, reportingCcy, fxXafPerUsd) : 0;
            double liab = f != null ? convertCurrency(((Number) f.get("total_liabilities")).doubleValue(), funcCcy, reportingCcy, fxXafPerUsd) : 0;
            double eq = f != null ? convertCurrency(((Number) f.get("equity")).doubleValue(), funcCcy, reportingCcy, fxXafPerUsd) : 0;
            double icRec = f != null ? convertCurrency(((Number) f.get("receivables_intercompany")).doubleValue(), funcCcy, reportingCcy, fxXafPerUsd) : 0;
            double icPay = f != null ? convertCurrency(((Number) f.get("payables_intercompany")).doubleValue(), funcCcy, reportingCcy, fxXafPerUsd) : 0;
            double netInc = rev - cogs - opex;

            sumRev += rev;
            sumCogs += cogs;
            sumOpex += opex;
            sumAssets += assets;
            sumLiab += liab;
            sumEquity += eq;
            sumIntercoRec += icRec;
            sumIntercoPay += icPay;
            controllingNetIncome += netInc * (ownPct / 100.0);
            minorityNetIncome += netInc * (nciPct / 100.0);
            controllingEquity += eq * (ownPct / 100.0);
            minorityEquity += eq * (nciPct / 100.0);

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("tenantId", tid);
            row.put("functionalCurrency", funcCcy);
            row.put("ownershipPct", ownPct);
            row.put("minorityInterestPct", nciPct);
            row.put("revenueReporting", round2(rev));
            row.put("cogsReporting", round2(cogs));
            row.put("opexReporting", round2(opex));
            row.put("netIncomeReporting", round2(netInc));
            row.put("assetsReporting", round2(assets));
            row.put("liabilitiesReporting", round2(liab));
            row.put("equityReporting", round2(eq));
            subsidiaryRows.add(row);
        }

        double intercoBsElim = Math.min(sumIntercoRec, sumIntercoPay);
        double consolidatedRevenue = Math.max(0.0, sumRev - totalElimPnl);
        double consolidatedCogs = Math.max(0.0, sumCogs - totalElimPnl);
        double consolidatedNetIncome = consolidatedRevenue - consolidatedCogs - sumOpex;

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("groupId", groupId);
        report.put("groupName", group.get("name"));
        report.put("period", period);
        report.put("reportingCurrency", reportingCcy);
        report.put("fxXafPerUsd", fxXafPerUsd);
        report.put("fxNote", "XAF and XOF are pegged 1:1 (CFA parity); USD converted via platform FX rate.");
        report.put("consolidatedPnl", Map.of(
            "grossRevenue", round2(sumRev),
            "intercompanyRevenueElimination", round2(totalElimPnl),
            "consolidatedRevenue", round2(consolidatedRevenue),
            "consolidatedCogs", round2(consolidatedCogs),
            "grossProfit", round2(consolidatedRevenue - consolidatedCogs),
            "operatingExpenses", round2(sumOpex),
            "consolidatedNetIncome", round2(consolidatedNetIncome),
            "controllingShareNetIncome", round2(controllingNetIncome),
            "minorityInterestNetIncome", round2(minorityNetIncome)
        ));
        report.put("consolidatedBalanceSheet", Map.of(
            "grossAssets", round2(sumAssets),
            "intercompanyBalanceElimination", round2(intercoBsElim),
            "consolidatedAssets", round2(sumAssets - intercoBsElim),
            "consolidatedLiabilities", round2(sumLiab - intercoBsElim),
            "totalEquity", round2(sumEquity),
            "controllingEquity", round2(controllingEquity),
            "minorityInterestEquity", round2(minorityEquity)
        ));
        report.put("subsidiaries", subsidiaryRows);
        report.put("eliminations", eliminations);
        report.put("generatedAt", Instant.now().toString());
        return report;
    }

    private double fetchPlatformFxRate() {
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                "SELECT xaf_per_usd_rate FROM platform_global_settings ORDER BY updated_at DESC LIMIT 1"
            );
            if (!rows.isEmpty() && rows.get(0).get("xaf_per_usd_rate") instanceof Number n && n.doubleValue() > 0) {
                return n.doubleValue();
            }
        } catch (Exception ignored) {
            // fallback to default CFA/USD rate if V13 table not loaded
        }
        return 605.0;
    }

    private static double convertCurrency(double amount, String fromCcy, String toCcy, double xafPerUsd) {
        String f = normalizeCurrency(fromCcy);
        String t = normalizeCurrency(toCcy);
        if (f.equals(t)) return amount;
        // XAF and XOF have 1:1 CFA parity
        double inXaf = "USD".equals(f) ? amount * xafPerUsd : amount;
        return "USD".equals(t) ? inXaf / xafPerUsd : inXaf;
    }

    private static String normalizeCurrency(String raw) {
        String c = raw == null ? "XAF" : raw.trim().toUpperCase();
        if ("FCFA".equals(c)) return "XAF";
        if (!Set.of("XAF", "XOF", "USD").contains(c)) {
            throw new IllegalArgumentException("Unsupported consolidation currency: " + raw + " (supported: XAF, XOF, USD).");
        }
        return c;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
