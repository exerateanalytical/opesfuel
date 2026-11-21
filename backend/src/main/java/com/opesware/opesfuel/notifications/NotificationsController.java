package com.opesware.opesfuel.notifications;

import com.opesware.opesfuel.shared.events.DomainEvent.DemoLeadCapturedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.DipstickVarianceFlaggedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.ShiftClosedEvent;
import com.opesware.opesfuel.shared.events.DomainEvent.StaffInvitedEvent;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import com.opesware.opesfuel.station.StationCatalogApi;
import jakarta.persistence.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "alert_notifications")
class AlertNotificationEntity {
    @Id
    private String id;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;
    @Column(name = "station_id")
    private String stationId;
    @Column(nullable = false)
    private String severity;
    @Column(nullable = false)
    private String category;
    @Column(nullable = false)
    private String title;
    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;
    @Column(name = "read_flag", nullable = false)
    private boolean readFlag;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static AlertNotificationEntity create(String tenantId, String stationId, String severity, String category, String title, String message) {
        AlertNotificationEntity a = new AlertNotificationEntity();
        a.id = "alrt_" + UUID.randomUUID();
        a.tenantId = tenantId != null ? tenantId : TenantAccessGuard.DEFAULT_TENANT_ID;
        a.stationId = stationId;
        a.severity = severity;
        a.category = category;
        a.title = title;
        a.message = message;
        a.readFlag = false;
        a.createdAt = Instant.now();
        return a;
    }

    public void markRead() { this.readFlag = true; }

    public String getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getStationId() { return stationId; }
    public String getSeverity() { return severity; }
    public String getCategory() { return category; }
    public String getTitle() { return title; }
    public String getMessage() { return message; }
    public boolean isRead() { return readFlag; }
    public Instant getCreatedAt() { return createdAt; }
}

interface AlertNotificationRepository extends JpaRepository<AlertNotificationEntity, String> {
    List<AlertNotificationEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId, PageRequest pageable);
    List<AlertNotificationEntity> findByTenantIdAndReadFlagFalseOrderByCreatedAtDesc(String tenantId, PageRequest pageable);
    List<AlertNotificationEntity> findByTenantIdAndReadFlagFalse(String tenantId);
}

@Service
class NotificationService {
    private static final Logger log = LoggerFactory.getLogger(NotificationService.class);

    private final AlertNotificationRepository repository;
    private final TenantAccessGuard accessGuard;
    private final StationCatalogApi stationCatalogApi;
    private final String relayWebhookUrl;
    private final RestClient restClient;

    NotificationService(
        AlertNotificationRepository repository,
        TenantAccessGuard accessGuard,
        StationCatalogApi stationCatalogApi,
        @Value("${opesfuel.notifications.webhook-url:}") String relayWebhookUrl
    ) {
        this.repository = repository;
        this.accessGuard = accessGuard;
        this.stationCatalogApi = stationCatalogApi;
        this.relayWebhookUrl = relayWebhookUrl;
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(3000);
        rf.setReadTimeout(5000);
        this.restClient = RestClient.builder().requestFactory(rf).build();
    }

    @ApplicationModuleListener
    public void onDipstickVariance(DipstickVarianceFlaggedEvent event) {
        AlertNotificationEntity saved = repository.save(AlertNotificationEntity.create(
            event.tenantId(), event.stationId(), "CRITICAL", "DIPSTICK_VARIANCE",
            "Tank Dipstick Variance Alert (" + event.varianceLitres() + " L)",
            event.summary()
        ));
        relayExternallyIfConfigured(saved);
    }

    @ApplicationModuleListener
    public void onShiftClosed(ShiftClosedEvent event) {
        if (Math.abs(event.varianceFcfa()) >= 5_000L) {
            AlertNotificationEntity saved = repository.save(AlertNotificationEntity.create(
                event.tenantId(), event.stationId(),
                event.varianceFcfa() < 0 ? "WARNING" : "INFO",
                "CASH_VARIANCE",
                "Shift Cash Variance (" + event.varianceFcfa() + " FCFA)",
                event.summary()
            ));
            relayExternallyIfConfigured(saved);
        }
    }

