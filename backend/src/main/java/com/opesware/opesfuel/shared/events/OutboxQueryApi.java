package com.opesware.opesfuel.shared.events;

import java.time.Instant;
import java.util.List;

public interface OutboxQueryApi {

    record OutboxEventView(
        String eventId,
        String tenantId,
        String stationId,
        String eventType,
        String aggregateType,
        String aggregateId,
        String payloadJson,
        String summary,
        Instant occurredAt,
        boolean published,
        int retryCount
    ) {}

    List<OutboxEventView> listRecentEvents(String tenantId, String stationId, int limit);
    List<OutboxEventView> findUnpublishedBatch(int batchSize);
    void markPublished(String eventId);
    void recordFailure(String eventId, String error, int maxRetries);
}
