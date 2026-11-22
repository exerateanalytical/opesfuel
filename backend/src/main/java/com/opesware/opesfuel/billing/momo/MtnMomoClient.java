package com.opesware.opesfuel.billing.momo;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Production MTN MoMo Open API v1.0 client (Collections & Disbursements) for Cameroon (mtncameroon) & Sandbox.
 */
@Component
public class MtnMomoClient {

    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE = new ParameterizedTypeReference<>() {};

    private final MomoProperties props;
    private final RestClient restClient;

    private volatile String cachedCollectionToken;
    private volatile Instant collectionTokenExpiry = Instant.EPOCH;
    private volatile String cachedDisbursementToken;
    private volatile Instant disbursementTokenExpiry = Instant.EPOCH;

    @Autowired
    public MtnMomoClient(MomoProperties props) {
        this(props, createDefaultRestClient());
    }

    public MtnMomoClient(MomoProperties props, RestClient restClient) {
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
        this.cachedCollectionToken = null;
        this.collectionTokenExpiry = Instant.EPOCH;
        this.cachedDisbursementToken = null;
        this.disbursementTokenExpiry = Instant.EPOCH;
    }

    private void requireCollectionConfigured() {
        if (!props.getMtn().isConfigured()) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "MTN MoMo provider is not configured. Set OPESFUEL_MTN_API_USER, OPESFUEL_MTN_API_KEY, and OPESFUEL_MTN_COLLECTION_SUBSCRIPTION_KEY."
            );
        }
    }

    private synchronized String getCollectionAccessToken() {
        requireCollectionConfigured();
        if (cachedCollectionToken != null && Instant.now().isBefore(collectionTokenExpiry)) {
            return cachedCollectionToken;
        }
        MomoProperties.Mtn mtn = props.getMtn();
        String basic = Base64.getEncoder().encodeToString(
            (mtn.getApiUser() + ":" + mtn.getApiKey()).getBytes(StandardCharsets.UTF_8)
        );
        try {
            Map<String, Object> body = restClient.post()
                .uri(trimSlash(mtn.getBaseUrl()) + "/collection/token/")
                .header(HttpHeaders.AUTHORIZATION, "Basic " + basic)
                .header("Ocp-Apim-Subscription-Key", mtn.getCollectionSubscriptionKey())
                .contentType(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(MAP_TYPE);
            if (body == null || body.get("access_token") == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MTN MoMo token response missing access_token.");
            }
            String token = String.valueOf(body.get("access_token"));
            long expiresIn = body.get("expires_in") instanceof Number n ? n.longValue() : 3600L;
            this.cachedCollectionToken = token;
            this.collectionTokenExpiry = Instant.now().plusSeconds(Math.max(30L, expiresIn - 60L));
            return token;
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MTN MoMo token request failed: " + ex.getMessage(), ex);
        }
    }

    public String verifyCollectionAuth() {
        clearTokenCache();
        getCollectionAccessToken();
        return "Authenticated with MTN MoMo (" + props.getMtn().getTargetEnvironment() + " · " + props.getMtn().resolveCurrency() + ").";
    }

    private synchronized String getDisbursementAccessToken() {
        if (!props.getMtn().isDisbursementConfigured()) {
            throw new ResponseStatusException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "MTN MoMo Disbursement is not configured. Set OPESFUEL_MTN_DISBURSEMENT_SUBSCRIPTION_KEY."
            );
        }
        if (cachedDisbursementToken != null && Instant.now().isBefore(disbursementTokenExpiry)) {
            return cachedDisbursementToken;
        }
        MomoProperties.Mtn mtn = props.getMtn();
        String basic = Base64.getEncoder().encodeToString(
            (mtn.getApiUser() + ":" + mtn.getApiKey()).getBytes(StandardCharsets.UTF_8)
        );
        try {
            Map<String, Object> body = restClient.post()
                .uri(trimSlash(mtn.getBaseUrl()) + "/disbursement/token/")
                .header(HttpHeaders.AUTHORIZATION, "Basic " + basic)
                .header("Ocp-Apim-Subscription-Key", mtn.getDisbursementSubscriptionKey())
                .contentType(MediaType.APPLICATION_JSON)
                .retrieve()
                .body(MAP_TYPE);
            if (body == null || body.get("access_token") == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MTN MoMo disbursement token missing access_token.");
            }
            String token = String.valueOf(body.get("access_token"));
            long expiresIn = body.get("expires_in") instanceof Number n ? n.longValue() : 3600L;
            this.cachedDisbursementToken = token;
            this.disbursementTokenExpiry = Instant.now().plusSeconds(Math.max(30L, expiresIn - 60L));
            return token;
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MTN MoMo disbursement token failed: " + ex.getMessage(), ex);
        }
    }

    public void requestToPay(
        String referenceId,
        String externalId,
        long amountFcfa,
        String normalizedMsisdn,
        String payerMessage,
        String payeeNote
    ) {
        String token = getCollectionAccessToken();
        MomoProperties.Mtn mtn = props.getMtn();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("amount", String.valueOf(amountFcfa));
        payload.put("currency", mtn.resolveCurrency());
        payload.put("externalId", externalId);
        payload.put("payer", Map.of("partyIdType", "MSISDN", "partyId", normalizedMsisdn));
        payload.put("payerMessage", sanitizeNote(payerMessage, "OpesFuel Payment"));
        payload.put("payeeNote", sanitizeNote(payeeNote, externalId));

        try {
            RestClient.RequestBodySpec spec = restClient.post()
                .uri(trimSlash(mtn.getBaseUrl()) + "/collection/v1_0/requesttopay")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header("X-Reference-Id", referenceId)
                .header("X-Target-Environment", mtn.getTargetEnvironment())
                .header("Ocp-Apim-Subscription-Key", mtn.getCollectionSubscriptionKey())
                .contentType(MediaType.APPLICATION_JSON);

            if (mtn.getCallbackUrl() != null && !mtn.getCallbackUrl().isBlank()) {
                spec = spec.header("X-Callback-Url", mtn.getCallbackUrl().trim());
            }

            spec.body(payload).retrieve().toBodilessEntity();
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MTN MoMo requestToPay failed: " + ex.getMessage(), ex);
        }
    }

    public MtnTxStatus getRequestToPayStatus(String referenceId) {
        String token = getCollectionAccessToken();
        MomoProperties.Mtn mtn = props.getMtn();
        try {
            Map<String, Object> body = restClient.get()
                .uri(trimSlash(mtn.getBaseUrl()) + "/collection/v1_0/requesttopay/" + referenceId)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header("X-Target-Environment", mtn.getTargetEnvironment())
                .header("Ocp-Apim-Subscription-Key", mtn.getCollectionSubscriptionKey())
                .retrieve()
                .body(MAP_TYPE);
            if (body == null) {
                return new MtnTxStatus("PENDING", null, null);
            }
            String status = body.get("status") != null ? String.valueOf(body.get("status")).toUpperCase() : "PENDING";
            String finId = body.get("financialTransactionId") != null ? String.valueOf(body.get("financialTransactionId")) : null;
            String reason = body.get("reason") != null ? String.valueOf(body.get("reason")) : null;
            return new MtnTxStatus(status, finId, reason);
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MTN MoMo status check failed: " + ex.getMessage(), ex);
        }
    }

    public void disburseTransfer(String referenceId, String externalId, long amountFcfa, String normalizedMsisdn, String note) {
        String token = getDisbursementAccessToken();
        MomoProperties.Mtn mtn = props.getMtn();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("amount", String.valueOf(amountFcfa));
        payload.put("currency", mtn.resolveCurrency());
        payload.put("externalId", externalId);
        payload.put("payee", Map.of("partyIdType", "MSISDN", "partyId", normalizedMsisdn));
        payload.put("payerMessage", sanitizeNote(note, "OpesFuel Refund"));
        payload.put("payeeNote", sanitizeNote(note, externalId));

        try {
            restClient.post()
                .uri(trimSlash(mtn.getBaseUrl()) + "/disbursement/v1_0/transfer")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .header("X-Reference-Id", referenceId)
                .header("X-Target-Environment", mtn.getTargetEnvironment())
                .header("Ocp-Apim-Subscription-Key", mtn.getDisbursementSubscriptionKey())
                .contentType(MediaType.APPLICATION_JSON)
                .body(payload)
                .retrieve()
                .toBodilessEntity();
        } catch (RestClientException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "MTN MoMo refund transfer failed: " + ex.getMessage(), ex);
        }
    }

    public record MtnTxStatus(String status, String financialTransactionId, String reason) {}

    private static String sanitizeNote(String value, String fallback) {
        String raw = (value == null || value.isBlank()) ? fallback : value;
        String clean = raw.replaceAll("[^a-zA-Z0-9 .,:;_-]", " ").trim();
        return clean.length() > 120 ? clean.substring(0, 120) : clean;
    }

    private static String trimSlash(String url) {
        return url == null ? "" : url.replaceAll("/+$", "");
    }
}
