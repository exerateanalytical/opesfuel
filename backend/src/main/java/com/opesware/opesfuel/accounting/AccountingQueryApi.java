package com.opesware.opesfuel.accounting;

import java.time.Instant;
import java.util.List;

public interface AccountingQueryApi {

    record TrialBalanceLine(
        String accountCode,
        String accountName,
        String accountType,
        long debitTotalFcfa,
        long creditTotalFcfa,
        long netBalanceFcfa
    ) {}

    record FinancialSummary(
        String currency,
        long totalRevenueFcfa,
        long nonFuelRevenueFcfa,
        long cogsFcfa,
        long grossProfitFcfa,
        long operatingExpensesFcfa,
        long cashVarianceFcfa,
        long netIncomeFcfa,
        long vatPayableFcfa,
        long cashOnHandFcfa,
        long mobileMoneyClearingFcfa,
        long bankBalanceFcfa,
        long fleetReceivablesFcfa,
        long inventoryAssetFcfa,
        long accountsPayableFcfa,
        boolean trialBalanceBalanced,
        List<TrialBalanceLine> trialBalance
    ) {}

    record JournalExportRow(
        String journalId,
        String stationId,
        String reference,
        String sourceEvent,
        String description,
        Instant postedAt,
        String accountCode,
        String accountName,
        long debitFcfa,
        long creditFcfa
    ) {}

    FinancialSummary getFinancialSummary(String stationId, Instant from, Instant to);

    List<JournalExportRow> exportJournalRows(String stationId, Instant from, Instant to, int limit);
}
