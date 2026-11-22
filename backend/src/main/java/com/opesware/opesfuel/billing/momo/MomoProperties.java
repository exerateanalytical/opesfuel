package com.opesware.opesfuel.billing.momo;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "opesfuel.momo")
public class MomoProperties {

    private boolean reconcileEnabled = true;
    private long txExpiryMinutes = 15;
    private final Mtn mtn = new Mtn();
    private final Orange orange = new Orange();

    public boolean isReconcileEnabled() { return reconcileEnabled; }
    public void setReconcileEnabled(boolean reconcileEnabled) { this.reconcileEnabled = reconcileEnabled; }
    public long getTxExpiryMinutes() { return txExpiryMinutes; }
    public void setTxExpiryMinutes(long txExpiryMinutes) { this.txExpiryMinutes = txExpiryMinutes; }
    public Mtn getMtn() { return mtn; }
    public Orange getOrange() { return orange; }

    public static class Mtn {
        private String baseUrl = "https://sandbox.momodeveloper.mtn.com";
        private String targetEnvironment = "sandbox";
        private String apiUser = "";
        private String apiKey = "";
        private String collectionSubscriptionKey = "";
        private String disbursementSubscriptionKey = "";
        private String callbackUrl = "";

        public boolean isConfigured() {
            return notBlank(apiUser) && notBlank(apiKey) && notBlank(collectionSubscriptionKey);
        }

        public boolean isDisbursementConfigured() {
            return notBlank(apiUser) && notBlank(apiKey) && notBlank(disbursementSubscriptionKey);
        }

        public String resolveCurrency() {
            return "sandbox".equalsIgnoreCase(targetEnvironment) ? "EUR" : "XAF";
        }

        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public String getTargetEnvironment() { return targetEnvironment; }
        public void setTargetEnvironment(String targetEnvironment) { this.targetEnvironment = targetEnvironment; }
        public String getApiUser() { return apiUser; }
        public void setApiUser(String apiUser) { this.apiUser = apiUser; }
        public String getApiKey() { return apiKey; }
        public void setApiKey(String apiKey) { this.apiKey = apiKey; }
        public String getCollectionSubscriptionKey() { return collectionSubscriptionKey; }
        public void setCollectionSubscriptionKey(String collectionSubscriptionKey) { this.collectionSubscriptionKey = collectionSubscriptionKey; }
        public String getDisbursementSubscriptionKey() { return disbursementSubscriptionKey; }
        public void setDisbursementSubscriptionKey(String disbursementSubscriptionKey) { this.disbursementSubscriptionKey = disbursementSubscriptionKey; }
        public String getCallbackUrl() { return callbackUrl; }
        public void setCallbackUrl(String callbackUrl) { this.callbackUrl = callbackUrl; }
    }

    public static class Orange {
        private String baseUrl = "https://api.orange.com";
        private String environment = "dev";
        private String clientId = "";
        private String clientSecret = "";
        private String merchantKey = "";
        private String returnUrl = "https://app.opesfuel.com/#/app/admin";
        private String cancelUrl = "https://app.opesfuel.com/#/app/admin";
        private String notifUrl = "";
        private String lang = "fr";

        public boolean isConfigured() {
            return notBlank(clientId) && notBlank(clientSecret) && notBlank(merchantKey);
        }

        public String resolveCurrency() {
            return "prod".equalsIgnoreCase(environment) || "cm".equalsIgnoreCase(environment) ? "XAF" : "OUV";
        }

        public String resolveWebPaySegment() {
            return "prod".equalsIgnoreCase(environment) || "cm".equalsIgnoreCase(environment) ? "cm" : "dev";
        }

        public String getBaseUrl() { return baseUrl; }
        public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
        public String getEnvironment() { return environment; }
        public void setEnvironment(String environment) { this.environment = environment; }
        public String getClientId() { return clientId; }
        public void setClientId(String clientId) { this.clientId = clientId; }
        public String getClientSecret() { return clientSecret; }
        public void setClientSecret(String clientSecret) { this.clientSecret = clientSecret; }
        public String getMerchantKey() { return merchantKey; }
        public void setMerchantKey(String merchantKey) { this.merchantKey = merchantKey; }
        public String getReturnUrl() { return returnUrl; }
        public void setReturnUrl(String returnUrl) { this.returnUrl = returnUrl; }
        public String getCancelUrl() { return cancelUrl; }
        public void setCancelUrl(String cancelUrl) { this.cancelUrl = cancelUrl; }
        public String getNotifUrl() { return notifUrl; }
        public void setNotifUrl(String notifUrl) { this.notifUrl = notifUrl; }
        public String getLang() { return lang; }
        public void setLang(String lang) { this.lang = lang; }
    }

    private static boolean notBlank(String v) {
        return v != null && !v.isBlank();
    }
}
