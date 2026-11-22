package com.opesware.opesfuel.tenant;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

record UpsertCompanyBrandingCmd(
    @NotBlank String legalName,
    @NotBlank String tradingName,
    String tagline,
    String taxIdNiu,
    String rccmNumber,
    String cnpsEmployerId,
    String countryCode,
    String defaultCurrency,
    Double vatRatePct,
    String address,
    String city,
    String phone,
    String email,
    String website,
    String bankName,
    String bankAccountIban,
    String mobileMoneyMerchant,
    String primaryColorHex,
    String accentColorHex,
    String invoicePrefix,
    String poPrefix,
    String receiptPrefix,
    String paymentTerms,
    String letterheadFooter,
    String receiptHeaderNote,
    String receiptFooterNote,
    String signatoryName,
    String signatoryTitle,
    String logoDataUrl,
    String stampDataUrl
) {}

@RestController
@RequestMapping("/api/v1/tenants/current/branding")
public class CompanyBrandingController {
    private final JdbcTemplate jdbc;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder audit;

    public CompanyBrandingController(
        JdbcTemplate jdbc,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder audit
    ) {
        this.jdbc = jdbc;
        this.accessGuard = accessGuard;
        this.audit = audit;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT')")
    public Map<String, Object> getCurrentBranding() {
        String tenantId = accessGuard.currentTenantId();
        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT * FROM tenant_branding_profiles WHERE tenant_id = ?",
            tenantId
        );
        if (rows.isEmpty()) {
            Map<String, Object> defaults = new LinkedHashMap<>();
            defaults.put("tenantId", tenantId);
            defaults.put("configured", false);
            defaults.put("primaryColorHex", "#0F172A");
            defaults.put("accentColorHex", "#D97706");
            defaults.put("invoicePrefix", "INV-");
            defaults.put("poPrefix", "PO-");
            defaults.put("receiptPrefix", "RCP-");
            return defaults;
        }
        Map<String, Object> r = rows.get(0);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tenantId", tenantId);
        out.put("configured", true);
        out.put("legalName", r.get("legal_name"));
        out.put("tradingName", r.get("trading_name"));
        out.put("tagline", r.get("tagline"));
        out.put("taxIdNiu", r.get("tax_id_niu"));
        out.put("rccmNumber", r.get("rccm_number"));
        out.put("cnpsEmployerId", r.get("cnps_employer_id"));
        out.put("countryCode", r.get("country_code"));
        out.put("defaultCurrency", r.get("default_currency"));
        out.put("vatRatePct", r.get("vat_rate_pct"));
        out.put("address", r.get("address"));
        out.put("city", r.get("city"));
        out.put("phone", r.get("phone"));
        out.put("email", r.get("email"));
        out.put("website", r.get("website"));
        out.put("bankName", r.get("bank_name"));
        out.put("bankAccountIban", r.get("bank_account_iban"));
        out.put("mobileMoneyMerchant", r.get("mobile_money_merchant"));
        out.put("primaryColorHex", r.get("primary_color_hex"));
        out.put("accentColorHex", r.get("accent_color_hex"));
        out.put("invoicePrefix", r.get("invoice_prefix"));
        out.put("poPrefix", r.get("po_prefix"));
        out.put("receiptPrefix", r.get("receipt_prefix"));
        out.put("paymentTerms", r.get("payment_terms"));
        out.put("letterheadFooter", r.get("letterhead_footer"));
        out.put("receiptHeaderNote", r.get("receipt_header_note"));
        out.put("receiptFooterNote", r.get("receipt_footer_note"));
        out.put("signatoryName", r.get("signatory_name"));
        out.put("signatoryTitle", r.get("signatory_title"));
        out.put("logoDataUrl", r.get("logo_data_url"));
        out.put("stampDataUrl", r.get("stamp_data_url"));
        out.put("updatedBy", r.get("updated_by"));
        out.put("updatedAt", r.get("updated_at"));
        return out;
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER')")
    @Transactional
    public Map<String, Object> upsertCurrentBranding(@Valid @RequestBody UpsertCompanyBrandingCmd cmd) {
        String tenantId = accessGuard.currentTenantId();
        OpesFuelPrincipal actor = accessGuard.currentPrincipal();
        Timestamp now = Timestamp.from(Instant.now());

        String country = nonBlank(cmd.countryCode(), "CM").toUpperCase();
        String currency = nonBlank(cmd.defaultCurrency(), "FCFA").toUpperCase();
        double vat = cmd.vatRatePct() != null ? cmd.vatRatePct() : 19.25;
        String primary = nonBlank(cmd.primaryColorHex(), "#0F172A");
        String accent = nonBlank(cmd.accentColorHex(), "#D97706");
        String invPrefix = nonBlank(cmd.invoicePrefix(), "INV-");
        String poPrefix = nonBlank(cmd.poPrefix(), "PO-");
        String rcpPrefix = nonBlank(cmd.receiptPrefix(), "RCP-");

        Integer exists = jdbc.queryForObject(
            "SELECT COUNT(*) FROM tenant_branding_profiles WHERE tenant_id = ?",
            Integer.class, tenantId
        );

        if (exists != null && exists > 0) {
            jdbc.update("""
                UPDATE tenant_branding_profiles SET
                    legal_name = ?, trading_name = ?, tagline = ?, tax_id_niu = ?, rccm_number = ?,
                    cnps_employer_id = ?, country_code = ?, default_currency = ?, vat_rate_pct = ?,
                    address = ?, city = ?, phone = ?, email = ?, website = ?,
                    bank_name = ?, bank_account_iban = ?, mobile_money_merchant = ?,
                    primary_color_hex = ?, accent_color_hex = ?, invoice_prefix = ?, po_prefix = ?, receipt_prefix = ?,
                    payment_terms = ?, letterhead_footer = ?, receipt_header_note = ?, receipt_footer_note = ?,
                    signatory_name = ?, signatory_title = ?, logo_data_url = ?, stamp_data_url = ?,
                    updated_by = ?, updated_at = ?
                WHERE tenant_id = ?
                """,
                cmd.legalName().trim(), cmd.tradingName().trim(), cmd.tagline(), cmd.taxIdNiu(), cmd.rccmNumber(),
                cmd.cnpsEmployerId(), country, currency, vat,
                cmd.address(), cmd.city(), cmd.phone(), cmd.email(), cmd.website(),
                cmd.bankName(), cmd.bankAccountIban(), cmd.mobileMoneyMerchant(),
                primary, accent, invPrefix, poPrefix, rcpPrefix,
                cmd.paymentTerms(), cmd.letterheadFooter(), cmd.receiptHeaderNote(), cmd.receiptFooterNote(),
                cmd.signatoryName(), cmd.signatoryTitle(), cmd.logoDataUrl(), cmd.stampDataUrl(),
                actor.subject(), now, tenantId
            );
        } else {
            jdbc.update("""
                INSERT INTO tenant_branding_profiles (
                    tenant_id, legal_name, trading_name, tagline, tax_id_niu, rccm_number,
                    cnps_employer_id, country_code, default_currency, vat_rate_pct,
                    address, city, phone, email, website,
                    bank_name, bank_account_iban, mobile_money_merchant,
                    primary_color_hex, accent_color_hex, invoice_prefix, po_prefix, receipt_prefix,
                    payment_terms, letterhead_footer, receipt_header_note, receipt_footer_note,
                    signatory_name, signatory_title, logo_data_url, stamp_data_url,
                    updated_by, updated_at
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                """,
                tenantId, cmd.legalName().trim(), cmd.tradingName().trim(), cmd.tagline(), cmd.taxIdNiu(), cmd.rccmNumber(),
                cmd.cnpsEmployerId(), country, currency, vat,
                cmd.address(), cmd.city(), cmd.phone(), cmd.email(), cmd.website(),
                cmd.bankName(), cmd.bankAccountIban(), cmd.mobileMoneyMerchant(),
                primary, accent, invPrefix, poPrefix, rcpPrefix,
                cmd.paymentTerms(), cmd.letterheadFooter(), cmd.receiptHeaderNote(), cmd.receiptFooterNote(),
                cmd.signatoryName(), cmd.signatoryTitle(), cmd.logoDataUrl(), cmd.stampDataUrl(),
                actor.subject(), now
            );
        }

        audit.record(
            tenantId, null, actor.subject(), actor.roles().toString(),
            "COMPANY_BRANDING_UPDATED", "TENANT_BRANDING", tenantId,
            "Updated letterhead & logo profile for " + cmd.legalName().trim() + " (NIU: " + nonBlank(cmd.taxIdNiu(), "N/A") + ")"
        );
        return getCurrentBranding();
    }

    private static String nonBlank(String val, String fallback) {
        return (val != null && !val.isBlank()) ? val.trim() : fallback;
    }
}