    @ApplicationModuleListener
    public void onStaffInvited(StaffInvitedEvent event) {
        AlertNotificationEntity saved = repository.save(AlertNotificationEntity.create(
            event.tenantId(), event.stationId(), "INFO", "STAFF_INVITE",
            "Staff Invitation Issued", event.summary()
        ));
        relayExternallyIfConfigured(saved);
    }

    @ApplicationModuleListener
    public void onDemoLeadCaptured(DemoLeadCapturedEvent event) {
        AlertNotificationEntity saved = repository.save(AlertNotificationEntity.create(
            event.tenantId(), null, "INFO", "DEMO_LEAD",
            "New Demo Lead: " + event.stationName(), event.summary()
        ));
        relayExternallyIfConfigured(saved);
    }

    @Transactional(readOnly = true)
    public List<AlertNotificationEntity> listAlerts(String stationId, boolean unreadOnly, int limit) {
        String tenantId = accessGuard.currentTenantId();
        PageRequest page = PageRequest.of(0, Math.max(1, Math.min(limit, 100)));
        List<AlertNotificationEntity> alerts = unreadOnly
            ? repository.findByTenantIdAndReadFlagFalseOrderByCreatedAtDesc(tenantId, page)
            : repository.findByTenantIdOrderByCreatedAtDesc(tenantId, page);
        if (stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId)) {
            stationCatalogApi.requireAccessibleStation(stationId);
            return alerts.stream().filter(a -> stationId.equals(a.getStationId()) || a.getStationId() == null).toList();
        }
        return alerts;
    }

    @Transactional
    public AlertNotificationEntity markRead(String alertId) {
        AlertNotificationEntity alert = repository.findById(alertId)
            .orElseThrow(() -> new IllegalArgumentException("Alert not found: " + alertId));
        accessGuard.assertTenantMatch(alert.getTenantId());
        alert.markRead();
        return repository.save(alert);
    }

    @Transactional
    public Map<String, Object> markAllRead() {
        List<AlertNotificationEntity> unread = repository.findByTenantIdAndReadFlagFalse(accessGuard.currentTenantId());
        unread.forEach(AlertNotificationEntity::markRead);
        repository.saveAll(unread);
        return Map.of("markedReadCount", unread.size());
    }

    private void relayExternallyIfConfigured(AlertNotificationEntity alert) {
        if (relayWebhookUrl == null || relayWebhookUrl.isBlank()) return;
        try {
            restClient.post()
                .uri(relayWebhookUrl)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of(
                    "id", alert.getId(),
                    "severity", alert.getSeverity(),
                    "category", alert.getCategory(),
                    "title", alert.getTitle(),
                    "message", alert.getMessage(),
                    "createdAt", alert.getCreatedAt().toString()
                ))
                .retrieve()
                .toBodilessEntity();
        } catch (Exception ex) {
            log.warn("Failed to relay alert {} externally: {}", alert.getId(), ex.getMessage());
        }
    }
}

@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationsController {
    private final NotificationService service;

    public NotificationsController(NotificationService service) {
        this.service = service;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT','ATTENDANT') or hasAuthority('SCOPE_notifications:read')")
    public List<AlertNotificationEntity> listAlerts(
        @RequestParam(required = false, defaultValue = "ALL") String stationId,
        @RequestParam(required = false, defaultValue = "false") boolean unreadOnly,
        @RequestParam(required = false, defaultValue = "50") int limit
    ) {
        return service.listAlerts(stationId, unreadOnly, limit);
    }

    @PatchMapping("/{alertId}/read")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT','ATTENDANT') or hasAuthority('SCOPE_notifications:write')")
    public AlertNotificationEntity markRead(@PathVariable String alertId) {
        return service.markRead(alertId);
    }

    @PostMapping("/read-all")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER','ACCOUNTANT','ATTENDANT') or hasAuthority('SCOPE_notifications:write')")
    public Map<String, Object> markAllRead() {
        return service.markAllRead();
    }
}
