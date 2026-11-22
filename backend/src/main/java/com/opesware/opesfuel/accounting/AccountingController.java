package com.opesware.opesfuel.accounting;

import com.opesware.opesfuel.shared.domain.DomainEnums;
import com.opesware.opesfuel.shared.domain.DomainEnums.ExpenseCategory;
import com.opesware.opesfuel.shared.domain.DomainEnums.ExpensePaymentSource;
import com.opesware.opesfuel.shared.domain.DomainEnums.TreasurySourceAccount;
import com.opesware.opesfuel.shared.events.DomainEvent.*;
import com.opesware.opesfuel.station.StationCatalogApi;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Entity
@Table(name = "accounts")
class AccountEntity {
    @Id
    private String code;
    @Column(nullable = false)
    private String name;
    @Column(name = "account_type", nullable = false)
    private String accountType;

    public String getCode() { return code; }
    public String getName() { return name; }
    public String getAccountType() { return accountType; }
}

@Entity
@Table(name = "journal_entries")
class JournalEntryEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(nullable = false)
    private String reference;
    @Column(name = "source_event", nullable = false)
    private String sourceEvent;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;
    @Column(name = "posted_at", nullable = false)
    private Instant postedAt;
    @Column(name = "reversed_entry_id")
    private String reversedEntryId;

    @OneToMany(mappedBy = "journalEntry", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<JournalLineEntity> lines = new ArrayList<>();

    public static JournalEntryEntity createBalanced(
        String stationId, String reference, String sourceEvent, String description, List<LineSpec> specs, String reversedEntryId
    ) {
        long totalDebit = 0L;
        long totalCredit = 0L;
        for (LineSpec spec : specs) {
            if (spec.debitFcfa() < 0 || spec.creditFcfa() < 0) {
                throw new IllegalArgumentException("Journal line debit and credit values must be non-negative.");
            }
            totalDebit = Math.addExact(totalDebit, spec.debitFcfa());
            totalCredit = Math.addExact(totalCredit, spec.creditFcfa());
        }
        if (totalDebit != totalCredit || totalDebit <= 0) {
            throw new IllegalStateException("Unbalanced double-entry journal rejected: debit=" + totalDebit + ", credit=" + totalCredit);
        }
        JournalEntryEntity entry = new JournalEntryEntity();
        entry.id = "je_" + UUID.randomUUID();
        entry.stationId = stationId;
        entry.reference = reference;
        entry.sourceEvent = sourceEvent;
        entry.description = description;
        entry.postedAt = Instant.now();
        entry.reversedEntryId = reversedEntryId;

        for (LineSpec spec : specs) {
            if (spec.debitFcfa() == 0 && spec.creditFcfa() == 0) continue;
            JournalLineEntity line = new JournalLineEntity();
            line.setId("jl_" + UUID.randomUUID());
            line.setJournalEntry(entry);
            line.setAccountCode(spec.accountCode());
            line.setDebitFcfa(spec.debitFcfa());
            line.setCreditFcfa(spec.creditFcfa());
            entry.lines.add(line);
        }
        return entry;
    }

    public static JournalEntryEntity createBalanced(String stationId, String reference, String sourceEvent, String description, List<LineSpec> specs) {
        return createBalanced(stationId, reference, sourceEvent, description, specs, null);
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getReference() { return reference; }
    public String getSourceEvent() { return sourceEvent; }
    public String getDescription() { return description; }
    public Instant getPostedAt() { return postedAt; }
    public String getReversedEntryId() { return reversedEntryId; }
    public List<JournalLineEntity> getLines() { return lines; }
}

@Entity
@Table(name = "journal_lines")
class JournalLineEntity {
    @Id
    private String id;
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "journal_entry_id", nullable = false)
    private JournalEntryEntity journalEntry;
    @Column(name = "account_code", nullable = false)
    private String accountCode;
    @Column(name = "debit_fcfa", nullable = false)
    private long debitFcfa;
    @Column(name = "credit_fcfa", nullable = false)
    private long creditFcfa;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public void setJournalEntry(JournalEntryEntity journalEntry) { this.journalEntry = journalEntry; }
    public String getAccountCode() { return accountCode; }
    public void setAccountCode(String accountCode) { this.accountCode = accountCode; }
    public long getDebitFcfa() { return debitFcfa; }
    public void setDebitFcfa(long debitFcfa) { this.debitFcfa = debitFcfa; }
    public long getCreditFcfa() { return creditFcfa; }
    public void setCreditFcfa(long creditFcfa) { this.creditFcfa = creditFcfa; }
}

