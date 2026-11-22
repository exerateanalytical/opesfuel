package com.opesware.opesfuel.billing;

import java.util.Map;

/**
 * Exposed Spring Modulith API for initiating Cameroon Mobile Money payments from other bounded contexts (e.g. Fleet Portal).
 */
public interface MomoPaymentApi {
    Map<String, Object> initiatePayment(
        String tenantId,
        String actor,
        String targetType,
        String targetId,
        long amountFcfa,
        String rawPhone,
        String requestedProvider,
        String description,
        String idempotencyKey
    );
}
