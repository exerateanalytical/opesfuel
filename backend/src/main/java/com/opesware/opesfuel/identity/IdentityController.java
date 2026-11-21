package com.opesware.opesfuel.identity;

import com.opesware.opesfuel.shared.domain.DomainEnums;
import com.opesware.opesfuel.shared.domain.DomainEnums.EmployeeRole;
import com.opesware.opesfuel.shared.events.DomainEvent.StaffInvitedEvent;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import com.opesware.opesfuel.station.StationCatalogApi;
import com.opesware.opesfuel.workforce.WorkforceQueryApi;
import jakarta.persistence.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Entity
@Table(name = "user_invites")
class UserInviteEntity {
    private static final SecureRandom RANDOM = new SecureRandom();

    @Id
    private String id;
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;
    @Column(name = "station_id", nullable = false)
    private String stationId;
    @Column(name = "employee_id")
    private String employeeId;
    @Column(nullable = false)
    private String email;
    @Column(nullable = false)
    private String role;
    @Column(name = "invite_token", nullable = false, unique = true)
    private String inviteToken;
    @Column(nullable = false)
    private String status;
    @Column(name = "invited_by", nullable = false)
    private String invitedBy;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    @Column(name = "accepted_at")
    private Instant acceptedAt;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public static UserInviteEntity issue(String tenantId, String stationId, String employeeId, String email, String role, String invitedBy) {
        EmployeeRole validatedRole = DomainEnums.parse(EmployeeRole.class, role, "role");
        byte[] bytes = new byte[24];
        RANDOM.nextBytes(bytes);

        UserInviteEntity inv = new UserInviteEntity();
        inv.id = "inv_" + UUID.randomUUID();
        inv.tenantId = tenantId;
        inv.stationId = stationId;
        inv.employeeId = employeeId;
        inv.email = email.trim().toLowerCase();
        inv.role = validatedRole.name();
        inv.inviteToken = "opfinv_" + HexFormat.of().formatHex(bytes);
        inv.status = "PENDING";
        inv.invitedBy = invitedBy;
        inv.createdAt = Instant.now();
        inv.expiresAt = inv.createdAt.plus(7, ChronoUnit.DAYS);
        return inv;
    }

    public void accept() {
        if (!"PENDING".equals(this.status)) {
            throw new IllegalStateException("Invitation is no longer pending (status: " + this.status + ").");
        }
        if (Instant.now().isAfter(this.expiresAt)) {
            this.status = "EXPIRED";
            throw new IllegalStateException("Invitation token has expired.");
        }
        this.status = "ACCEPTED";
        this.acceptedAt = Instant.now();
    }

    public void revoke() {
        if ("ACCEPTED".equals(this.status)) {
            throw new IllegalStateException("Cannot revoke an already accepted invitation.");
        }
        this.status = "REVOKED";
    }

    public String getId() { return id; }
    public String getTenantId() { return tenantId; }
    public String getStationId() { return stationId; }
    public String getEmployeeId() { return employeeId; }
    public String getEmail() { return email; }
    public String getRole() { return role; }
    public String getInviteToken() { return inviteToken; }
    public String getStatus() { return status; }
    public String getInvitedBy() { return invitedBy; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getAcceptedAt() { return acceptedAt; }
    public Instant getCreatedAt() { return createdAt; }
}

interface UserInviteRepository extends JpaRepository<UserInviteEntity, String> {
    List<UserInviteEntity> findByTenantIdOrderByCreatedAtDesc(String tenantId);
    Optional<UserInviteEntity> findByInviteToken(String inviteToken);
}

@Service
class IdentityService {
    private final UserInviteRepository inviteRepo;
    private final TenantAccessGuard accessGuard;
    private final StationCatalogApi stationCatalogApi;
    private final WorkforceQueryApi workforceQueryApi;
    private final ApplicationEventPublisher eventPublisher;

    IdentityService(
        UserInviteRepository inviteRepo,
        TenantAccessGuard accessGuard,
        StationCatalogApi stationCatalogApi,
        WorkforceQueryApi workforceQueryApi,
        ApplicationEventPublisher eventPublisher
    ) {
        this.inviteRepo = inviteRepo;
        this.accessGuard = accessGuard;
        this.stationCatalogApi = stationCatalogApi;
        this.workforceQueryApi = workforceQueryApi;
        this.eventPublisher = eventPublisher;
    }