@Entity
@Table(name = "expenses")
class ExpenseEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(nullable = false)
    private String category;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String description;
    @Column(name = "amount_fcfa", nullable = false)
    private long amountFcfa;
    @Column(name = "payment_source", nullable = false)
    private String paymentSource;
    @Column(nullable = false)
    private String status = "POSTED";
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
    @Column(nullable = false)
    private boolean voided;
    @Column(name = "voided_at")
    private Instant voidedAt;

    public static ExpenseEntity create(String stationId, String category, String description, long amountFcfa, String paymentSource) {
        ExpenseCategory validatedCat = DomainEnums.parse(ExpenseCategory.class, category, "category");
        ExpensePaymentSource validatedSrc = DomainEnums.parse(ExpensePaymentSource.class, paymentSource, "paymentSource");
        ExpenseEntity e = new ExpenseEntity();
        e.id = "exp_" + UUID.randomUUID();
        e.stationId = stationId;
        e.category = validatedCat.name();
        e.description = description.trim();
        e.amountFcfa = amountFcfa;
        e.paymentSource = validatedSrc.name();
        e.status = "POSTED";
        e.createdAt = Instant.now();
        e.voided = false;
        return e;
    }

    public void markVoided() {
        if (this.voided) {
            throw new IllegalStateException("Expense " + this.id + " is already voided.");
        }
        this.voided = true;
        this.voidedAt = Instant.now();
        this.status = "VOIDED";
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getCategory() { return category; }
    public String getDescription() { return description; }
    public long getAmountFcfa() { return amountFcfa; }
    public String getPaymentSource() { return paymentSource; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
    public boolean isVoided() { return voided; }
}

@Entity
@Table(name = "treasury_deposits")
class TreasuryDepositEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "source_account", nullable = false)
    private String sourceAccount;
    @Column(name = "bank_name", nullable = false)
    private String bankName;
    @Column(name = "slip_reference", nullable = false)
    private String slipReference;
    @Column(name = "amount_fcfa", nullable = false)
    private long amountFcfa;
    @Column(name = "deposited_at", nullable = false)
    private Instant depositedAt;
    @Column(nullable = false)
    private boolean voided;
    @Column(name = "voided_at")
    private Instant voidedAt;

    public static TreasuryDepositEntity create(String stationId, String sourceAccount, String bankName, String slipReference, long amountFcfa) {
        TreasurySourceAccount validatedSource = DomainEnums.parse(TreasurySourceAccount.class, sourceAccount, "sourceAccount");
        TreasuryDepositEntity dep = new TreasuryDepositEntity();
        dep.id = "dep_" + UUID.randomUUID();
        dep.stationId = stationId;
        dep.sourceAccount = validatedSource.name();
        dep.bankName = bankName.trim();
        dep.slipReference = slipReference.trim();
        dep.amountFcfa = amountFcfa;
        dep.depositedAt = Instant.now();
        dep.voided = false;
        return dep;
    }

    public void markVoided() {
        if (this.voided) {
            throw new IllegalStateException("Treasury deposit " + this.id + " is already voided.");
        }
        this.voided = true;
        this.voidedAt = Instant.now();
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getSourceAccount() { return sourceAccount; }
    public String getBankName() { return bankName; }
    public String getSlipReference() { return slipReference; }
    public long getAmountFcfa() { return amountFcfa; }
    public Instant getDepositedAt() { return depositedAt; }
    public boolean isVoided() { return voided; }
}

record LineSpec(String accountCode, long debitFcfa, long creditFcfa) {}

interface AccountRepository extends JpaRepository<AccountEntity, String> {
    List<AccountEntity> findAllByOrderByCodeAsc();
}

interface JournalEntryRepository extends JpaRepository<JournalEntryEntity, String> {
    List<JournalEntryEntity> findByStationIdInOrderByPostedAtDesc(List<String> stationIds, PageRequest pageable);
    Optional<JournalEntryEntity> findFirstByStationIdAndReferenceOrderByPostedAtDesc(String stationId, String reference);
}

interface ExpenseRepository extends JpaRepository<ExpenseEntity, String> {
    List<ExpenseEntity> findByStationIdInAndVoidedFalseOrderByCreatedAtDesc(List<String> stationIds, PageRequest pageable);
}

interface TreasuryDepositRepository extends JpaRepository<TreasuryDepositEntity, String> {
    List<TreasuryDepositEntity> findByStationIdInAndVoidedFalseOrderByDepositedAtDesc(List<String> stationIds, PageRequest pageable);
}

@Entity
@Table(name = "fiscal_periods")
class FiscalPeriodEntity {
    @Id
    private String id;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "period_key", nullable = false)
    private String periodKey;
    @Column(nullable = false)
    private String status;
    @Column(name = "closed_by")
    private String closedBy;
    @Column(name = "closed_at")
    private Instant closedAt;

    public static FiscalPeriodEntity close(String stationId, String periodKey, String closedBy) {
        FiscalPeriodEntity p = new FiscalPeriodEntity();
        p.id = "fp_" + UUID.randomUUID();
        p.stationId = stationId;
        p.periodKey = periodKey.trim();
        p.status = "CLOSED";
        p.closedBy = closedBy;
        p.closedAt = Instant.now();
        return p;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getPeriodKey() { return periodKey; }
    public String getStatus() { return status; }
    public String getClosedBy() { return closedBy; }
    public Instant getClosedAt() { return closedAt; }
}

interface FiscalPeriodRepository extends JpaRepository<FiscalPeriodEntity, String> {
    List<FiscalPeriodEntity> findByStationIdInOrderByPeriodKeyDesc(List<String> stationIds);
    boolean existsByStationIdAndPeriodKeyAndStatus(String stationId, String periodKey, String status);
}

@Service
class AccountingAutomationService implements AccountingQueryApi {
    private final AccountRepository accountRepo;
    private final JournalEntryRepository journalRepo;
    private final ExpenseRepository expenseRepo;
    private final TreasuryDepositRepository depositRepo;
    private final FiscalPeriodRepository fiscalPeriodRepo;
    private final StationCatalogApi stationCatalogApi;
    private final com.opesware.opesfuel.shared.security.TenantAccessGuard accessGuard;
    private final JdbcTemplate jdbcTemplate;
    private final ApplicationEventPublisher eventPublisher;
    private final BigDecimal vatRate;

