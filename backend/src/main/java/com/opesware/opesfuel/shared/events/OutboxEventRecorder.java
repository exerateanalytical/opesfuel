package com.opesware.opesfuel.shared.events;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Entity
@Table(name = "outbox_events")
class OutboxRecordEntity {
    @Id
    @Column(name = "event_id")
    private String eventId;
    @Column(name = "event_type", nullable = false)
    private String eventType;
    @Column(name = "aggregate_type", nullable = false)
    private String aggregateType;
    @Column(name = "aggregate_id", nullable = false)
    private String aggregateId;
    @Column(name = "payload_json", nullable = false)
    private String payloadJson;
    @Column(nullable = false)
    private String summary;
    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;
    @Column(nullable = false)
    private boolean published;

    public static OutboxRecordEntity from(DomainEvent event, String payloadJson) {
        OutboxRecordEntity rec = new OutboxRecordEntity();
        rec.eventId = event.eventId();
        rec.eventType = event.getClass().getSimpleName();
        rec.aggregateType = event.aggregateType();
        rec.aggregateId = event.aggregateId();
        rec.payloadJson = payloadJson;
        rec.summary = event.summary();
        rec.occurredAt = event.occurredAt();
        rec.published = false;
        return rec;
    }
}

interface OutboxRecordRepository extends JpaRepository<OutboxRecordEntity, String> {}

@Service
public class OutboxEventRecorder {
    private final OutboxRecordRepository repository;
    private final ObjectMapper objectMapper;

    public OutboxEventRecorder(OutboxRecordRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @ApplicationModuleListener
    public void persistDomainEvent(DomainEvent event) {
        try {
            String json = objectMapper.writeValueAsString(event);
            repository.save(OutboxRecordEntity.from(event, json));
        } catch (Exception ex) {
            throw new IllegalStateException("Failed to serialize domain event to outbox", ex);
        }
    }
}
