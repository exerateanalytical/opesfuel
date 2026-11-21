package com.opesware.opesfuel.billing;

import com.opesware.opesfuel.forecourt.ForecourtQueryApi;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import com.opesware.opesfuel.station.StationCatalogApi;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "billing_invoices")
class BillingInvoiceEntity {
    @Id
    private String id;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;
    @Column(name = "invoice_number", nullable = false, unique = true)
    private String invoiceNumber;
    @Column(name = "period_label", nullable = false)
    private String periodLabel;
    @Column(name = "station_count", nullable = false)
    private int stationCount;
    @Column(name = "subtotal_fcfa", nullable = false)
    private long subtotalFcfa;
    @Column(name = "ai_addon_fcfa", nullable = false)
    private long aiAddonFcfa;
    @Column(name = "total_fcfa", nullable = false)
    private long totalFcfa;
    @Column(nullable = false)
    private String currency = "FCFA";
    @Column(nullable = false)
    private String status = "ISSUED";
    @Column(name = "due_date", nullable = false)
    private Instant dueDate;
    @Column(name = "paid_at")
    private Instant paidAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static BillingInvoiceEntity issue(String tenantId, String periodLabel, int stationCount, long subtotalFcfa, long aiAddonFcfa) {
        BillingInvoiceEntity inv = new BillingInvoiceEntity();
        inv.id = "binv_" + UUID.randomUUID();
        inv.tenantId = tenantId;
        inv.invoiceNumber = "OPF-INV-" + periodLabel.replaceAll("[^0-9A-Za-z]", "") + "-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        inv.periodLabel = periodLabel;
        inv.stationCount = stationCount;
        inv.subtotalFcfa = subtotalFcfa;
        inv.aiAddonFcfa = aiAddonFcfa;
        inv.totalFcfa = Math.addExact(subtotalFcfa, aiAddonFcfa);
        inv.currency = "FCFA";
        inv.status = "ISSUED";
        inv.createdAt = Instant.now();
        inv.dueDate = inv.createdAt.plus(14, ChronoUnit.DAYS);
        return inv;
    }

    public void markPaid() {
        if ("PAID".equals(this.status)) {
            throw new IllegalStateException("Invoice " + this.invoiceNumber + " is already PAID.");
        }
        this.status = "PAID";
        this.paidAt = Instant.now();
    }

    public String getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getInvoiceNumber() { return invoiceNumber; }
    public String getPeriodLabel() { return periodLabel; }
    public int getStationCount() { return stationCount; }
    public long getSubtotalFcfa() { return subtotalFcfa; }
    public long getAiAddonFcfa() { return aiAddonFcfa; }
    public long getTotalFcfa() { return totalFcfa; }
    public String getCurrency() { return currency; }
    public String getStatus() { return status; }
    public Instant getDueDate() { return dueDate; }
    public Instant getPaidAt() { return paidAt; }
    public Instant getCreatedAt() { return createdAt; }
}

@Entity
@Table(name = "billing_payments")
class BillingPaymentEntity {
    @Id
    private String id;
    @Column(name = "invoice_id", nullable = false)
    private String invoiceId;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;
    @Column(name = "amount_fcfa", nullable = false)
    private long amountFcfa;
    @Column(name = "payment_channel", nullable = false)
    private String paymentChannel;
    @Column(name = "provider_reference", nullable = false)
    private String providerReference;
    @Column(name = "paid_at", nullable = false)
    private Instant paidAt;

    public static BillingPaymentEntity create(String invoiceId, String tenantId, long amountFcfa, String channel, String providerReference) {
        BillingPaymentEntity p = new BillingPaymentEntity();
        p.id = "bpay_" + UUID.randomUUID();
        p.invoiceId = invoiceId;
        p.tenantId = tenantId;
        p.amountFcfa = amountFcfa;
        p.paymentChannel = channel;
        p.providerReference = providerReference.trim();
        p.paidAt = Instant.now();
        return p;
    }

    public String getId() { return id; }
    public String getInvoiceId() { return invoiceId; }
    public long getAmountFcfa() { return amountFcfa; }
    public String getPaymentChannel() { return paymentChannel; }
    public String getProviderReference() { return providerReference; }
    public Instant getPaidAt() { return paidAt; }
}

interface BillingInvoiceRepository extends JpaRepository<BillingInvoiceEntity, String> {
    List<BillingInvoiceEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId);
}

interface BillingPaymentRepository extends JpaRepository<BillingPaymentEntity, String> {
    List<BillingPaymentEntity> findByInvoiceIdOrderByPaidAtDesc(String invoiceId);
}

@Service
class BillingService {
    private static final Set<String> VALID_CHANNELS = Set.of("ORANGE_MONEY", "MTN_MOMO", "BANK_TRANSFER", "CARD");

    private final BillingInvoiceRepository invoiceRepo;
    private final BillingPaymentRepository paymentRepo;
    private final StationCatalogApi stationCatalogApi;
    private final ForecourtQueryApi forecourtQueryApi;
    private final TenantAccessGuard accessGuard;
    private final JdbcTemplate jdbcTemplate;