    AccountingAutomationService(
        AccountRepository accountRepo,
        JournalEntryRepository journalRepo,
        ExpenseRepository expenseRepo,
        TreasuryDepositRepository depositRepo,
        FiscalPeriodRepository fiscalPeriodRepo,
        StationCatalogApi stationCatalogApi,
        com.opesware.opesfuel.shared.security.TenantAccessGuard accessGuard,
        JdbcTemplate jdbcTemplate,
        ApplicationEventPublisher eventPublisher,
        @Value("${opesfuel.tax.vat-rate:0.1925}") BigDecimal vatRate
    ) {
        this.accountRepo = accountRepo;
        this.journalRepo = journalRepo;
        this.expenseRepo = expenseRepo;
        this.depositRepo = depositRepo;
        this.fiscalPeriodRepo = fiscalPeriodRepo;
        this.stationCatalogApi = stationCatalogApi;
        this.accessGuard = accessGuard;
        this.jdbcTemplate = jdbcTemplate;
        this.eventPublisher = eventPublisher;
        this.vatRate = vatRate != null && vatRate.compareTo(BigDecimal.ZERO) >= 0 ? vatRate : new BigDecimal("0.1925");
    }

    @Override
    @Transactional(readOnly = true)
    public FinancialSummary getFinancialSummary(String stationId, Instant from, Instant to) {
        FinancialReportBundleDto dto = buildFinancialReport(stationId, from, to);
        List<TrialBalanceLine> tb = dto.trialBalance().stream()
            .map(r -> new TrialBalanceLine(r.accountCode(), r.accountName(), r.accountType(), r.debitTotalFcfa(), r.creditTotalFcfa(), r.netBalanceFcfa()))
            .toList();
        return new FinancialSummary(
            dto.currency(), dto.totalRevenueFcfa(), dto.nonFuelRevenueFcfa(), dto.cogsFcfa(), dto.grossProfitFcfa(),
            dto.operatingExpensesFcfa(), dto.cashVarianceFcfa(), dto.netIncomeFcfa(), dto.vatPayableFcfa(),
            dto.cashOnHandFcfa(), dto.mobileMoneyClearingFcfa(), dto.bankBalanceFcfa(), dto.fleetReceivablesFcfa(),
            dto.inventoryAssetFcfa(), dto.accountsPayableFcfa(), dto.trialBalanceBalanced(), tb
        );
    }

    @Override
    @Transactional(readOnly = true)
    public List<JournalExportRow> exportJournalRows(String stationId, Instant from, Instant to, int limit) {
        List<JournalEntryDto> entries = listJournals(stationId, Math.max(1, Math.min(limit, 500)));
        List<JournalExportRow> rows = new ArrayList<>();
        for (JournalEntryDto je : entries) {
            if (from != null && je.postedAt().isBefore(from)) continue;
            if (to != null && je.postedAt().isAfter(to)) continue;
            for (JournalLineDto line : je.lines()) {
                rows.add(new JournalExportRow(
                    je.id(), je.stationId(), je.reference(), je.sourceEvent(), je.description(),
                    je.postedAt(), line.accountCode(), line.accountName(), line.debitFcfa(), line.creditFcfa()
                ));
            }
        }
        return rows;
    }

