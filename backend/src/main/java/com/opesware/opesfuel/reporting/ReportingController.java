package com.opesware.opesfuel.reporting;

import com.opesware.opesfuel.accounting.AccountingQueryApi;
import com.opesware.opesfuel.station.StationCatalogApi;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.*;

@Service
class ReportingService {
    private final StationCatalogApi stationCatalogApi;
    private final AccountingQueryApi accountingQueryApi;
    private final JdbcTemplate jdbcTemplate;

    ReportingService(StationCatalogApi stationCatalogApi, AccountingQueryApi accountingQueryApi, JdbcTemplate jdbcTemplate) {
        this.stationCatalogApi = stationCatalogApi;
        this.accountingQueryApi = accountingQueryApi;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional(readOnly = true)
    public ExecutiveOverviewDto buildOverview(String stationId) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        AccountingQueryApi.FinancialSummary fin = accountingQueryApi.getFinancialSummary(stationId, null, null);

        int openShifts = 0;
        int totalPumps = 0;
        int lowStockTanks = 0;
        int totalTanks = 0;
        BigDecimal totalBookLitres = BigDecimal.ZERO;

        if (!stationIds.isEmpty()) {
            String ph = String.join(",", Collections.nCopies(stationIds.size(), "?"));
            Object[] args = stationIds.toArray();

            Integer os = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM shift_records WHERE station_id IN (" + ph + ") AND status = 'OPEN' AND voided = FALSE",
                Integer.class, args
            );
            Integer tp = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM pumps WHERE station_id IN (" + ph + ")",
                Integer.class, args
            );
            Integer tt = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM fuel_tanks WHERE station_id IN (" + ph + ")",
                Integer.class, args
            );
            Integer ls = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM fuel_tanks WHERE station_id IN (" + ph + ") AND capacity_litres > 0 AND (book_volume_litres / capacity_litres) < 0.20",
                Integer.class, args
            );
            BigDecimal sumL = jdbcTemplate.queryForObject(
                "SELECT COALESCE(SUM(book_volume_litres), 0) FROM fuel_tanks WHERE station_id IN (" + ph + ")",
                BigDecimal.class, args
            );
            openShifts = os != null ? os : 0;
            totalPumps = tp != null ? tp : 0;
            totalTanks = tt != null ? tt : 0;
            lowStockTanks = ls != null ? ls : 0;
            totalBookLitres = sumL != null ? sumL : BigDecimal.ZERO;
        }

        return new ExecutiveOverviewDto(
            stationId != null ? stationId : "ALL",
            "FCFA",
            stationIds.size(),
            totalPumps,
            openShifts,
            totalTanks,
            lowStockTanks,
            totalBookLitres,
            fin.totalRevenueFcfa(),
            fin.nonFuelRevenueFcfa(),
            fin.grossProfitFcfa(),
            fin.netIncomeFcfa(),
            fin.cashOnHandFcfa(),
            fin.mobileMoneyClearingFcfa(),
            fin.bankBalanceFcfa(),
            fin.fleetReceivablesFcfa(),
            fin.inventoryAssetFcfa(),
            fin.vatPayableFcfa(),
            fin.trialBalanceBalanced(),
            Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public DailyZReportDto buildDailyZReport(String stationId, LocalDate date) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        LocalDate target = date != null ? date : LocalDate.now(ZoneOffset.UTC);
        Instant start = target.atStartOfDay().toInstant(ZoneOffset.UTC);
        Instant end = target.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC);

        if (stationIds.isEmpty()) {
            return new DailyZReportDto(stationId, target.toString(), "FCFA", 0, BigDecimal.ZERO, 0, 0, 0, 0, 0, 0, Instant.now());
        }

        String ph = String.join(",", Collections.nCopies(stationIds.size(), "?"));
        List<Object> params = new ArrayList<>(stationIds);
        params.add(Timestamp.from(start));
        params.add(Timestamp.from(end));

        return jdbcTemplate.queryForObject(
            "SELECT COUNT(*) AS closed_shifts, " +
            "COALESCE(SUM(closing_meter_litres - opening_meter_litres), 0) AS litres_sold, " +
            "COALESCE(SUM(cash_fcfa), 0) AS cash_total, " +
            "COALESCE(SUM(mobile_money_fcfa), 0) AS momo_total, " +
            "COALESCE(SUM(card_fcfa), 0) AS card_total, " +
            "COALESCE(SUM(fleet_credit_fcfa), 0) AS fleet_total, " +
            "COALESCE(SUM(variance_fcfa), 0) AS variance_total " +
            "FROM shift_records WHERE station_id IN (" + ph + ") AND status = 'CLOSED' AND voided = FALSE AND closed_at >= ? AND closed_at < ?",
            (rs, rowNum) -> {
                long cash = rs.getLong("cash_total");
                long momo = rs.getLong("momo_total");
                long card = rs.getLong("card_total");
                long fleet = rs.getLong("fleet_total");
                return new DailyZReportDto(
                    stationId,
                    target.toString(),
                    "FCFA",
                    rs.getInt("closed_shifts"),
                    rs.getBigDecimal("litres_sold"),
                    cash, momo, card, fleet,
                    cash + momo + card + fleet,
                    rs.getLong("variance_total"),
                    Instant.now()
                );
            },
            params.toArray()
        );
    }

    @Transactional(readOnly = true)
    public String exportTrialBalanceCsv(String stationId, Instant from, Instant to) {
        AccountingQueryApi.FinancialSummary fin = accountingQueryApi.getFinancialSummary(stationId, from, to);
        StringBuilder csv = new StringBuilder("account_code,account_name,account_type,debit_fcfa,credit_fcfa,net_balance_fcfa\n");
        for (AccountingQueryApi.TrialBalanceLine row : fin.trialBalance()) {
            csv.append(escapeCsv(row.accountCode())).append(',')
                .append(escapeCsv(row.accountName())).append(',')
                .append(escapeCsv(row.accountType())).append(',')
                .append(row.debitTotalFcfa()).append(',')
                .append(row.creditTotalFcfa()).append(',')
                .append(row.netBalanceFcfa()).append('\n');
        }
        return csv.toString();
    }

    @Transactional(readOnly = true)
    public String exportJournalsCsv(String stationId, Instant from, Instant to, int limit) {
        List<AccountingQueryApi.JournalExportRow> rows = accountingQueryApi.exportJournalRows(stationId, from, to, limit);
        StringBuilder csv = new StringBuilder("journal_id,station_id,posted_at,reference,source_event,account_code,account_name,debit_fcfa,credit_fcfa,description\n");
        for (AccountingQueryApi.JournalExportRow row : rows) {
            csv.append(escapeCsv(row.journalId())).append(',')
                .append(escapeCsv(row.stationId())).append(',')
                .append(escapeCsv(row.postedAt().toString())).append(',')
                .append(escapeCsv(row.reference())).append(',')
                .append(escapeCsv(row.sourceEvent())).append(',')
                .append(escapeCsv(row.accountCode())).append(',')
                .append(escapeCsv(row.accountName())).append(',')
                .append(row.debitFcfa()).append(',')
                .append(row.creditFcfa()).append(',')
                .append(escapeCsv(row.description())).append('\n');
        }
        return csv.toString();
    }

    private static String escapeCsv(String value) {
        if (value == null) return "";
        String clean = value.replace("\"", "\"\"");
        if (clean.contains(",") || clean.contains("\"") || clean.contains("\n")) {
            return "\"" + clean + "\"";
        }
        return clean;
    }
}