    BillingService(
        BillingInvoiceRepository invoiceRepo,
        BillingPaymentRepository paymentRepo,
        StationCatalogApi stationCatalogApi,
        ForecourtQueryApi forecourtQueryApi,
        TenantAccessGuard accessGuard,
        JdbcTemplate jdbcTemplate
    ) {
        this.invoiceRepo = invoiceRepo;
        this.paymentRepo = paymentRepo;
        this.stationCatalogApi = stationCatalogApi;
        this.forecourtQueryApi = forecourtQueryApi;
        this.accessGuard = accessGuard;
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<SubscriptionPlanDto> listPlans() {
        return List.of(
            new SubscriptionPlanDto("starter", "Starter Station", "For independent single-site stations", 25_000L, "Up to 6 pumps · 3 tanks", "50,000 API calls / month",
                List.of("Pump & shift meter reconciliation", "Underground tank dipstick tracking", "Automated daily P&L in FCFA", "Mobile app for Android & iPhone (3 seats)")),
            new SubscriptionPlanDto("pro", "Multi-Pump Pro", "For high-volume urban forecourts", 55_000L, "Up to 18 pumps · 8 tanks", "250,000 API calls / month",
                List.of("Everything in Starter Station", "Corporate fleet credit & invoicing", "Lubricants, LPG & shop POS ledger", "Full Trial Balance, Balance Sheet & VAT export")),
            new SubscriptionPlanDto("enterprise", "Network Enterprise", "For regional station networks & ERPs", 120_000L, "Unlimited stations & pumps", "Unlimited API + HMAC Webhooks",
                List.of("Multi-station consolidated reporting", "Dedicated Auth0 tenant & custom roles", "Signed domain event webhooks", "Included AI Copilot + Priority SLA"))
        );
    }

    public List<EnterpriseLicenseDto> listEnterpriseLicenses() {
        return List.of(
            new EnterpriseLicenseDto(
                "perpetual_managed",
                "Perpetual Self-Hosted Deployment License",
                "PERPETUAL_ANNUAL_MANAGED",
                5_000_000L,
                "5 000 000 FCFA / year",
                List.of("Web", "Mobile (Android & iPhone)", "Java 25 Spring Boot + PostgreSQL"),
                false,
                List.of(
                    "Dedicated private server or cloud deployment",
                    "Infrastructure management & PostgreSQL backups",
                    "Security patching & CVE remediation",
                    "Preventive maintenance & regulatory upgrades"
                )
            ),
            new EnterpriseLicenseDto(
                "custom_ip_buyout",
                "Custom-Developed Platform & Full Source Code IP License",
                "NEGOTIATED_IP_ACQUISITION",
                null,
                "Negotiated Price",
                List.of("Web", "Mobile (iOS/Android)", "Desktop (Windows/macOS/Linux)", "Java 25 Backend"),
                true,
                List.of(
                    "100% source code delivery across Web, Mobile & Desktop",
                    "Full Intellectual Property (IP) ownership assignment",
                    "White-label branding & custom hardware integrations"
                )
            )
        );
    }

    @Transactional(readOnly = true)
    public BillingSummaryDto getTenantBillingSummary() {
        String tenantId = accessGuard.currentTenantId();
        List<StationCatalogApi.StationSnapshot> stations = stationCatalogApi.listAccessibleStationSnapshots();
        List<String> stationIds = stations.stream().map(StationCatalogApi.StationSnapshot::id).toList();
        long stationsSubtotal = stations.stream().mapToLong(StationCatalogApi.StationSnapshot::monthlyFeeFcfa).sum();
        long aiAddonFcfa = computeActiveAiAddonFcfa(tenantId);
        long pumpCount = forecourtQueryApi.countPumpsForStations(stationIds);
        int pumpQuota = stations.stream().mapToInt(s -> {
            if (s.monthlyFeeFcfa() >= 120_000L) return 999;
            if (s.monthlyFeeFcfa() >= 55_000L) return 18;
            return 6;
        }).sum();
        List<BillingInvoiceEntity> invoices = invoiceRepo.findByTenantIdOrderByCreatedAtDesc(tenantId);
        long unpaidFcfa = invoices.stream().filter(i -> "ISSUED".equals(i.getStatus())).mapToLong(BillingInvoiceEntity::getTotalFcfa).sum();

        return new BillingSummaryDto(
            tenantId, "FCFA", stations.size(), pumpCount, pumpQuota,
            stationsSubtotal, aiAddonFcfa, stationsSubtotal + aiAddonFcfa, unpaidFcfa, invoices.size()
        );
    }

    @Transactional(readOnly = true)
    public List<BillingInvoiceEntity> listInvoices() {
        return invoiceRepo.findByTenantIdOrderByCreatedAtDesc(accessGuard.currentTenantId());
    }

    @Transactional
    public BillingInvoiceEntity generateInvoice(GenerateInvoiceCommand cmd) {
        String tenantId = accessGuard.currentTenantId();
        List<StationCatalogApi.StationSnapshot> stations = stationCatalogApi.listAccessibleStationSnapshots();
        if (stations.isEmpty()) {
            throw new IllegalStateException("No stations exist to bill for tenant " + tenantId);
        }
        String period = (cmd != null && cmd.periodLabel() != null && !cmd.periodLabel().isBlank())
            ? cmd.periodLabel().trim()
            : YearMonth.now(ZoneOffset.UTC).toString();
        long subtotal = stations.stream().mapToLong(StationCatalogApi.StationSnapshot::monthlyFeeFcfa).sum();
        long aiAddon = computeActiveAiAddonFcfa(tenantId);
        return invoiceRepo.save(BillingInvoiceEntity.issue(tenantId, period, stations.size(), subtotal, aiAddon));
    }

    @Transactional
    public BillingPaymentEntity payInvoice(String invoiceId, PayInvoiceCommand cmd) {
        String channel = cmd.paymentChannel().trim().toUpperCase();
        if (!VALID_CHANNELS.contains(channel)) {
            throw new IllegalArgumentException("Invalid paymentChannel '" + cmd.paymentChannel() + "'. Allowed: " + VALID_CHANNELS);
        }
        BillingInvoiceEntity invoice = invoiceRepo.findById(invoiceId)
            .orElseThrow(() -> new IllegalArgumentException("Billing invoice not found: " + invoiceId));
        accessGuard.assertTenantMatch(invoice.getTenantId());
        if (cmd.amountFcfa() < invoice.getTotalFcfa()) {
            throw new IllegalArgumentException("Payment amount (" + cmd.amountFcfa() + " FCFA) is less than invoice total (" + invoice.getTotalFcfa() + " FCFA).");
        }
        invoice.markPaid();
        invoiceRepo.save(invoice);
        return paymentRepo.save(BillingPaymentEntity.create(
            invoice.getId(), invoice.getTenantId(), cmd.amountFcfa(), channel, cmd.providerReference()
        ));
    }

    private long computeActiveAiAddonFcfa(String tenantId) {
        Long fee = jdbcTemplate.queryForObject(
            "SELECT COALESCE(SUM(a.monthly_fee_fcfa), 0) FROM ai_subscriptions a INNER JOIN stations s ON s.id = a.station_id WHERE s.tenant_id = ? AND a.active = TRUE",
            Long.class,
            tenantId
        );
        return fee != null ? fee : 0L;
    }
}

record SubscriptionPlanDto(
    String id,
    String name,
    String audience,
    long monthlyPriceFcfa,
    String pumpLimit,
    String apiQuotaPerMonth,
    List<String> features
) {}

record EnterpriseLicenseDto(
    String id,
    String title,
    String billingModel,
    Long annualFeeFcfa,
    String pricingDisplay,
    List<String> platformsIncluded,
    boolean fullIntellectualPropertyTransfer,
    List<String> includedServices
) {}

record BillingSummaryDto(
    String tenantId,
    String currency,
    int stationCount,
    long activePumpCount,
    int pumpQuotaLimit,
    long stationsMonthlyFcfa,
    long aiCopilotMonthlyFcfa,
    long totalMonthlyFcfa,
    long unpaidInvoicesFcfa,
    int invoiceCount
) {}

record GenerateInvoiceCommand(String periodLabel) {}
record PayInvoiceCommand(@Positive long amountFcfa, @NotBlank String paymentChannel, @NotBlank String providerReference) {}

@RestController
@RequestMapping("/api/v1/billing")
public class BillingController {
    private final BillingService service;