    @Transactional(readOnly = true)
    public List<FiscalPeriodEntity> listFiscalPeriods(String stationId) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return fiscalPeriodRepo.findByStationIdInOrderByPeriodKeyDesc(stationIds);
    }

    @Transactional
    public FiscalPeriodEntity closeFiscalPeriod(CloseFiscalPeriodCommand cmd) {
        stationCatalogApi.requireAccessibleStation(cmd.stationId());
        if (!cmd.periodKey().matches("\\d{4}-\\d{2}")) {
            throw new IllegalArgumentException("periodKey must follow YYYY-MM format (e.g. 2026-11).");
        }
        Long openShifts = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM shift_records WHERE station_id = ? AND status = 'OPEN' AND voided = FALSE",
            Long.class,
            cmd.stationId()
        );
        if (openShifts != null && openShifts > 0) {
            throw new IllegalStateException(
                "Cannot close fiscal period " + cmd.periodKey() + " while " + openShifts + " pump shift(s) remain OPEN (T020)."
            );
        }
        if (fiscalPeriodRepo.existsByStationIdAndPeriodKeyAndStatus(cmd.stationId(), cmd.periodKey(), "CLOSED")) {
            throw new IllegalStateException("Fiscal period " + cmd.periodKey() + " is already CLOSED for station " + cmd.stationId());
        }
        return fiscalPeriodRepo.save(FiscalPeriodEntity.close(
            cmd.stationId(), cmd.periodKey(), accessGuard.currentPrincipal().principalId()
        ));
    }

    private void assertCurrentPeriodOpen(String stationId) {
        String currentPeriod = java.time.YearMonth.now(java.time.ZoneOffset.UTC).toString();
        if (fiscalPeriodRepo.existsByStationIdAndPeriodKeyAndStatus(stationId, currentPeriod, "CLOSED")) {
            throw new IllegalStateException("Fiscal period " + currentPeriod + " is CLOSED for station " + stationId + "; new postings are locked.");
        }
    }

    long extractInclusiveVatFcfa(long grossFcfa) {
        if (grossFcfa <= 0 || vatRate.compareTo(BigDecimal.ZERO) <= 0) {
            return 0L;
        }
        BigDecimal gross = BigDecimal.valueOf(grossFcfa);
        BigDecimal divisor = BigDecimal.ONE.add(vatRate);
        return gross.multiply(vatRate).divide(divisor, 0, RoundingMode.HALF_UP).longValue();
    }

    @ApplicationModuleListener
    public void onShiftClosed(ShiftClosedEvent event) {
        long cogsFcfa = event.litresSold()
            .multiply(BigDecimal.valueOf(event.unitCostFcfa()))
            .setScale(0, RoundingMode.HALF_UP)
            .longValue();

        // Guard zero-litre / zero-activity shift closes cleanly instead of throwing an unbalanced journal error.
        if (event.expectedRevenueFcfa() == 0 && event.varianceFcfa() == 0 && cogsFcfa == 0) {
            return;
        }

        List<LineSpec> lines = new ArrayList<>();
        if (event.cashFcfa() > 0) lines.add(new LineSpec("1010", event.cashFcfa(), 0));
        if (event.mobileMoneyFcfa() > 0) lines.add(new LineSpec("1020", event.mobileMoneyFcfa(), 0));
        if (event.cardFcfa() > 0) lines.add(new LineSpec("1030", event.cardFcfa(), 0));
        if (event.fleetCreditFcfa() > 0) lines.add(new LineSpec("1100", event.fleetCreditFcfa(), 0));

        if (event.varianceFcfa() < 0) {
            lines.add(new LineSpec("6100", Math.abs(event.varianceFcfa()), 0));
        } else if (event.varianceFcfa() > 0) {
            lines.add(new LineSpec("6100", 0, event.varianceFcfa()));
        }

        if (event.expectedRevenueFcfa() > 0) {
            long vatFcfa = extractInclusiveVatFcfa(event.expectedRevenueFcfa());
            long netRevenueFcfa = event.expectedRevenueFcfa() - vatFcfa;
            if (netRevenueFcfa > 0) lines.add(new LineSpec("4010", 0, netRevenueFcfa));
            if (vatFcfa > 0) lines.add(new LineSpec("2200", 0, vatFcfa));
        }

        if (cogsFcfa > 0) {
            lines.add(new LineSpec("5010", cogsFcfa, 0));
            lines.add(new LineSpec("1200", 0, cogsFcfa));
        }

        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "SHIFT-" + event.aggregateId(),
            "ShiftClosedEvent",
            "Automated shift revenue, VAT & COGS posting (" + event.litresSold() + " L)",
            lines
        ));
    }

    @ApplicationModuleListener
    public void onShiftVoided(ShiftVoidedEvent event) {
        journalRepo.findFirstByStationIdAndReferenceOrderByPostedAtDesc(event.stationId(), "SHIFT-" + event.aggregateId())
            .ifPresent(original -> {
                List<LineSpec> reversalLines = original.getLines().stream()
                    .map(l -> new LineSpec(l.getAccountCode(), l.getCreditFcfa(), l.getDebitFcfa()))
                    .toList();
                journalRepo.save(JournalEntryEntity.createBalanced(
                    event.stationId(),
                    "REV-SHIFT-" + event.aggregateId(),
                    "ShiftVoidedEvent",
                    "Reversal of voided shift " + event.aggregateId(),
                    reversalLines,
                    original.getId()
                ));
            });
    }

    @ApplicationModuleListener
    public void onDeliveryRecorded(FuelDeliveryRecordedEvent event) {
        if (event.totalInvoiceFcfa() <= 0) return;
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "DEL-" + event.aggregateId(),
            "FuelDeliveryRecordedEvent",
            "Tanker receipt from " + event.supplierName() + " (" + event.actualReceivedLitres() + " L)",
            List.of(new LineSpec("1200", event.totalInvoiceFcfa(), 0), new LineSpec("2010", 0, event.totalInvoiceFcfa()))
        ));
    }

    @ApplicationModuleListener
    public void onDeliveryVoided(FuelDeliveryVoidedEvent event) {
        if (event.totalInvoiceFcfa() <= 0) return;
        String origId = journalRepo.findFirstByStationIdAndReferenceOrderByPostedAtDesc(event.stationId(), "DEL-" + event.aggregateId())
            .map(JournalEntryEntity::getId).orElse(null);
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "REV-DEL-" + event.aggregateId(),
            "FuelDeliveryVoidedEvent",
            "Reversal of voided fuel delivery " + event.aggregateId() + " (" + event.reversedLitres() + " L)",
            List.of(new LineSpec("2010", event.totalInvoiceFcfa(), 0), new LineSpec("1200", 0, event.totalInvoiceFcfa())),
            origId
        ));
    }

    @ApplicationModuleListener
    public void onTankShrinkageReconciled(TankShrinkageReconciledEvent event) {
        if (event.adjustmentValueFcfa() <= 0) return;
        List<LineSpec> lines = event.varianceLitres().compareTo(BigDecimal.ZERO) < 0
            ? List.of(new LineSpec("6010", event.adjustmentValueFcfa(), 0), new LineSpec("1200", 0, event.adjustmentValueFcfa()))
            : List.of(new LineSpec("1200", event.adjustmentValueFcfa(), 0), new LineSpec("6010", 0, event.adjustmentValueFcfa()));
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "SHRINK-" + event.tankId(),
            "TankShrinkageReconciledEvent",
            "Dipstick shrinkage reconciliation (" + event.varianceLitres() + " L): " + event.reason(),
            lines
        ));
    }

    @ApplicationModuleListener
    public void onExpenseRecorded(ExpenseRecordedEvent event) {
        String creditAccount = "BANK".equals(event.paymentSource()) ? "1030" : "1010";
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "EXP-" + event.aggregateId(),
            "ExpenseRecordedEvent",
            event.category() + ": " + event.description(),
            List.of(new LineSpec("6010", event.amountFcfa(), 0), new LineSpec(creditAccount, 0, event.amountFcfa()))
        ));
    }

    @ApplicationModuleListener
    public void onExpenseVoided(ExpenseVoidedEvent event) {
        String debitAccount = "BANK".equals(event.paymentSource()) ? "1030" : "1010";
        String origId = journalRepo.findFirstByStationIdAndReferenceOrderByPostedAtDesc(event.stationId(), "EXP-" + event.aggregateId())
            .map(JournalEntryEntity::getId).orElse(null);
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "REV-EXP-" + event.aggregateId(),
            "ExpenseVoidedEvent",
            "Reversal of voided expense " + event.aggregateId(),
            List.of(new LineSpec(debitAccount, event.amountFcfa(), 0), new LineSpec("6010", 0, event.amountFcfa())),
            origId
        ));
    }

    /**
     * Pump-dispensed fleet vouchers are reconciled through ShiftClosedEvent (fleetCreditFcfa),
     * preventing Revenue/VAT/AR double-counting. Only standalone off-pump bulk issues post directly here.
     */
    @ApplicationModuleListener
    public void onFleetVoucherRecorded(FleetVoucherRecordedEvent event) {
        if (!event.standaloneSale()) {
            return;
        }
        long vatFcfa = extractInclusiveVatFcfa(event.amountFcfa());
        List<LineSpec> lines = new ArrayList<>();
        lines.add(new LineSpec("1100", event.amountFcfa(), 0));
        lines.add(new LineSpec("4010", 0, event.amountFcfa() - vatFcfa));
        if (vatFcfa > 0) lines.add(new LineSpec("2200", 0, vatFcfa));
        if (event.cogsFcfa() > 0) {
            lines.add(new LineSpec("5010", event.cogsFcfa(), 0));
            lines.add(new LineSpec("1200", 0, event.cogsFcfa()));
        }
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "FLT-" + event.aggregateId(),
            "FleetVoucherRecordedEvent",
            "Standalone bulk fleet issue " + event.vehiclePlate() + " (" + event.companyName() + ")",
            lines
        ));
    }

    @ApplicationModuleListener
    public void onFleetSettled(FleetAccountSettledEvent event) {
        String debitCode = switch (event.method()) {
            case "BANK_TRANSFER" -> "1030";
            case "MOBILE_MONEY" -> "1020";
            case "CASH" -> "1010";
            default -> throw new IllegalArgumentException("Unsupported settlement method: " + event.method());
        };
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "FSET-" + event.aggregateId(),
            "FleetAccountSettledEvent",
            "Corporate settlement from " + event.companyName() + " via " + event.method(),
            List.of(new LineSpec(debitCode, event.amountFcfa(), 0), new LineSpec("1100", 0, event.amountFcfa()))
        ));
    }

    @ApplicationModuleListener
    public void onShopSaleRecorded(ShopSaleRecordedEvent event) {
        String debitCode = switch (event.paymentMethod()) {
            case "MOBILE_MONEY" -> "1020";
            case "CARD" -> "1030";
            case "CASH" -> "1010";
            default -> throw new IllegalArgumentException("Unsupported payment method: " + event.paymentMethod());
        };
        long vatFcfa = extractInclusiveVatFcfa(event.grossFcfa());
        List<LineSpec> lines = new ArrayList<>();
        lines.add(new LineSpec(debitCode, event.grossFcfa(), 0));
        lines.add(new LineSpec("4020", 0, event.grossFcfa() - vatFcfa));
        if (vatFcfa > 0) lines.add(new LineSpec("2200", 0, vatFcfa));
        if (event.cogsFcfa() > 0) {
            lines.add(new LineSpec("5010", event.cogsFcfa(), 0));
            lines.add(new LineSpec("1200", 0, event.cogsFcfa()));
        }
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "POS-" + event.aggregateId(),
            "ShopSaleRecordedEvent",
            "Shop counter sale: " + event.quantity() + "x " + event.itemName(),
            lines
        ));
    }

    @ApplicationModuleListener
    public void onShopItemRestocked(ShopItemRestockedEvent event) {
        if (event.totalCostFcfa() <= 0) return;
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "RSTK-" + event.sku(),
            "ShopItemRestockedEvent",
            "Shop restock: " + event.quantity() + "x " + event.itemName(),
            List.of(new LineSpec("1200", event.totalCostFcfa(), 0), new LineSpec("2010", 0, event.totalCostFcfa()))
        ));
    }

    @ApplicationModuleListener
    public void onTreasuryDeposited(TreasuryDepositedEvent event) {
        String creditCode = "MOBILE_MONEY_CLEARING".equals(event.sourceAccount()) ? "1020" : "1010";
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "DEP-" + event.aggregateId(),
            "TreasuryDepositedEvent",
            "Deposit from " + event.sourceAccount() + " to " + event.bankName(),
            List.of(new LineSpec("1030", event.amountFcfa(), 0), new LineSpec(creditCode, 0, event.amountFcfa()))
        ));
    }

    @ApplicationModuleListener
    public void onTreasuryDepositVoided(TreasuryDepositVoidedEvent event) {
        String debitCode = "MOBILE_MONEY_CLEARING".equals(event.sourceAccount()) ? "1020" : "1010";
        String origId = journalRepo.findFirstByStationIdAndReferenceOrderByPostedAtDesc(event.stationId(), "DEP-" + event.aggregateId())
            .map(JournalEntryEntity::getId).orElse(null);
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "REV-DEP-" + event.aggregateId(),
            "TreasuryDepositVoidedEvent",
            "Reversal of voided treasury deposit " + event.aggregateId(),
            List.of(new LineSpec(debitCode, event.amountFcfa(), 0), new LineSpec("1030", 0, event.amountFcfa())),
            origId
        ));
    }

    @ApplicationModuleListener
    public void onInstitutionalSetup(StationInstitutionalSetupEvent event) {
        if (event.openingInventoryAssetFcfa() > 0) {
            journalRepo.save(JournalEntryEntity.createBalanced(
                event.stationId(),
                "INIT-" + event.aggregateId(),
                "StationInstitutionalSetupEvent",
                event.summary(),
                List.of(
                    new LineSpec("1200", event.openingInventoryAssetFcfa(), 0),
                    new LineSpec("3010", 0, event.openingInventoryAssetFcfa())
                )
            ));
        }
    }

    @ApplicationModuleListener
    public void onSupplierApPaid(SupplierApPaidEvent event) {
        String creditCode = "BANK".equals(event.paymentSource()) ? "1030" : "1010";
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "AP-" + event.reference(),
            "SupplierApPaidEvent",
            "Supplier AP settlement to " + event.supplierName(),
            List.of(new LineSpec("2010", event.amountFcfa(), 0), new LineSpec(creditCode, 0, event.amountFcfa()))
        ));
    }

    @ApplicationModuleListener
    public void onVatRemitted(VatRemittedEvent event) {
        String creditCode = "BANK".equals(event.paymentSource()) ? "1030" : "1010";
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "VAT-" + event.reference(),
            "VatRemittedEvent",
            "Tax authority VAT remittance for " + event.periodLabel(),
            List.of(new LineSpec("2200", event.amountFcfa(), 0), new LineSpec(creditCode, 0, event.amountFcfa()))
        ));
    }

    @ApplicationModuleListener
    public void onPayrollDisbursed(PayrollDisbursedEvent event) {
        String creditCode = "BANK".equals(event.paymentSource()) ? "1030" : "1010";
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "PAY-" + event.aggregateId(),
            "PayrollDisbursedEvent",
            "Station payroll disbursement for " + event.periodLabel(),
            List.of(new LineSpec("6010", event.totalNetPaidFcfa(), 0), new LineSpec(creditCode, 0, event.totalNetPaidFcfa()))
        ));
    }

    @Transactional
    public ExpenseEntity recordExpense(RecordExpenseCommand cmd) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(cmd.stationId());
        ExpenseEntity saved = expenseRepo.save(ExpenseEntity.create(
            cmd.stationId(), cmd.category(), cmd.description(), cmd.amountFcfa(), cmd.paymentSource()
        ));
        eventPublisher.publishEvent(new ExpenseRecordedEvent(
            UUID.randomUUID().toString(), saved.getId(), station.tenantId(), saved.getStationId(),
            saved.getCategory(), saved.getDescription(), saved.getAmountFcfa(), saved.getPaymentSource(), saved.getCreatedAt()
        ));
        return saved;
    }

    @Transactional
    public void voidExpense(String expenseId) {
        ExpenseEntity expense = expenseRepo.findById(expenseId)
            .orElseThrow(() -> new IllegalArgumentException("Expense not found: " + expenseId));
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(expense.getStationId());
        expense.markVoided();
        expenseRepo.save(expense);
        eventPublisher.publishEvent(new ExpenseVoidedEvent(
            UUID.randomUUID().toString(), expense.getId(), station.tenantId(), expense.getStationId(),
            expense.getCategory(), expense.getAmountFcfa(), expense.getPaymentSource(), Instant.now()
        ));
    }

    @Transactional
    public TreasuryDepositEntity recordDeposit(RecordDepositCommand cmd) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(cmd.stationId());
        TreasuryDepositEntity saved = depositRepo.save(TreasuryDepositEntity.create(
            cmd.stationId(), cmd.sourceAccount(), cmd.bankName(), cmd.slipReference(), cmd.amountFcfa()
        ));
        eventPublisher.publishEvent(new TreasuryDepositedEvent(
            UUID.randomUUID().toString(), saved.getId(), station.tenantId(), saved.getStationId(),
            saved.getSourceAccount(), saved.getBankName(), saved.getAmountFcfa(), saved.getDepositedAt()
        ));
        return saved;
    }

    @Transactional
    public void voidDeposit(String depositId) {
        TreasuryDepositEntity dep = depositRepo.findById(depositId)
            .orElseThrow(() -> new IllegalArgumentException("Treasury deposit not found: " + depositId));
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(dep.getStationId());
        dep.markVoided();
        depositRepo.save(dep);
        eventPublisher.publishEvent(new TreasuryDepositVoidedEvent(
            UUID.randomUUID().toString(), dep.getId(), station.tenantId(), dep.getStationId(),
            dep.getSourceAccount(), dep.getAmountFcfa(), Instant.now()
        ));
    }

    @Transactional
    public Map<String, Object> recordSupplierApPayment(RecordApPaymentCommand cmd) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(cmd.stationId());
        ExpensePaymentSource source = DomainEnums.parse(ExpensePaymentSource.class, cmd.paymentSource(), "paymentSource");
        String paymentId = "appay_" + UUID.randomUUID();
        Instant now = Instant.now();
        eventPublisher.publishEvent(new SupplierApPaidEvent(
            UUID.randomUUID().toString(), paymentId, station.tenantId(), cmd.stationId(),
            cmd.supplierName().trim(), cmd.reference().trim(), cmd.amountFcfa(), source.name(), now
        ));
        return Map.of("id", paymentId, "stationId", cmd.stationId(), "supplierName", cmd.supplierName().trim(),
            "amountFcfa", cmd.amountFcfa(), "paymentSource", source.name(), "postedAt", now.toString());
    }

    @Transactional
    public Map<String, Object> recordVatRemittance(RecordVatRemittanceCommand cmd) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(cmd.stationId());
        ExpensePaymentSource source = DomainEnums.parse(ExpensePaymentSource.class, cmd.paymentSource(), "paymentSource");
        String remId = "vatrem_" + UUID.randomUUID();
        Instant now = Instant.now();
        eventPublisher.publishEvent(new VatRemittedEvent(
            UUID.randomUUID().toString(), remId, station.tenantId(), cmd.stationId(),
            cmd.periodLabel().trim(), cmd.reference().trim(), cmd.amountFcfa(), source.name(), now
        ));
        return Map.of("id", remId, "stationId", cmd.stationId(), "periodLabel", cmd.periodLabel().trim(),
            "amountFcfa", cmd.amountFcfa(), "paymentSource", source.name(), "postedAt", now.toString());
    }

    @Transactional
    public JournalEntryDto postManualJournal(ManualJournalCommand cmd) {
        stationCatalogApi.requireAccessibleStation(cmd.stationId());
        assertCurrentPeriodOpen(cmd.stationId());
        Map<String, String> accountNames = accountRepo.findAllByOrderByCodeAsc().stream()
            .collect(Collectors.toMap(AccountEntity::getCode, AccountEntity::getName));
        List<LineSpec> specs = new ArrayList<>();
        for (ManualJournalLineInput line : cmd.lines()) {
            if (!accountNames.containsKey(line.accountCode())) {
                throw new IllegalArgumentException("Unknown Chart of Accounts code: " + line.accountCode());
            }
            specs.add(new LineSpec(line.accountCode(), line.debitFcfa(), line.creditFcfa()));
        }
        JournalEntryEntity saved = journalRepo.save(JournalEntryEntity.createBalanced(
            cmd.stationId(), cmd.reference().trim(), "ManualJournalEntry", cmd.description().trim(), specs
        ));
        return toJournalDto(saved, accountNames);
    }

    @Transactional(readOnly = true)
    public List<JournalEntryDto> listJournals(String stationId, int limit) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        Map<String, String> accountNames = accountRepo.findAllByOrderByCodeAsc().stream()
            .collect(Collectors.toMap(AccountEntity::getCode, AccountEntity::getName));
        return journalRepo.findByStationIdInOrderByPostedAtDesc(stationIds, PageRequest.of(0, Math.max(1, Math.min(limit, 200))))
            .stream()
            .map(je -> toJournalDto(je, accountNames))
            .toList();
    }

    @Transactional(readOnly = true)
    public List<ExpenseEntity> listExpenses(String stationId, int limit) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return expenseRepo.findByStationIdInAndVoidedFalseOrderByCreatedAtDesc(stationIds, PageRequest.of(0, Math.max(1, Math.min(limit, 200))));
    }

    @Transactional(readOnly = true)
    public List<TreasuryDepositEntity> listDeposits(String stationId, int limit) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        if (stationIds.isEmpty()) return List.of();
        return depositRepo.findByStationIdInAndVoidedFalseOrderByDepositedAtDesc(stationIds, PageRequest.of(0, Math.max(1, Math.min(limit, 200))));
    }

    /**
     * SQL-aggregated Trial Balance, P&L & Balance Sheet projection.
     * Scales to millions of journal entries without hydrating entities into JVM memory.
     */
    @Transactional(readOnly = true)
    public FinancialReportBundleDto buildFinancialReport(String stationId, Instant from, Instant to) {
        List<String> stationIds = stationCatalogApi.resolveAuthorizedStationIds(stationId);
        List<AccountEntity> accounts = accountRepo.findAllByOrderByCodeAsc();

        Map<String, Long> debits = new HashMap<>();
        Map<String, Long> credits = new HashMap<>();

        if (!stationIds.isEmpty()) {
            String placeholders = String.join(",", Collections.nCopies(stationIds.size(), "?"));
            StringBuilder sql = new StringBuilder(
                "SELECT jl.account_code, COALESCE(SUM(jl.debit_fcfa), 0) AS total_debit, COALESCE(SUM(jl.credit_fcfa), 0) AS total_credit " +
                "FROM journal_lines jl INNER JOIN journal_entries je ON je.id = jl.journal_entry_id " +
                "WHERE je.station_id IN (" + placeholders + ")"
            );
            List<Object> params = new ArrayList<>(stationIds);
            if (from != null) {
                sql.append(" AND je.posted_at >= ?");
                params.add(Timestamp.from(from));
            }
            if (to != null) {
                sql.append(" AND je.posted_at <= ?");
                params.add(Timestamp.from(to));
            }
            sql.append(" GROUP BY jl.account_code");

            jdbcTemplate.query(sql.toString(), rs -> {
                String code = rs.getString("account_code");
                debits.put(code, rs.getLong("total_debit"));
                credits.put(code, rs.getLong("total_credit"));
            }, params.toArray());
        }

        List<TrialBalanceRowDto> rows = new ArrayList<>();
        long totalDebits = 0L, totalCredits = 0L;
        for (AccountEntity acc : accounts) {
            long d = debits.getOrDefault(acc.getCode(), 0L);
            long c = credits.getOrDefault(acc.getCode(), 0L);
            totalDebits += d;
            totalCredits += c;
            long net = ("ASSET".equals(acc.getAccountType()) || "EXPENSE".equals(acc.getAccountType())) ? (d - c) : (c - d);
            rows.add(new TrialBalanceRowDto(acc.getCode(), acc.getName(), acc.getAccountType(), d, c, net));
        }

        java.util.function.Function<String, Long> netOf = code ->
            rows.stream().filter(r -> r.accountCode().equals(code)).findFirst().map(TrialBalanceRowDto::netBalanceFcfa).orElse(0L);

        long fuelRev = netOf.apply("4010");
        long nonFuelRev = netOf.apply("4020");
        long totalRevenue = fuelRev + nonFuelRev;
        long cogs = netOf.apply("5010");
        long grossProfit = totalRevenue - cogs;
        long expenses = netOf.apply("6010");
        long variance = netOf.apply("6100");
        long netIncome = grossProfit - expenses - variance;

        return new FinancialReportBundleDto(
            "FCFA", totalRevenue, nonFuelRev, cogs, grossProfit, expenses, variance, netIncome,
            netOf.apply("2200"), netOf.apply("1010"), netOf.apply("1020"), netOf.apply("1030"),
            netOf.apply("1100"), netOf.apply("1200"), netOf.apply("2010"),
            totalDebits == totalCredits, rows
        );
    }

    private JournalEntryDto toJournalDto(JournalEntryEntity je, Map<String, String> accountNames) {
        List<JournalLineDto> lineDtos = je.getLines().stream()
            .map(l -> new JournalLineDto(
                l.getId(), l.getAccountCode(), accountNames.getOrDefault(l.getAccountCode(), l.getAccountCode()),
                l.getDebitFcfa(), l.getCreditFcfa()
            ))
            .toList();
        return new JournalEntryDto(
            je.getId(), je.getStationId(), je.getReference(), je.getSourceEvent(),
            je.getDescription(), je.getPostedAt(), je.getReversedEntryId(), lineDtos
        );
    }
}

