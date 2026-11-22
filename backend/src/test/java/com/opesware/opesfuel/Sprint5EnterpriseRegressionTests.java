package com.opesware.opesfuel;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class Sprint5EnterpriseRegressionTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void setupSchemas() throws Exception {
        for (String mig : new String[]{
            "db/migration/V7__prelaunch_modules_hr_audit_safe_calibration.sql",
            "db/migration/V8__enterprise_modules_schema.sql",
            "db/migration/V11__sprint4_calibration_catalog_returns.sql",
            "db/migration/V12__company_branding_and_letterhead.sql"
        }) {
            var stream = getClass().getClassLoader().getResourceAsStream(mig);
            if (stream != null) {
                String sql = new String(stream.readAllBytes()).replaceAll("(?m)^--.*$", "");
                for (String stmt : sql.split(";")) {
                    String t = stmt.trim();
                    if (!t.isEmpty()) jdbcTemplate.execute(t);
                }
            }
        }
        jdbcTemplate.update("""
            MERGE INTO tenants (id, name, owner_email, default_currency, country_code, timezone, status, created_at)
            KEY(id) VALUES ('ten_opes_cm', 'Sprint5 Tenant', 'owner@opesfuel.cm', 'FCFA', 'CM', 'Africa/Douala', 'ACTIVE', CURRENT_TIMESTAMP)
            """);
    }

    @Test
    void M23_loyaltyPrepaidVoucherPartialAndFullRedemptionNeverGoesNegative() throws Exception {
        MvcResult createRes = mockMvc.perform(post("/api/v1/enterprise/loyalty-vouchers")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"customerName\":\"CamTel Logistics\",\"customerPhone\":\"+237690001122\",\"issuedFcfa\":50000}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.balanceFcfa").value(50000))
            .andExpect(jsonPath("$.loyaltyPoints").value(50))
            .andReturn();
        String voucherId = objectMapper.readTree(createRes.getResponse().getContentAsString()).get("id").asText();

        // Partial redemption 30,000 FCFA -> 20,000 remaining ACTIVE
        mockMvc.perform(patch("/api/v1/enterprise/loyalty-vouchers/" + voucherId + "/redeem")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amountFcfa\":30000}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.balanceFcfa").value(20000))
            .andExpect(jsonPath("$.status").value("ACTIVE"));

        // Over-redemption clamps cleanly at 0 and marks REDEEMED (never negative)
        mockMvc.perform(patch("/api/v1/enterprise/loyalty-vouchers/" + voucherId + "/redeem")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amountFcfa\":25000}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.balanceFcfa").value(0))
            .andExpect(jsonPath("$.status").value("REDEEMED"));
    }

    @Test
    void M36_M54_fixedAssetsCapitalizationAndStationBudgetVariancePersistence() throws Exception {
        mockMvc.perform(post("/api/v1/enterprise/fixed-assets")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"assetTag\":\"GEN-DLA-250\",\"assetName\":\"Perkins 250kVA Standby Generator\",\"category\":\"GENERATOR\",\"acquisitionDate\":\"2026-01-15\",\"acquisitionCostFcfa\":18500000,\"usefulLifeYears\":10,\"custodian\":\"Chief Engineer\",\"insurancePolicy\":\"AXA-EQ-882\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE"));

        mockMvc.perform(get("/api/v1/enterprise/fixed-assets")
                .with(user("acct_01").roles("ACCOUNTANT")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].asset_tag").value("GEN-DLA-250"));

        mockMvc.perform(post("/api/v1/enterprise/budgets")
                .with(user("acct_01").roles("ACCOUNTANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"periodLabel\":\"2026-11\",\"category\":\"UTILITIES_ELECTRICITY\",\"budgetFcfa\":650000,\"actualFcfa\":590000}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.budgetFcfa").value(650000));
    }

    @Test
    void M38_M51_hseIncidentAndFranchiseDealerLifecycle() throws Exception {
        mockMvc.perform(post("/api/v1/enterprise/hse-records")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"recordType\":\"FIRE_DRILL\",\"severity\":\"LOW\",\"title\":\"Q4 Dry Powder Extinguisher Inspection\",\"details\":\"All 14 forecourt extinguishers pressure checked\",\"inspectorOrReporter\":\"HSE Officer\",\"nextDueDate\":\"2027-02-01\",\"capaAction\":\"Replace hose on Bay 2 unit\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("OPEN"));

        mockMvc.perform(post("/api/v1/enterprise/franchises")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_bastos\",\"dealerName\":\"SARL Energie Centre\",\"operatingModel\":\"DODO\",\"royaltyFcfaPerLitre\":12.5,\"monthlyTargetLitres\":180000,\"complianceScorePct\":94,\"renewalDate\":\"2029-12-31\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ACTIVE"));
    }

    @Test
    void M18_M52_serviceBayTicketAndB2bBulkWholesaleOrderFlow() throws Exception {
        mockMvc.perform(post("/api/v1/enterprise/service-bay")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"serviceCategory\":\"OIL_CHANGE\",\"vehiclePlate\":\"CE-4421-AA\",\"customerName\":\"Emmanuel Ndi\",\"technicianName\":\"Alain Tech\",\"amountFcfa\":28500,\"paymentMethod\":\"ORANGE_MONEY\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.amountFcfa").value(28500));

        mockMvc.perform(post("/api/v1/enterprise/bulk-orders")
                .with(user("mgr_01").roles("MANAGER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"stationId\":\"st_plateau\",\"customerCompany\":\"SABC Breweries Douala\",\"fuelGrade\":\"GASOIL\",\"volumeLitres\":15000,\"unitPriceFcfa\":800,\"tankerTruckCode\":\"TNK-32KL-04\",\"driverName\":\"Marc Etoa\",\"deliveryDestination\":\"Zone Industrielle Bassa\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalFcfa").value(12000000));
    }

    @Test
    void M04_M46_platformAdminSummaryAndAuditTrailIntegrity() throws Exception {
        mockMvc.perform(get("/api/v1/platform-admin/overview")
                .with(user("superadmin@opesware.com").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalTenants").isNumber());

        // Non-platform-admin MUST be rejected with 403 Forbidden
        mockMvc.perform(get("/api/v1/platform-admin/overview")
                .with(user("mgr_01").roles("MANAGER")))
            .andExpect(status().isForbidden());

        // Audit trail readable by Owner/Accountant, blocked for Attendant
        mockMvc.perform(get("/api/v1/audit/logs")
                .with(user("owner_01").roles("OWNER")))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/audit/logs")
                .with(user("att_01").roles("ATTENDANT")))
            .andExpect(status().isForbidden());
    }

    @Test
    void companyBrandingLogoAndLetterheadPersistenceAndRbac() throws Exception {
        String payload = """
            {
              "legalName": "SOCOMAR PETROLEUM SA",
              "tradingName": "Socomar Stations",
              "tagline": "Energy Across Central Africa",
              "taxIdNiu": "M081900112233K",
              "rccmNumber": "RC/DLA/2023/B/4412",
              "cnpsEmployerId": "341-0881200-000-B",
              "countryCode": "CM",
              "defaultCurrency": "FCFA",
              "vatRatePct": 19.25,
              "address": "Avenue Charles de Gaulle, Bonapriso",
              "city": "Douala, Cameroon",
              "phone": "+237 233 41 00 00",
              "email": "finance@socomar.cm",
              "website": "https://socomar.cm",
              "bankName": "Societe Generale Cameroun",
              "bankAccountIban": "CM21 10003 00100 02348192011 55",
              "mobileMoneyMerchant": "MTN MoMo #448912",
              "primaryColorHex": "#1E3A5F",
              "accentColorHex": "#CA8A04",
              "invoicePrefix": "SOC-INV-",
              "poPrefix": "SOC-PO-",
              "receiptPrefix": "SOC-RCP-",
              "paymentTerms": "Net 30 Days",
              "letterheadFooter": "SOCOMAR PETROLEUM SA - Licensed Distributor",
              "receiptHeaderNote": "Certified Quality Fuel 24/7",
              "receiptFooterNote": "Merci pour votre fidelite",
              "signatoryName": "Jean-Claude Biya",
              "signatoryTitle": "Managing Director",
              "logoDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
              "stampDataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
            }
            """;

        // Attendant MUST NOT be allowed to overwrite company logo/letterhead (403 Forbidden)
        mockMvc.perform(put("/api/v1/tenants/current/branding")
                .with(user("att_01").roles("ATTENDANT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isForbidden());

        // Owner saves company logo, letterhead, NIU, RCCM, IBAN, stamp & receipt settings
        mockMvc.perform(put("/api/v1/tenants/current/branding")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(payload))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.configured").value(true))
            .andExpect(jsonPath("$.legalName").value("SOCOMAR PETROLEUM SA"))
            .andExpect(jsonPath("$.taxIdNiu").value("M081900112233K"))
            .andExpect(jsonPath("$.invoicePrefix").value("SOC-INV-"))
            .andExpect(jsonPath("$.logoDataUrl").isNotEmpty());

        // Attendant CAN read branding profile to print 80mm branded thermal receipts (200 OK)
        mockMvc.perform(get("/api/v1/tenants/current/branding")
                .with(user("att_01").roles("ATTENDANT")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.tradingName").value("Socomar Stations"))
            .andExpect(jsonPath("$.rccmNumber").value("RC/DLA/2023/B/4412"));
    }
}
