package com.opesware.opesfuel;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.opesware.opesfuel.billing.momo.CameroonMsisdn;
import com.opesware.opesfuel.billing.momo.MomoProperties;
import com.opesware.opesfuel.billing.momo.MtnMomoClient;
import com.opesware.opesfuel.billing.momo.OrangeMoneyClient;
import com.opesware.opesfuel.notifications.OutboundMessagingService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import org.springframework.test.web.client.match.MockRestRequestMatchers;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import org.springframework.test.web.servlet.result.MockMvcResultMatchers;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MomoAndMessagingTests {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbcTemplate;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private OutboundMessagingService messagingService;

    @BeforeEach
    void setupSchemas() throws Exception {
        for (String mig : new String[]{
            "db/migration/V7__prelaunch_modules_hr_audit_safe_calibration.sql",
            "db/migration/V14__cameroon_momo_payments.sql",
            "db/migration/V15__messaging_delivery_and_otps.sql",
            "db/migration/V23__api_integration_connectors.sql"
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
    }

    @Test
    void cameroonMsisdnNormalizesAndDetectsMtnAndOrangePrefixes() {
        assertEquals("237677112233", CameroonMsisdn.normalize("677 11 22 33"));
        assertEquals("237651223344", CameroonMsisdn.normalize("+237 651-22-33-44"));
        assertEquals(CameroonMsisdn.Operator.MTN, CameroonMsisdn.detect("677112233"));
        assertEquals(CameroonMsisdn.Operator.MTN, CameroonMsisdn.detect("+237681000111"));
        assertEquals(CameroonMsisdn.Operator.ORANGE, CameroonMsisdn.detect("+237 699 44 55 66"));
        assertEquals(CameroonMsisdn.Operator.ORANGE, CameroonMsisdn.detect("00237656112233"));
        assertThrows(IllegalArgumentException.class, () -> CameroonMsisdn.normalize("12345"));
    }

    @Test
    void mtnMomoClientReturns503WhenUnconfiguredAndCallsRealEndpointsWhenConfigured() {
        MomoProperties props = new MomoProperties();
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        MtnMomoClient client = new MtnMomoClient(props, builder.build());

        // Unconfigured -> strict 503 (never fake success)
        ResponseStatusException uncfg = assertThrows(ResponseStatusException.class, () ->
            client.requestToPay("ref-1", "EXT-1", 25000, "237677112233", "Test", "EXT-1")
        );
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, uncfg.getStatusCode());

        // Configure MTN Cameroon prod credentials
        props.getMtn().setBaseUrl("https://proxy.momoapi.mtn.com");
        props.getMtn().setTargetEnvironment("mtncameroon");
        props.getMtn().setApiUser("api-user-cm");
        props.getMtn().setApiKey("api-secret-cm");
        props.getMtn().setCollectionSubscriptionKey("sub-key-cm");
        props.getMtn().setCallbackUrl("https://api.opesfuel.com/api/v1/public/webhooks/momo/mtn");

        server.expect(requestTo("https://proxy.momoapi.mtn.com/collection/token/"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("Ocp-Apim-Subscription-Key", "sub-key-cm"))
            .andRespond(withSuccess("{\"access_token\":\"mtn_tok_123\",\"expires_in\":3600}", MediaType.APPLICATION_JSON));

        server.expect(requestTo("https://proxy.momoapi.mtn.com/collection/v1_0/requesttopay"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("Authorization", "Bearer mtn_tok_123"))
            .andExpect(header("X-Reference-Id", "ref-uuid-01"))
            .andExpect(header("X-Target-Environment", "mtncameroon"))
            .andExpect(header("X-Callback-Url", "https://api.opesfuel.com/api/v1/public/webhooks/momo/mtn"))
            .andExpect(MockRestRequestMatchers.jsonPath("$.currency").value("XAF"))
            .andExpect(MockRestRequestMatchers.jsonPath("$.payer.partyId").value("237677112233"))
            .andRespond(withStatus(HttpStatus.ACCEPTED));

        server.expect(requestTo("https://proxy.momoapi.mtn.com/collection/v1_0/requesttopay/ref-uuid-01"))
            .andExpect(method(HttpMethod.GET))
            .andExpect(header("X-Target-Environment", "mtncameroon"))
            .andRespond(withSuccess("{\"status\":\"SUCCESSFUL\",\"financialTransactionId\":\"MTN-FIN-9887\"}", MediaType.APPLICATION_JSON));

        client.requestToPay("ref-uuid-01", "OPF-INV-01", 25000, "237677112233", "OpesFuel Invoice", "OPF-INV-01");
        MtnMomoClient.MtnTxStatus st = client.getRequestToPayStatus("ref-uuid-01");
        assertEquals("SUCCESSFUL", st.status());
        assertEquals("MTN-FIN-9887", st.financialTransactionId());
        server.verify();
    }

    @Test
    void orangeMoneyCameroonClientCallsOAuthWebPaymentAndTransactionStatus() {
        MomoProperties props = new MomoProperties();
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        OrangeMoneyClient client = new OrangeMoneyClient(props, builder.build());

        assertThrows(ResponseStatusException.class, () -> client.initiateWebPayment("ORD-1", 50000, "Test"));

        props.getOrange().setBaseUrl("https://api.orange.com");
        props.getOrange().setEnvironment("prod");
        props.getOrange().setClientId("om-client");
        props.getOrange().setClientSecret("om-secret");
        props.getOrange().setMerchantKey("om-merchant-key");
        props.getOrange().setNotifUrl("https://api.opesfuel.com/api/v1/public/webhooks/momo/orange");

        server.expect(requestTo("https://api.orange.com/oauth/v3/token"))
            .andExpect(method(HttpMethod.POST))
            .andRespond(withSuccess("{\"access_token\":\"om_tok_777\",\"expires_in\":3600}", MediaType.APPLICATION_JSON));

        server.expect(requestTo("https://api.orange.com/orange-money-webpay/cm/v1/webpayment"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("Authorization", "Bearer om_tok_777"))
            .andExpect(MockRestRequestMatchers.jsonPath("$.merchant_key").value("om-merchant-key"))
            .andExpect(MockRestRequestMatchers.jsonPath("$.currency").value("XAF"))
            .andExpect(MockRestRequestMatchers.jsonPath("$.amount").value(50000))
            .andRespond(withSuccess(
                "{\"pay_token\":\"PT_999\",\"payment_url\":\"https://webpayment.orange.cm/pay/PT_999\",\"notif_token\":\"NT_SECURE_55\"}",
                MediaType.APPLICATION_JSON
            ));

        server.expect(requestTo("https://api.orange.com/orange-money-webpay/cm/v1/transactionstatus"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(MockRestRequestMatchers.jsonPath("$.pay_token").value("PT_999"))
            .andRespond(withSuccess("{\"status\":\"SUCCESS\",\"txnid\":\"OM-CM-4455\"}", MediaType.APPLICATION_JSON));

        OrangeMoneyClient.OrangeInitResponse init = client.initiateWebPayment("ORD-CM-1", 50000, "OpesFuel Pro");
        assertEquals("PT_999", init.payToken());
        assertEquals("NT_SECURE_55", init.notifToken());

        OrangeMoneyClient.OrangeTxStatus status = client.checkTransactionStatus("ORD-CM-1", 50000, "PT_999");
        assertEquals("SUCCESS", status.status());
        assertEquals("OM-CM-4455", status.txnid());
        server.verify();
    }

    @Test
    void momoEndpointReturns503WhenProviderNotConfiguredAndOrangeWebhookRejectsBadNotifToken() throws Exception {
        mockMvc.perform(post("/api/v1/payments/momo/initiate")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"provider\":\"AUTO\",\"phoneNumber\":\"+237677112233\",\"amountFcfa\":25000,\"targetType\":\"SAAS_INVOICE\",\"targetId\":\"inv_01\"}"))
            .andExpect(status().isServiceUnavailable());

        mockMvc.perform(post("/api/v1/public/webhooks/momo/orange")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"notif_token\":\"FORGED_TOKEN\",\"status\":\"SUCCESS\",\"txnid\":\"FAKE\"}"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void messagingServiceDispatchesRealResendSmsAndWhatsappViaRestClientAndPasswordOtpWorks() throws Exception {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        messagingService.setRestClientForTesting(builder.build());

        ReflectionTestUtils.setField(messagingService, "mailProvider", "RESEND");
        ReflectionTestUtils.setField(messagingService, "mailApiKey", "re_test_key");
        ReflectionTestUtils.setField(messagingService, "smsProvider", "AFRICAS_TALKING");
        ReflectionTestUtils.setField(messagingService, "atUsername", "opesfuel");
        ReflectionTestUtils.setField(messagingService, "atApiKey", "at_test_key");
        ReflectionTestUtils.setField(messagingService, "whatsappProvider", "META_CLOUD");
        ReflectionTestUtils.setField(messagingService, "metaPhoneNumberId", "10998877");
        ReflectionTestUtils.setField(messagingService, "metaAccessToken", "meta_tok_123");

        server.expect(requestTo("https://api.resend.com/emails"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("Authorization", "Bearer re_test_key"))
            .andRespond(withSuccess("{\"id\":\"re_msg_01\"}", MediaType.APPLICATION_JSON));

        server.expect(requestTo("https://api.africastalking.com/version1/messaging"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("apiKey", "at_test_key"))
            .andRespond(withSuccess("{\"SMSMessageData\":{\"Message\":\"Sent\"}}", MediaType.APPLICATION_JSON));

        server.expect(requestTo("https://graph.facebook.com/v20.0/10998877/messages"))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("Authorization", "Bearer meta_tok_123"))
            .andRespond(withSuccess("{\"messages\":[{\"id\":\"wamid.123\"}]}", MediaType.APPLICATION_JSON));

        try {
            Map<String, Object> emailRes = messagingService.dispatch("ten_opes_cm", "owner", "EMAIL", "boss@station.cm", "Invoice", "Paid", "INVOICE");
            assertEquals("SENT", emailRes.get("status"));
            assertEquals("re_msg_01", emailRes.get("providerMessageId"));

            Map<String, Object> smsRes = messagingService.dispatch("ten_opes_cm", "owner", "SMS", "+237677112233", "OTP", "Code 123456", "OTP");
            assertEquals("SENT", smsRes.get("status"));

            Map<String, Object> waRes = messagingService.dispatch("ten_opes_cm", "owner", "WHATSAPP", "+237699112233", "Receipt", "40L SUPER", "RECEIPT");
            assertEquals("SENT", waRes.get("status"));
            assertEquals("wamid.123", waRes.get("providerMessageId"));

            server.verify();
        } finally {
            ReflectionTestUtils.setField(messagingService, "mailProvider", "LOG_ONLY");
            ReflectionTestUtils.setField(messagingService, "smsProvider", "LOG_ONLY");
            ReflectionTestUtils.setField(messagingService, "whatsappProvider", "LOG_ONLY");
        }

        // Password-reset OTP endpoint test (in LOG_ONLY test mode)
        mockMvc.perform(post("/api/v1/public/auth/request-otp")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"identifier\":\"owner@opesfuel.cm\",\"channel\":\"EMAIL\"}"))
            .andExpect(status().isOk())
            .andExpect(MockMvcResultMatchers.jsonPath("$.otpId").isNotEmpty());
    }

    @Test
    void adminPanelIntegrationConnectorsEncryptMaskPreserveSecretsAndEnforceRbac() throws Exception {
        // OWNER cannot write GLOBAL SaaS connectors (403 Forbidden)
        mockMvc.perform(put("/api/v1/integrations/connectors/MTN_MOMO")
                .with(user("owner_01").roles("OWNER"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"scope\":\"GLOBAL\",\"enabled\":true,\"config\":{\"apiUser\":\"u1\",\"apiKey\":\"secret-9999\"}}"))
            .andExpect(status().isForbidden());

        // PLATFORM_ADMIN saves GLOBAL MTN MoMo Cameroon connector -> encrypted at rest & hot-reloaded
        mockMvc.perform(put("/api/v1/integrations/connectors/MTN_MOMO")
                .with(user("admin_01").roles("PLATFORM_ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"scope":"GLOBAL","enabled":true,"config":{
                      "targetEnvironment":"mtncameroon",
                      "baseUrl":"https://proxy.momoapi.mtn.com",
                      "apiUser":"uuid-cameroon-01",
                      "apiKey":"super-secret-key-8842",
                      "collectionSubscriptionKey":"sub-key-primary-7731"
                    }}
                    """))
            .andExpect(status().isOk())
            .andExpect(MockMvcResultMatchers.jsonPath("$.encryptedAtRest").value(true))
            .andExpect(MockMvcResultMatchers.jsonPath("$.hotReloaded").value(true));

        // Verify stored DB payload is AES-256-GCM ciphertext (enc:v1:...) and contains NO plaintext secret
        String rawStored = jdbcTemplate.queryForObject(
            "SELECT config_json_encrypted FROM integration_connectors WHERE id = 'GLOBAL:GLOBAL:MTN_MOMO'",
            String.class
        );
        assertNotNull(rawStored);
        assertTrue(rawStored.startsWith("enc:v1:"));
        assertFalse(rawStored.contains("super-secret-key-8842"));

        // GET returns masked secrets only (••••8842), never plaintext
        mockMvc.perform(get("/api/v1/integrations/connectors?scope=GLOBAL")
                .with(user("admin_01").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(MockMvcResultMatchers.jsonPath("$[0].providerKey").value("MTN_MOMO"))
            .andExpect(MockMvcResultMatchers.jsonPath("$[0].config.apiKey").value("••••8842"))
            .andExpect(MockMvcResultMatchers.jsonPath("$[0].secretPresent.apiKey").value(true));

        // Partial update leaving apiKey blank preserves existing encrypted secret
        mockMvc.perform(put("/api/v1/integrations/connectors/MTN_MOMO")
                .with(user("admin_01").roles("PLATFORM_ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"scope\":\"GLOBAL\",\"enabled\":true,\"config\":{\"apiUser\":\"uuid-cameroon-02\",\"apiKey\":\"\"}}"))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/integrations/connectors?scope=GLOBAL")
                .with(user("admin_01").roles("PLATFORM_ADMIN")))
            .andExpect(status().isOk())
            .andExpect(MockMvcResultMatchers.jsonPath("$[0].config.apiUser").value("uuid-cameroon-02"))
            .andExpect(MockMvcResultMatchers.jsonPath("$[0].config.apiKey").value("••••8842"));

        // Clean up runtime hot-reloaded credentials so subsequent tests stay isolated
        mockMvc.perform(put("/api/v1/integrations/connectors/MTN_MOMO")
                .with(user("admin_01").roles("PLATFORM_ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"scope\":\"GLOBAL\",\"enabled\":false,\"config\":{\"apiUser\":\"\",\"apiKey\":\"\",\"collectionSubscriptionKey\":\"\"}}"))
            .andExpect(status().isOk());
    }
}