record JournalLineDto(String id, String accountCode, String accountName, long debitFcfa, long creditFcfa) {}
record JournalEntryDto(
    String id, String stationId, String reference, String sourceEvent,
    String description, Instant postedAt, String reversedEntryId, List<JournalLineDto> lines
) {}

record RecordExpenseCommand(
    @NotBlank String stationId,
    @NotBlank String category,
    @NotBlank String description,
    @Positive long amountFcfa,
    @NotBlank String paymentSource
) {}

record RecordDepositCommand(
    @NotBlank String stationId,
    @NotBlank String sourceAccount,
    @NotBlank String bankName,
    @NotBlank String slipReference,
    @Positive long amountFcfa
) {}

record RecordApPaymentCommand(
    @NotBlank String stationId,
    @NotBlank String supplierName,
    @NotBlank String reference,
    @Positive long amountFcfa,
    @NotBlank String paymentSource
) {}

record RecordVatRemittanceCommand(
    @NotBlank String stationId,
    @NotBlank String periodLabel,
    @NotBlank String reference,
    @Positive long amountFcfa,
    @NotBlank String paymentSource
) {}

record ManualJournalLineInput(
    @NotBlank String accountCode,
    @PositiveOrZero long debitFcfa,
    @PositiveOrZero long creditFcfa
) {}