    public BillingController(BillingService service) {
        this.service = service;
    }

    @GetMapping("/plans")
    public List<SubscriptionPlanDto> listPlans() {
        return service.listPlans();
    }

    @GetMapping("/enterprise-licenses")
    public List<EnterpriseLicenseDto> listEnterpriseLicenses() {
        return service.listEnterpriseLicenses();
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_billing:read')")
    public BillingSummaryDto getBillingSummary() {
        return service.getTenantBillingSummary();
    }

    @GetMapping("/invoices")
    @PreAuthorize("hasAnyRole('OWNER','ACCOUNTANT') or hasAuthority('SCOPE_billing:read')")
    public List<BillingInvoiceEntity> listInvoices() {
        return service.listInvoices();
    }

    @PostMapping("/invoices/generate")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_billing:write')")
    public BillingInvoiceEntity generateInvoice(@RequestBody(required = false) GenerateInvoiceCommand cmd) {
        return service.generateInvoice(cmd);
    }

    @PostMapping("/invoices/{invoiceId}/pay")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasRole('OWNER') or hasAuthority('SCOPE_billing:write')")
    public BillingPaymentEntity payInvoice(@PathVariable String invoiceId, @Valid @RequestBody PayInvoiceCommand cmd) {
        return service.payInvoice(invoiceId, cmd);
    }
}