    @Transactional(readOnly = true)
    public AuthenticatedProfileDto getMyProfile() {
        OpesFuelPrincipal p = accessGuard.currentPrincipal();
        WorkforceQueryApi.EmployeeSnapshot emp = workforceQueryApi.findByAuth0Sub(p.auth0Sub()).orElse(null);
        List<StationCatalogApi.StationSnapshot> stations = stationCatalogApi.listAccessibleStationSnapshots();
        return new AuthenticatedProfileDto(
            p.principalId(), p.tenantId(), p.auth0Sub(), p.roles(), p.scopes(),
            p.allowedStationIds(), p.apiKeyAuth(), emp, stations.size()
        );
    }

    @Transactional(readOnly = true)
    public List<UserInviteEntity> listInvites() {
        return inviteRepo.findByTenantIdOrderByCreatedAtDesc(accessGuard.currentTenantId());
    }

    @Transactional
    public UserInviteEntity createInvite(CreateUserInviteCommand cmd) {
        StationCatalogApi.StationSnapshot station = stationCatalogApi.requireAccessibleStation(cmd.stationId());
        if (cmd.employeeId() != null && !cmd.employeeId().isBlank()) {
            WorkforceQueryApi.EmployeeSnapshot emp = workforceQueryApi.findEmployee(cmd.employeeId())
                .orElseThrow(() -> new IllegalArgumentException("Employee not found: " + cmd.employeeId()));
            if (!emp.stationId().equals(station.id())) {
                throw new IllegalArgumentException("Employee does not belong to station " + station.id());
            }
        }
        UserInviteEntity saved = inviteRepo.save(UserInviteEntity.issue(
            station.tenantId(), station.id(), cmd.employeeId(), cmd.email(), cmd.role(),
            accessGuard.currentPrincipal().principalId()
        ));
        eventPublisher.publishEvent(new StaffInvitedEvent(
            UUID.randomUUID().toString(), saved.getId(), station.tenantId(), station.id(),
            saved.getEmail(), saved.getRole(), saved.getCreatedAt()
        ));
        return saved;
    }

    @Transactional
    public UserInviteEntity acceptInvite(String token) {
        UserInviteEntity invite = inviteRepo.findByInviteToken(token)
            .orElseThrow(() -> new IllegalArgumentException("Invalid invitation token."));
        OpesFuelPrincipal caller = accessGuard.currentPrincipal();
        invite.accept();
        UserInviteEntity saved = inviteRepo.save(invite);
        if (saved.getEmployeeId() != null && caller.auth0Sub() != null && !caller.auth0Sub().isBlank()) {
            workforceQueryApi.linkAuth0Sub(saved.getEmployeeId(), caller.auth0Sub());
        }
        return saved;
    }

    @Transactional
    public void revokeInvite(String inviteId) {
        UserInviteEntity invite = inviteRepo.findById(inviteId)
            .orElseThrow(() -> new IllegalArgumentException("Invitation not found: " + inviteId));
        accessGuard.assertTenantMatch(invite.getTenantId());
        invite.revoke();
        inviteRepo.save(invite);
    }
}

record AuthenticatedProfileDto(
    String principalId,
    String tenantId,
    String auth0Sub,
    Set<String> roles,
    Set<String> scopes,
    Set<String> allowedStationIds,
    boolean apiKeyAuth,
    WorkforceQueryApi.EmployeeSnapshot linkedEmployee,
    int accessibleStationsCount
) {}

record CreateUserInviteCommand(
    @NotBlank String stationId,
    String employeeId,
    @Email @NotBlank String email,
    @NotBlank String role
) {}

@RestController
@RequestMapping("/api/v1/identity")
public class IdentityController {
    private final IdentityService service;

    public IdentityController(IdentityService service) {
        this.service = service;
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public AuthenticatedProfileDto me() {
        return service.getMyProfile();
    }

    @GetMapping("/invites")
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public List<UserInviteEntity> listInvites() {
        return service.listInvites();
    }

    @PostMapping("/invites")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public UserInviteEntity createInvite(@Valid @RequestBody CreateUserInviteCommand cmd) {
        return service.createInvite(cmd);
    }

    @PostMapping("/invites/{token}/accept")
    @PreAuthorize("isAuthenticated()")
    public UserInviteEntity acceptInvite(@PathVariable String token) {
        return service.acceptInvite(token);
    }

    @DeleteMapping("/invites/{inviteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('OWNER','MANAGER')")
    public void revokeInvite(@PathVariable String inviteId) {
        service.revokeInvite(inviteId);
    }
}