record ManualJournalCommand(
    @NotBlank String stationId,
    @NotBlank String reference,
    @NotBlank String description,
    @NotEmpty List<@Valid ManualJournalLineInput> lines
) {}

record TrialBalanceRowDto(
    String accountCode,
    String accountName,
    String accountType,
    long debitTotalFcfa,
    long creditTotalFcfa,
    long netBalanceFcfa
) {}

record FinancialReportBundleDto(
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
    List<TrialBalanceRowDto> trialBalance
) {}

@RestController
@RequestMapping("/api/v1/accounting")
public class AccountingController {
    private final AccountRepository accountRepo;
    private final AccountingAutomationService accountingService;

    public AccountingController(AccountRepository accountRepo, AccountingAutomationService accountingService) {
        this.accountRepo = accountRepo;
        this.accountingService = accountingService;
    }

    @GetMapping("/accounts")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:read')")
    public List<AccountEntity> listChartOfAccounts() {
        return accountRepo.findAllByOrderByCodeAsc();
    }

    @GetMapping("/journals")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:read')")
    public List<JournalEntryDto> listJournals(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return accountingService.listJournals(stationId, limit);
    }

    @PostMapping("/journals/manual")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:write')")
    public JournalEntryDto postManualJournal(@Valid @RequestBody ManualJournalCommand command) {
        return accountingService.postManualJournal(command);
    }

