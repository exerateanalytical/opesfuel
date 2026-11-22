package com.opesware.opesfuel.billing.momo;

import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

record InitiateMomoPaymentCommand(
    String provider,
    @NotBlank String phoneNumber,
    @Min(100) long amountFcfa,
    String targetType,
    @NotBlank String targetId,
    String description
) {}

@RestController
public class MomoPaymentController {

    private final MomoGatewayService momoService;
    private final TenantAccessGuard accessGuard;

    public MomoPaymentController(MomoGatewayService momoService, TenantAccessGuard accessGuard) {
        this.momoService = momoService;
        this.accessGuard = accessGuard;
    }

    @GetMapping("/api/v1/payments/momo/providers/status")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','FLEET_CLIENT')")
    public Map<String, Object> providersStatus() {
        return momoService.providerStatus();
    }

    @GetMapping("/api/v1/payments/momo/detect-operator")
    @PreAuthorize("isAuthenticated()")
    public Map<String, Object> detectOperator(@RequestParam String phone) {
        String normalized = CameroonMsisdn.normalize(phone);
        CameroonMsisdn.Operator op = CameroonMsisdn.detect(normalized);
        return Map.of(
            "msisdn", "+" + normalized,
            "local", CameroonMsisdn.local(normalized),
            "operator", op.name(),
            "provider", op == CameroonMsisdn.Operator.MTN ? "MTN_MOMO" : op == CameroonMsisdn.Operator.ORANGE ? "ORANGE_MONEY" : "UNKNOWN"
        );
    }

    @PostMapping("/api/v1/payments/momo/initiate")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT','FLEET_CLIENT')")
    public Map<String, Object> initiate(
        @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
        @Valid @RequestBody InitiateMomoPaymentCommand cmd
    ) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        return momoService.initiatePayment(
            principal.tenantId(),
            principal.subject(),
            cmd.targetType(),
            cmd.targetId(),
            cmd.amountFcfa(),
            cmd.phoneNumber(),
            cmd.provider(),
            cmd.description(),
            idempotencyKey
        );
    }

    @GetMapping("/api/v1/payments/momo/{txId}/status")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT','ATTENDANT','FLEET_CLIENT')")
    public Map<String, Object> status(@PathVariable String txId) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        return momoService.pollAndRefreshStatus(txId, principal.tenantId(), principal.hasRole("PLATFORM_ADMIN"));
    }

    @GetMapping("/api/v1/payments/momo")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','ACCOUNTANT','MANAGER')")
    public List<Map<String, Object>> list() {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        return momoService.listTransactions(principal.tenantId(), principal.hasRole("PLATFORM_ADMIN"));
    }

    @PostMapping("/api/v1/payments/momo/{txId}/refund")
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER')")
    public Map<String, Object> refund(@PathVariable String txId) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        return momoService.refundMtnTransaction(txId, principal.tenantId(), principal.subject());
    }

    @PostMapping("/api/v1/public/webhooks/momo/mtn")
    public Map<String, Object> mtnWebhook(@RequestBody Map<String, Object> payload) {
        return momoService.handleMtnCallback(payload);
    }

    @PostMapping("/api/v1/public/webhooks/momo/orange")
    public Map<String, Object> orangeWebhook(@RequestBody Map<String, Object> payload) {
        return momoService.handleOrangeCallback(payload);
    }
}
