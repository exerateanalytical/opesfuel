package com.opesware.opesfuel.accounting;

import com.opesware.opesfuel.shared.events.DomainEvent.*;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

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
    @Column(nullable = false)
    private String description;
    @Column(name = "posted_at", nullable = false)
    private Instant postedAt;

    @OneToMany(mappedBy = "journalEntry", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<JournalLineEntity> lines = new ArrayList<>();

    public static JournalEntryEntity createBalanced(String stationId, String reference, String sourceEvent, String description, List<LineSpec> specs) {
        long totalDebit = specs.stream().mapToLong(LineSpec::debitFcfa).sum();
        long totalCredit = specs.stream().mapToLong(LineSpec::creditFcfa).sum();
        if (totalDebit != totalCredit || totalDebit <= 0) {
            throw new IllegalStateException("Unbalanced double-entry journal rejected: debit=" + totalDebit + ", credit=" + totalCredit);
        }
        JournalEntryEntity entry = new JournalEntryEntity();
        entry.id = "je_" + UUID.randomUUID().toString().substring(0, 8);
        entry.stationId = stationId;
        entry.reference = reference;
        entry.sourceEvent = sourceEvent;
        entry.description = description;
        entry.postedAt = Instant.now();

        for (LineSpec spec : specs) {
            if (spec.debitFcfa() == 0 && spec.creditFcfa() == 0) continue;
            JournalLineEntity line = new JournalLineEntity();
            line.setId("jl_" + UUID.randomUUID().toString().substring(0, 8));
            line.setJournalEntry(entry);
            line.setAccountCode(spec.accountCode());
            line.setDebitFcfa(spec.debitFcfa());
            line.setCreditFcfa(spec.creditFcfa());
            entry.lines.add(line);
        }
        return entry;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getReference() { return reference; }
    public String getSourceEvent() { return sourceEvent; }
    public String getDescription() { return description; }
    public Instant getPostedAt() { return postedAt; }
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
    @Column(nullable = false)
    private String description;
    @Column(name = "amount_fcfa", nullable = false)
    private long amountFcfa;
    @Column(name = "payment_source", nullable = false)
    private String paymentSource;
    @Column(nullable = false)
    private String status = "POSTED";
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static ExpenseEntity create(String stationId, String category, String description, long amountFcfa, String paymentSource) {
        ExpenseEntity e = new ExpenseEntity();
        e.id = "exp_" + UUID.randomUUID().toString().substring(0, 8);
        e.stationId = stationId;
        e.category = category;
        e.description = description;
        e.amountFcfa = amountFcfa;
        e.paymentSource = paymentSource;
        e.status = "POSTED";
        e.createdAt = Instant.now();
        return e;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getCategory() { return category; }
    public String getDescription() { return description; }
    public long getAmountFcfa() { return amountFcfa; }
    public String getPaymentSource() { return paymentSource; }
    public String getStatus() { return status; }
    public Instant getCreatedAt() { return createdAt; }
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

    public static TreasuryDepositEntity create(String stationId, String sourceAccount, String bankName, String slipReference, long amountFcfa) {
        TreasuryDepositEntity dep = new TreasuryDepositEntity();
        dep.id = "dep_" + UUID.randomUUID().toString().substring(0, 8);
        dep.stationId = stationId;
        dep.sourceAccount = sourceAccount;
        dep.bankName = bankName;
        dep.slipReference = slipReference;
        dep.amountFcfa = amountFcfa;
        dep.depositedAt = Instant.now();
        return dep;
    }

    public String getId() { return id; }
    public String getStationId() { return stationId; }
    public String getSourceAccount() { return sourceAccount; }
    public String getBankName() { return bankName; }
    public String getSlipReference() { return slipReference; }
    public long getAmountFcfa() { return amountFcfa; }
    public Instant getDepositedAt() { return depositedAt; }
}

record LineSpec(String accountCode, long debitFcfa, long creditFcfa) {}

interface AccountRepository extends JpaRepository<AccountEntity, String> {
    List<AccountEntity> findAllByOrderByCodeAsc();
}

interface JournalEntryRepository extends JpaRepository<JournalEntryEntity, String> {
    List<JournalEntryEntity> findByStationIdOrderByPostedAtDesc(String stationId);
    List<JournalEntryEntity> findAllByOrderByPostedAtDesc();
}

interface ExpenseRepository extends JpaRepository<ExpenseEntity, String> {
    List<ExpenseEntity> findByStationIdOrderByCreatedAtDesc(String stationId);
}

interface TreasuryDepositRepository extends JpaRepository<TreasuryDepositEntity, String> {
    List<TreasuryDepositEntity> findByStationIdOrderByDepositedAtDesc(String stationId);
}

@Service
class AccountingAutomationService {
    private final AccountRepository accountRepo;
    private final JournalEntryRepository journalRepo;
    private final ExpenseRepository expenseRepo;
    private final TreasuryDepositRepository depositRepo;
    private final ApplicationEventPublisher eventPublisher;

    AccountingAutomationService(AccountRepository accountRepo, JournalEntryRepository journalRepo,
                                ExpenseRepository expenseRepo, TreasuryDepositRepository depositRepo,
                                ApplicationEventPublisher eventPublisher) {
        this.accountRepo = accountRepo;
        this.journalRepo = journalRepo;
        this.expenseRepo = expenseRepo;
        this.depositRepo = depositRepo;
        this.eventPublisher = eventPublisher;
    }

    @ApplicationModuleListener
    public void onShiftClosed(ShiftClosedEvent event) {
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

        long vatFcfa = Math.round(event.expectedRevenueFcfa() * 0.1925 / 1.1925);
        long netRevenueFcfa = event.expectedRevenueFcfa() - vatFcfa;
        lines.add(new LineSpec("4010", 0, netRevenueFcfa));
        lines.add(new LineSpec("2200", 0, vatFcfa));

        long cogsFcfa = event.litresSold().multiply(BigDecimal.valueOf(event.unitCostFcfa())).longValue();
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
    public void onDeliveryRecorded(FuelDeliveryRecordedEvent event) {
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "DEL-" + event.aggregateId(),
            "FuelDeliveryRecordedEvent",
            "Tanker receipt from " + event.supplierName() + " (" + event.actualReceivedLitres() + " L)",
            List.of(new LineSpec("1200", event.totalInvoiceFcfa(), 0), new LineSpec("2010", 0, event.totalInvoiceFcfa()))
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
    public void onFleetVoucherRecorded(FleetVoucherRecordedEvent event) {
        long vatFcfa = Math.round(event.amountFcfa() * 0.1925 / 1.1925);
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "FLT-" + event.aggregateId(),
            "FleetVoucherRecordedEvent",
            "Fleet credit voucher " + event.vehiclePlate() + " (" + event.companyName() + ")",
            List.of(
                new LineSpec("1100", event.amountFcfa(), 0),
                new LineSpec("4010", 0, event.amountFcfa() - vatFcfa),
                new LineSpec("2200", 0, vatFcfa)
            )
        ));
    }

    @ApplicationModuleListener
    public void onFleetSettled(FleetAccountSettledEvent event) {
        String debitCode = switch (event.method()) {
            case "BANK_TRANSFER" -> "1030";
            case "MOBILE_MONEY" -> "1020";
            default -> "1010";
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
            default -> "1010";
        };
        long vatFcfa = Math.round(event.grossFcfa() * 0.1925 / 1.1925);
        journalRepo.save(JournalEntryEntity.createBalanced(
            event.stationId(),
            "POS-" + event.aggregateId(),
            "ShopSaleRecordedEvent",
            "Shop counter sale: " + event.quantity() + "x " + event.itemName(),
            List.of(
                new LineSpec(debitCode, event.grossFcfa(), 0),
                new LineSpec("4020", 0, event.grossFcfa() - vatFcfa),
                new LineSpec("2200", 0, vatFcfa),
                new LineSpec("5010", event.cogsFcfa(), 0),
                new LineSpec("1200", 0, event.cogsFcfa())
            )
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

    @Transactional
    public ExpenseEntity recordExpense(RecordExpenseCommand cmd) {
        ExpenseEntity saved = expenseRepo.save(ExpenseEntity.create(
            cmd.stationId(), cmd.category(), cmd.description(), cmd.amountFcfa(), cmd.paymentSource()
        ));
        eventPublisher.publishEvent(new ExpenseRecordedEvent(
            UUID.randomUUID().toString(), saved.getId(), saved.getStationId(),
            saved.getCategory(), saved.getDescription(), saved.getAmountFcfa(), saved.getPaymentSource(), saved.getCreatedAt()
        ));
        return saved;
    }

    @Transactional
    public TreasuryDepositEntity recordDeposit(RecordDepositCommand cmd) {
        TreasuryDepositEntity saved = depositRepo.save(TreasuryDepositEntity.create(
            cmd.stationId(), cmd.sourceAccount(), cmd.bankName(), cmd.slipReference(), cmd.amountFcfa()
        ));
        eventPublisher.publishEvent(new TreasuryDepositedEvent(
            UUID.randomUUID().toString(), saved.getId(), saved.getStationId(),
            saved.getSourceAccount(), saved.getBankName(), saved.getAmountFcfa(), saved.getDepositedAt()
        ));
        return saved;
    }

    public FinancialReportBundleDto buildFinancialReport(String stationId) {
        List<AccountEntity> accounts = accountRepo.findAllByOrderByCodeAsc();
        List<JournalEntryEntity> entries = "ALL".equalsIgnoreCase(stationId)
            ? journalRepo.findAllByOrderByPostedAtDesc()
            : journalRepo.findByStationIdOrderByPostedAtDesc(stationId);

        Map<String, Long> debits = new HashMap<>();
        Map<String, Long> credits = new HashMap<>();
        for (JournalEntryEntity entry : entries) {
            for (JournalLineEntity line : entry.getLines()) {
                debits.merge(line.getAccountCode(), line.getDebitFcfa(), Long::sum);
                credits.merge(line.getAccountCode(), line.getCreditFcfa(), Long::sum);
            }
        }

        List<TrialBalanceRowDto> rows = new ArrayList<>();
        long totalDebits = 0, totalCredits = 0;
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
}

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
    private final JournalEntryRepository journalRepo;
    private final ExpenseRepository expenseRepo;
    private final TreasuryDepositRepository depositRepo;
    private final AccountingAutomationService accountingService;

    public AccountingController(AccountRepository accountRepo, JournalEntryRepository journalRepo,
                                ExpenseRepository expenseRepo, TreasuryDepositRepository depositRepo,
                                AccountingAutomationService accountingService) {
        this.accountRepo = accountRepo;
        this.journalRepo = journalRepo;
        this.expenseRepo = expenseRepo;
        this.depositRepo = depositRepo;
        this.accountingService = accountingService;
    }

    @GetMapping("/accounts")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public List<AccountEntity> listChartOfAccounts() {
        return accountRepo.findAllByOrderByCodeAsc();
    }

    @GetMapping("/journals")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public List<JournalEntryEntity> listJournals(@RequestParam String stationId) {
        return "ALL".equalsIgnoreCase(stationId) ? journalRepo.findAllByOrderByPostedAtDesc() : journalRepo.findByStationIdOrderByPostedAtDesc(stationId);
    }

    @GetMapping("/reports")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public FinancialReportBundleDto getReports(@RequestParam String stationId) {
        return accountingService.buildFinancialReport(stationId);
    }

    @GetMapping("/expenses")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public List<ExpenseEntity> listExpenses(@RequestParam String stationId) {
        return "ALL".equalsIgnoreCase(stationId) ? expenseRepo.findAll() : expenseRepo.findByStationIdOrderByCreatedAtDesc(stationId);
    }

    @PostMapping("/expenses")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public ExpenseEntity recordExpense(@Valid @RequestBody RecordExpenseCommand command) {
        return accountingService.recordExpense(command);
    }

    @DeleteMapping("/expenses/{expenseId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT')")
    public void deleteExpense(@PathVariable String expenseId) {
        expenseRepo.deleteById(expenseId);
    }

    @GetMapping("/deposits")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public List<TreasuryDepositEntity> listDeposits(@RequestParam String stationId) {
        return "ALL".equalsIgnoreCase(stationId) ? depositRepo.findAll() : depositRepo.findByStationIdOrderByDepositedAtDesc(stationId);
    }

    @PostMapping("/deposits")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT')")
    public TreasuryDepositEntity recordDeposit(@Valid @RequestBody RecordDepositCommand command) {
        return accountingService.recordDeposit(command);
    }

    @DeleteMapping("/deposits/{depositId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT')")
    public void deleteDeposit(@PathVariable String depositId) {
        depositRepo.deleteById(depositId);
    }
}