    @GetMapping("/reports")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:read')")
    public FinancialReportBundleDto getReports(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false) Instant from,
        @RequestParam(required = false) Instant to
    ) {
        return accountingService.buildFinancialReport(stationId, from, to);
    }

    @GetMapping("/expenses")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:read')")
    public List<ExpenseEntity> listExpenses(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return accountingService.listExpenses(stationId, limit);
    }

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:write')")
    public ExpenseEntity recordExpense(@Valid @RequestBody RecordExpenseCommand command) {
        return accountingService.recordExpense(command);
    }

    @DeleteMapping("/expenses/{expenseId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:write')")
    public void deleteExpense(@PathVariable String expenseId) {
        accountingService.voidExpense(expenseId);
    }

    @GetMapping("/deposits")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:read')")
    public List<TreasuryDepositEntity> listDeposits(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return accountingService.listDeposits(stationId, limit);
    }

    @PostMapping("/deposits")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:write')")
    public TreasuryDepositEntity recordDeposit(@Valid @RequestBody RecordDepositCommand command) {
        return accountingService.recordDeposit(command);
    }

    @DeleteMapping("/deposits/{depositId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:write')")
    public void deleteDeposit(@PathVariable String depositId) {
        accountingService.voidDeposit(depositId);
    }

    @PostMapping("/ap-payments")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:write')")
    public Map<String, Object> recordApPayment(@Valid @RequestBody RecordApPaymentCommand command) {
        return accountingService.recordSupplierApPayment(command);
    }

    @PostMapping("/vat-remittances")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:write')")
    public Map<String, Object> recordVatRemittance(@Valid @RequestBody RecordVatRemittanceCommand command) {
        return accountingService.recordVatRemittance(command);
    }

    @GetMapping("/periods")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:read')")
    public List<FiscalPeriodEntity> listFiscalPeriods(@RequestParam(required = false, defaultValue = "ALL") String stationId) {
        return accountingService.listFiscalPeriods(stationId);
    }

    @PostMapping("/periods/close")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:write')")
    public FiscalPeriodEntity closeFiscalPeriod(@Valid @RequestBody CloseFiscalPeriodCommand command) {
        return accountingService.closeFiscalPeriod(command);
    }
}

record CloseFiscalPeriodCommand(@NotBlank String stationId, @NotBlank String periodKey) {}
