package com.opesware.opesfuel.shared.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "outbox_events")
class OutboxRecordEntity {
    @Id
    @Column(name = "event_id")
    private String eventId;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;
    @Column(name = "station_id")
    private String stationId;
    @Column(name = "event_type", nullable = false)
    private String eventType;
    @Column(name = "aggregate_type", nullable = false)
    private String aggregateType;
    @Column(name = "aggregate_id", nullable = false)
    private String aggregateId;
    @Column(name = "payload_json", nullable = false, columnDefinition = "TEXT")
    private String payloadJson;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String summary;
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;
    @Column(nullable = false)
    private boolean published;
    @Column(name = "retry_count", nullable = false)
    private int retryCount;
    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;
    @Column(name = "published_at")
    private Instant publishedAt;

    public static OutboxRecordEntity from(DomainEvent event, String payloadJson) {
        OutboxRecordEntity rec = new OutboxRecordEntity();
        rec.eventId = event.eventId();
        rec.tenantId = event.tenantId() != null ? event.tenantId() : "ten_opes_cm";
        rec.stationId = event.stationId();
        rec.eventType = event.getClass().getSimpleName();
        rec.aggregateType = event.aggregateType();
        rec.aggregateId = event.aggregateId();
        rec.payloadJson = payloadJson;
        rec.summary = event.summary();
        rec.occurredAt = event.occurredAt();
        rec.published = false;
        rec.retryCount = 0;
        return rec;
    }

    public void markPublished() {
        this.published = true;
        this.publishedAt = Instant.now();
        this.lastError = null;
    }

    public void recordDeliveryFailure(String error, int maxRetries) {
        this.retryCount += 1;
        this.lastError = error != null && error.length() > 1000 ? error.substring(0, 1000) : error;
        if (this.retryCount >= maxRetries) {
            this.published = true;
            this.publishedAt = Instant.now();
        }
    }

    public OutboxQueryApi.OutboxEventView toView() {
        return new OutboxQueryApi.OutboxEventView(
            eventId, tenantId, stationId, eventType, aggregateType, aggregateId,
            payloadJson, summary, occurredAt, published, retryCount
        );
    }

    public String getEventId() { return eventId; }
}

interface OutboxRecordRepository extends JpaRepository<OutboxRecordEntity, String> {
    List<OutboxRecordEntity> findByTenantIdOrderByOccurredAtDesc(String tenantId, PageRequest pageable);
    List<OutboxRecordEntity> findByTenantIdAndStationIdOrderByOccurredAtDesc(String tenantId, String stationId, PageRequest pageable);
    List<OutboxRecordEntity> findByPublishedFalseOrderByOccurredAtAsc(PageRequest pageable);
}

@Service
public class OutboxEventRecorder implements OutboxQueryApi {
    private final OutboxRecordRepository repository;
    private final ObjectMapper objectMapper;

    public OutboxEventRecorder(OutboxRecordRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @ApplicationModuleListener
    public void persistDomainEvent(DomainEvent event) {
        try {
            if (repository.existsById(event.eventId())) {
                return;
            }
            String json = objectMapper.writeValueAsString(event);
            repository.save(OutboxRecordEntity.from(event, json));
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to serialize domain event to outbox", ex);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public List<OutboxEventView> listRecentEvents(String tenantId, String stationId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, 200));
        PageRequest page = PageRequest.of(0, safeLimit);
        List<OutboxRecordEntity> rows = (stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId))
            ? repository.findByTenantIdAndStationIdOrderByOccurredAtDesc(tenantId, stationId, page)
            : repository.findByTenantIdOrderByOccurredAtDesc(tenantId, page);
        return rows.stream().map(OutboxRecordEntity::toView).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<OutboxEventView> findUnpublishedBatch(int batchSize) {
        return repository.findByPublishedFalseOrderByOccurredAtAsc(PageRequest.of(0, Math.max(1, batchSize)))
            .stream()
            .map(OutboxRecordEntity::toView)
            .toList();
    }

    @Override
    @Transactional
    public void markPublished(String eventId) {
        repository.findById(eventId).ifPresent(rec -> {
            rec.markPublished();
            repository.save(rec);
        });
    }

    @Override
    @Transactional
    public void recordFailure(String eventId, String error, int maxRetries) {
        repository.findById(eventId).ifPresent(rec -> {
            rec.recordDeliveryFailure(error, maxRetries);
            repository.save(rec);
        });
    }
}
