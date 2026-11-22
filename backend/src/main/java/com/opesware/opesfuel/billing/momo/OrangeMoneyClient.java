package com.opesware.opesfuel.billing.momo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Production Orange Money Cameroon WebPay API v1 client (OAuth v3 + webpayment + transactionstatus).
 */
@Component
public class OrangeMoneyClient {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE = new ParameterizedTypeReference<>() {};

    private final MomoProperties props;
    private final RestClient restClient;

    private volatile String cachedToken;
    private volatile Instant tokenExpiry = Instant.EPOCH;

    @Autowired
    public OrangeMoneyClient(MomoProperties props) {
        this(props, createDefaultRestClient());
    }

    public OrangeMoneyClient(MomoProperties props, RestClient restClient) {
        this.props = props;
        this.restClient = restClient;
    }

    private static RestClient createDefaultRestClient() {
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(5000);
        rf.setReadTimeout(12000);
        return RestClient.builder().requestFactory(rf).build();
    }

    public void clearTokenCache() {
        this.cachedToken = null;
        this.tokenExpiry = Instant.EPOCH;
    }

    private void requireConfigured() {
        if (!props.getOrange().isConfigured()) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "Orange Money Cameroon provider is not configured. Set OPESFUEL_ORANGE_CLIENT_ID, OPESFUEL_ORANGE_CLIENT_SECRET, and OPESFUEL_ORANGE_MERCHANT_KEY."
            );
        }
    }

    private synchronized String getAccessToken() {
        requireConfigured();
        if (cachedToken != null && Instant.now().isBefore(tokenExpiry)) {
            return cachedToken;
        }
        MomoProperties.Orange om = props.getOrange();
        String basic = Base64.getEncoder().encodeToString(
            (om.getClientId() + ":" + om.getClientSecret()).getBytes(StandardCharsets.UTF_8)
        );
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "client_credentials");
        try {
            Map<String, Object> body = restClient.post()
                .uri(trimSlash(om.getBaseUrl()) + "/oauth/v3/token")
                .header(HttpHeaders.AUTHORIZATION, "Basic " + basic)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .accept(MediaType.APPLICATION_JSON)
                .body(form)
                .retrieve()
                .body(MAP_TYPE);
            if (body == null || body.get("access_token") == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Orange Money OAuth response missing access_token.");
            }
            String token = String.valueOf(body.get("access_token"));
            long expiresIn = body.get("expires_in") instanceof Number n ? n.longValue() : 3600L;
            this.cachedToken = token;
            this.tokenExpiry = Instant.now().plusSeconds(Math.max(30L, expiresIn - 60L));
            return token;
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Orange Money OAuth failed: " + ex.getMessage(), ex);
        }
    }

    public OrangeInitResponse initiateWebPayment(String orderId, long amountFcfa, String referenceLabel) {
        String token = getAccessToken();
        MomoProperties.Orange om = props.getOrange();
        String seg = om.resolveWebPaySegment();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("merchant_key", om.getMerchantKey());
        payload.put("currency", om.resolveCurrency());
        payload.put("order_id", orderId);
        payload.put("amount", amountFcfa);
        payload.put("return_url", om.getReturnUrl());
        payload.put("cancel_url", om.getCancelUrl());
        payload.put("notif_url", om.getNotifUrl() != null && !om.getNotifUrl().isBlank() ? om.getNotifUrl() : om.getReturnUrl());
        payload.put("lang", om.getLang() != null && !om.getLang().isBlank() ? om.getLang() : "fr");
        payload.put("reference", referenceLabel != null && !referenceLabel.isBlank() ? referenceLabel : "OpesFuel");

        try {
            Map<String, Object> resp = restClient.post()
                .uri(trimSlash(om.getBaseUrl()) + "/orange-money-webpay/" + seg + "/v1/webpayment")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(MAP_TYPE);
            if (resp == null || resp.get("payment_url") == null || resp.get("pay_token") == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Orange Money webpayment response incomplete.");
            }
            return new OrangeInitResponse(
                String.valueOf(resp.get("pay_token")),
                String.valueOf(resp.get("payment_url")),
                resp.get("notif_token") != null ? String.valueOf(resp.get("notif_token")) : null
            );
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Orange Money webpayment init failed: " + ex.getMessage(), ex);
        }
    }

    public OrangeTxStatus checkTransactionStatus(String orderId, long amountFcfa, String payToken) {
        String token = getAccessToken();
        MomoProperties.Orange om = props.getOrange();
        String seg = om.resolveWebPaySegment();

        Map<String, Object> payload = Map.of(
            "order_id", orderId,
            "amount", amountFcfa,
            "pay_token", payToken
        );
        try {
            Map<String, Object> resp = restClient.post()
                .uri(trimSlash(om.getBaseUrl()) + "/orange-money-webpay/" + seg + "/v1/transactionstatus")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .body(MAP_TYPE);
            if (resp == null) {
                return new OrangeTxStatus("PENDING", null);
            }
            String rawStatus = resp.get("status") != null ? String.valueOf(resp.get("status")).toUpperCase() : "PENDING";
            String txnid = resp.get("txnid") != null ? String.valueOf(resp.get("txnid")) : null;
            return new OrangeTxStatus(rawStatus, txnid);
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Orange Money transactionstatus failed: " + ex.getMessage(), ex);
        }
    }

    public record OrangeInitResponse(String payToken, String paymentUrl, String notifToken) {}
    public record OrangeTxStatus(String status, String txnid) {}

    private static String trimSlash(String url) {
        return url == null ? "" : url.replaceAll("/+$", "");
    }
}
