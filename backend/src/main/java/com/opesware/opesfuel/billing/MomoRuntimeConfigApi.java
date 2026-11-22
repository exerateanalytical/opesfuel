package com.opesware.opesfuel.billing;

import java.util.Map;

/**
 * Exposed Spring Modulith API allowing the Admin Integrations Hub to hot-reload
 * and live-test MTN MoMo & Orange Money Cameroon credentials at runtime without restarting.
 */
public interface MomoRuntimeConfigApi {
    void applyMtnConfig(Map<String, String> config);
    void applyOrangeConfig(Map<String, String> config);
    Map<String, Object> testMtnConnection();
    Map<String, Object> testOrangeConnection();
}
