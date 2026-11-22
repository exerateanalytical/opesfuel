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
import org.springframework.web.server.ResponseStatusException;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

record CreateHoldingGroupCommand(
    @NotBlank String name,
    @NotBlank String reportingCurrency
) {}

record UpdateHoldingGroupCommand(
    String name,
    String reportingCurrency
) {}

record AddSubsidiaryMemberCommand(
    @NotBlank String tenantId,
    @NotBlank String functionalCurrency,
    @Min(1) @Max(100) double ownershipPct,
    String entityName,
    String countryLabel
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

    @PatchMapping("/groups/{groupId}")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO')")
    public Map<String, Object> updateGroup(
        @PathVariable String groupId,
        @RequestBody UpdateHoldingGroupCommand cmd
    ) {
        List<Map<String, Object>> existing = jdbcTemplate.queryForList("SELECT * FROM holding_groups WHERE id = ?", groupId);
        if (existing.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Holding group not found: " + groupId);
        }
        String nextName = cmd.name() != null && !cmd.name().isBlank()
            ? cmd.name().trim() : String.valueOf(existing.get(0).get("name"));
        String nextCcy = cmd.reportingCurrency() != null && !cmd.reportingCurrency().isBlank()
            ? normalizeCurrency(cmd.reportingCurrency()) : String.valueOf(existing.get(0).get("reporting_currency"));
        jdbcTemplate.update(
            "UPDATE holding_groups SET name = ?, reporting_currency = ? WHERE id = ?",
            nextName, nextCcy, groupId
        );
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        auditRecorder.record(principal.tenantId(), null, principal.subject(), "GROUP_CFO",
            "HOLDING_GROUP_UPDATED", "HOLDING_GROUP", groupId,
            "Updated holding group " + nextName + " (reporting=" + nextCcy + ")");
        return jdbcTemplate.queryForMap("SELECT * FROM holding_groups WHERE id = ?", groupId);
    }

    @PostMapping("/groups/{groupId}/members")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO')")
    public Map<String, Object> addSubsidiary(@PathVariable String groupId, @Valid @RequestBody AddSubsidiaryMemberCommand cmd) {
        String id = "hmem_" + UUID.randomUUID().toString().substring(0, 10);
        String ccy = normalizeCurrency(cmd.functionalCurrency());
        Timestamp now = Timestamp.from(Instant.now());
        String entityName = cmd.entityName() != null && !cmd.entityName().isBlank() ? cmd.entityName().trim() : cmd.tenantId().trim();
        String countryLabel = cmd.countryLabel() != null && !cmd.countryLabel().isBlank() ? cmd.countryLabel().trim() : ccy;
        try {
            jdbcTemplate.update(
                "INSERT INTO holding_group_members (id, group_id, tenant_id, functional_currency, ownership_pct, entity_name, country_label, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id, groupId, cmd.tenantId().trim(), ccy, cmd.ownershipPct(), entityName, countryLabel, now
            );
        } catch (Exception ex) {
            // Backward compatibility when V25 columns are not yet applied in legacy V22-only unit tests
            jdbcTemplate.update(
                "INSERT INTO holding_group_members (id, group_id, tenant_id, functional_currency, ownership_pct, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                id, groupId, cmd.tenantId().trim(), ccy, cmd.ownershipPct(), now
            );
        }
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        auditRecorder.record(principal.tenantId(), null, principal.subject(), "GROUP_CFO",
            "HOLDING_SUBSIDIARY_LINKED", "HOLDING_MEMBER", id,
            "Linked subsidiary " + entityName + " (" + cmd.tenantId().trim() + ", " + cmd.ownershipPct() + "%, " + ccy + ") to " + groupId);
        return jdbcTemplate.queryForMap("SELECT * FROM holding_group_members WHERE id = ?", id);
    }

    @DeleteMapping("/groups/{groupId}/members/{memberId}")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO')")
    public Map<String, Object> removeSubsidiary(@PathVariable String groupId, @PathVariable String memberId) {
        int deleted = jdbcTemplate.update(
            "DELETE FROM holding_group_members WHERE group_id = ? AND (id = ? OR tenant_id = ?)",
            groupId, memberId, memberId
        );
        if (deleted == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Subsidiary member not found: " + memberId);
        }
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        auditRecorder.record(principal.tenantId(), null, principal.subject(), "GROUP_CFO",
            "HOLDING_SUBSIDIARY_REMOVED", "HOLDING_MEMBER", memberId,
            "Removed subsidiary " + memberId + " from holding group " + groupId);
        return Map.of("groupId", groupId, "removed", memberId, "deleted", true);
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
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        auditRecorder.record(principal.tenantId(), null, principal.subject(), "GROUP_CFO",
            "SUBSIDIARY_FINANCIALS_SUBMITTED", "SUBSIDIARY_FINANCIALS", id,
            "Submitted period " + cmd.periodLabel() + " financials for " + cmd.tenantId() + " (rev=" + cmd.revenue() + ")");
        return jdbcTemplate.queryForMap("SELECT * FROM subsidiary_financials WHERE id = ?", id);
    }

    @GetMapping("/groups/{groupId}/intercompany")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listIntercompany(
        @PathVariable String groupId,
        @RequestParam(required = false) String period
    ) {
        if (period != null && !period.isBlank()) {
            return jdbcTemplate.queryForList(
                "SELECT * FROM intercompany_transactions WHERE group_id = ? AND period_label = ? ORDER BY created_at DESC",
                groupId, period.trim()
            );
        }
        return jdbcTemplate.queryForList(
            "SELECT * FROM intercompany_transactions WHERE group_id = ? ORDER BY created_at DESC LIMIT 100",
            groupId
        );
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
        auditRecorder.record(principal.tenantId(), null, principal.subject(), "GROUP_CFO",
            "INTERCOMPANY_TX_RECORDED", "INTERCOMPANY_TX", id,
            "Recorded inter-company tx " + cmd.sellerTenantId() + " -> " + cmd.buyerTenantId() + " (" + cmd.amount() + " " + cmd.currency() + ")");
        return jdbcTemplate.queryForMap("SELECT * FROM intercompany_transactions WHERE id = ?", id);
    }

    @GetMapping("/groups/{groupId}/eliminations")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','GROUP_CFO','OWNER','ACCOUNTANT')")
    public List<Map<String, Object>> listEliminations(
        @PathVariable String groupId,
        @RequestParam(required = false) String period
    ) {
        if (period != null && !period.isBlank()) {
            return jdbcTemplate.queryForList(
                "SELECT * FROM consolidation_elimination_entries WHERE group_id = ? AND period_label = ? ORDER BY created_at DESC",
                groupId, period.trim()
            );
        }
        return jdbcTemplate.queryForList(
            "SELECT * FROM consolidation_elimination_entries WHERE group_id = ? ORDER BY created_at DESC LIMIT 100",
            groupId
        );
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
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        auditRecorder.record(principal.tenantId(), null, principal.subject(), "GROUP_CFO",
            "CONSOLIDATION_ELIMINATIONS_EXECUTED", "HOLDING_GROUP", groupId,
            "Eliminated " + eliminatedCount + " inter-company tx for " + period + " totaling " + round2(totalEliminatedReporting) + " " + reportingCcy);

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
        @RequestParam String period,
        @RequestParam(required = false) String reportingCurrency,
        @RequestParam(required = false) Double fxXafPerUsdOverride
    ) {
        Map<String, Object> group = jdbcTemplate.queryForMap("SELECT * FROM holding_groups WHERE id = ?", groupId);
        String reportingCcy = reportingCurrency != null && !reportingCurrency.isBlank()
            ? normalizeCurrency(reportingCurrency)
            : String.valueOf(group.get("reporting_currency"));
        double fxXafPerUsd = (fxXafPerUsdOverride != null && fxXafPerUsdOverride > 0)
            ? fxXafPerUsdOverride
            : fetchPlatformFxRate();

        List<Map<String, Object>> members = jdbcTemplate.queryForList(
            "SELECT * FROM holding_group_members WHERE group_id = ? ORDER BY ownership_pct DESC", groupId
        );
        List<Map<String, Object>> financials = jdbcTemplate.queryForList(
            "SELECT * FROM subsidiary_financials WHERE group_id = ? AND period_label = ?", groupId, period
        );
        Map<String, Map<String, Object>> finByTenant = new HashMap<>();
        for (Map<String, Object> f : financials) {
            finByTenant.put(String.valueOf(f.get("tenant_id")), f);
        }

        List<Map<String, Object>> eliminations = jdbcTemplate.queryForList(
            "SELECT * FROM consolidation_elimination_entries WHERE group_id = ? AND period_label = ? ORDER BY created_at DESC", groupId, period
        );
        String groupBaseCcy = String.valueOf(group.get("reporting_currency"));
        double totalElimPnl = eliminations.stream()
            .mapToDouble(e -> convertCurrency(((Number) e.get("amount_reporting")).doubleValue(), groupBaseCcy, reportingCcy, fxXafPerUsd))
            .sum();

        List<Map<String, Object>> intercompanyTx = jdbcTemplate.queryForList(
            "SELECT * FROM intercompany_transactions WHERE group_id = ? AND period_label = ? ORDER BY created_at DESC", groupId, period
        );
        long pendingIntercoCount = intercompanyTx.stream().filter(t -> !Boolean.TRUE.equals(t.get("eliminated"))).count();
        double pendingIntercoReporting = intercompanyTx.stream()
            .filter(t -> !Boolean.TRUE.equals(t.get("eliminated")))
            .mapToDouble(t -> convertCurrency(((Number) t.get("amount")).doubleValue(), String.valueOf(t.get("currency")), reportingCcy, fxXafPerUsd))
            .sum();

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
            String entityName = m.get("entity_name") != null && !String.valueOf(m.get("entity_name")).isBlank()
                ? String.valueOf(m.get("entity_name")) : tid;
            String countryLabel = m.get("country_label") != null && !String.valueOf(m.get("country_label")).isBlank()
                ? String.valueOf(m.get("country_label")) : funcCcy;

            Map<String, Object> f = finByTenant.get(tid);
            double revFunc = f != null ? ((Number) f.get("revenue")).doubleValue() : 0;
            double cogsFunc = f != null ? ((Number) f.get("cost_of_sales")).doubleValue() : 0;
            double opexFunc = f != null ? ((Number) f.get("operating_expenses")).doubleValue() : 0;
            double assetsFunc = f != null ? ((Number) f.get("total_assets")).doubleValue() : 0;
            double liabFunc = f != null ? ((Number) f.get("total_liabilities")).doubleValue() : 0;
            double eqFunc = f != null ? ((Number) f.get("equity")).doubleValue() : 0;
            double icRecFunc = f != null ? ((Number) f.get("receivables_intercompany")).doubleValue() : 0;
            double icPayFunc = f != null ? ((Number) f.get("payables_intercompany")).doubleValue() : 0;

            double rev = convertCurrency(revFunc, funcCcy, reportingCcy, fxXafPerUsd);
            double cogs = convertCurrency(cogsFunc, funcCcy, reportingCcy, fxXafPerUsd);
            double opex = convertCurrency(opexFunc, funcCcy, reportingCcy, fxXafPerUsd);
            double assets = convertCurrency(assetsFunc, funcCcy, reportingCcy, fxXafPerUsd);
            double liab = convertCurrency(liabFunc, funcCcy, reportingCcy, fxXafPerUsd);
            double eq = convertCurrency(eqFunc, funcCcy, reportingCcy, fxXafPerUsd);
            double icRec = convertCurrency(icRecFunc, funcCcy, reportingCcy, fxXafPerUsd);
            double icPay = convertCurrency(icPayFunc, funcCcy, reportingCcy, fxXafPerUsd);
            double netInc = rev - cogs - opex;
            double grossMarginPct = rev > 0 ? round2(((rev - cogs) / rev) * 100.0) : 0.0;
            double netMarginPct = rev > 0 ? round2((netInc / rev) * 100.0) : 0.0;
            double debtToEquity = eq > 0 ? round2(liab / eq) : 0.0;
            double roaPct = assets > 0 ? round2((netInc / assets) * 100.0) : 0.0;

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
            row.put("memberId", m.get("id"));
            row.put("tenantId", tid);
            row.put("entityName", entityName);
            row.put("countryLabel", countryLabel);
            row.put("functionalCurrency", funcCcy);
            row.put("ownershipPct", ownPct);
            row.put("minorityInterestPct", nciPct);
            row.put("revenueFunctional", round2(revFunc));
            row.put("cogsFunctional", round2(cogsFunc));
            row.put("opexFunctional", round2(opexFunc));
            row.put("assetsFunctional", round2(assetsFunc));
            row.put("liabilitiesFunctional", round2(liabFunc));
            row.put("equityFunctional", round2(eqFunc));
            row.put("intercoReceivablesFunctional", round2(icRecFunc));
            row.put("intercoPayablesFunctional", round2(icPayFunc));
            row.put("revenueReporting", round2(rev));
            row.put("cogsReporting", round2(cogs));
            row.put("opexReporting", round2(opex));
            row.put("netIncomeReporting", round2(netInc));
            row.put("assetsReporting", round2(assets));
            row.put("liabilitiesReporting", round2(liab));
            row.put("equityReporting", round2(eq));
            row.put("grossMarginPct", grossMarginPct);
            row.put("netMarginPct", netMarginPct);
            row.put("debtToEquityRatio", debtToEquity);
            row.put("roaPct", roaPct);
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
        report.put("pendingIntercompanyCount", pendingIntercoCount);
        report.put("pendingIntercompanyReporting", round2(pendingIntercoReporting));
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
        report.put("intercompanyTransactions", intercompanyTx);
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
