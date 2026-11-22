package com.opesware.opesfuel.notifications;

import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

record SendOutboundMessageCommand(
    @NotBlank String channel,
    @NotBlank String recipient,
    @NotBlank String subject,
    @NotBlank String body,
    String templateType
) {}

@RestController
@RequestMapping("/api/v1/notifications/outbound")
public class OutboundMessagingController {

    private final OutboundMessagingService messagingService;
    private final TenantAccessGuard accessGuard;

    public OutboundMessagingController(
        OutboundMessagingService messagingService,
        TenantAccessGuard accessGuard
    ) {
        this.messagingService = messagingService;
        this.accessGuard = accessGuard;
    }

    @GetMapping("/providers")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> providers() {
        return messagingService.providerStatus();
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public List<Map<String, Object>> listOutbound() {
        return messagingService.listDeliveries(accessGuard.currentTenantId());
    }

    @PostMapping("/send")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT')")
    public Map<String, Object> send(@Valid @RequestBody SendOutboundMessageCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        return messagingService.dispatch(
            principal.tenantId(),
            principal.subject(),
            cmd.channel(),
            cmd.recipient(),
            cmd.subject(),
            cmd.body(),
            cmd.templateType() != null ? cmd.templateType() : "MANUAL"
        );
    }
}