record ExecutiveOverviewDto(
    String stationScope,
    String currency,
    int stationCount,
    int totalPumps,
    int activeOpenShifts,
    int totalTanks,
    int lowStockTanks,
    BigDecimal totalFuelInventoryLitres,
    long totalRevenueFcfa,
    long nonFuelRevenueFcfa,
    long grossProfitFcfa,
    long netIncomeFcfa,
    long cashOnHandFcfa,
    long mobileMoneyClearingFcfa,
    long bankBalanceFcfa,
    long fleetReceivablesFcfa,
    long inventoryAssetFcfa,
    long vatPayableFcfa,
    boolean trialBalanceBalanced,
    Instant generatedAt
) {}

record DailyZReportDto(
    String stationScope,
    String date,
    String currency,
    int closedShiftCount,
    BigDecimal totalLitresDispensed,
    long cashCollectedFcfa,
    long mobileMoneyCollectedFcfa,
    long cardCollectedFcfa,
    long fleetCreditFcfa,
    long totalDeclaredTenderFcfa,
    long totalCashVarianceFcfa,
    Instant generatedAt
) {}

@RestController
@RequestMapping("/api/v1/reporting")
public class ReportingController {
    private final ReportingService service;

    public ReportingController(ReportingService service) {
        this.service = service;
    }

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_reporting:read')")
    public ExecutiveOverviewDto getOverview(@RequestParam(required = false, defaultValue = "ALL") String stationId) {
        return service.buildOverview(stationId);
    }

    @GetMapping("/z-report")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_reporting:read')")
    public DailyZReportDto getDailyZReport(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false) LocalDate date
    ) {
        return service.buildDailyZReport(stationId, date);
    }

    @GetMapping(value = "/export/trial-balance.csv", produces = "text/csv")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_reporting:read') or hasAuthority('SCOPE_accounting:read')")
    public ResponseEntity<String> exportTrialBalanceCsv(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false) Instant from,
        @RequestParam(required = false) Instant to
    ) {
        String csv = service.exportTrialBalanceCsv(stationId, from, to);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"opesfuel-trial-balance.csv\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(csv);
    }

    @GetMapping(value = "/export/journals.csv", produces = "text/csv")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_reporting:read') or hasAuthority('SCOPE_accounting:read')")
    public ResponseEntity<String> exportJournalsCsv(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false) Instant from,
        @RequestParam(required = false) Instant to,
        @RequestParam(required = false, defaultValue = "500") int limit
    ) {
        String csv = service.exportJournalsCsv(stationId, from, to, limit);
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"opesfuel-journals.csv\"")
            .contentType(MediaType.parseMediaType("text/csv"))
            .body(csv);
    }
}
