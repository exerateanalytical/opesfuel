package com.opesware.opesfuel.accounting;

import com.opesware.opesfuel.shared.audit.AuditTrailRecorder;
import com.opesware.opesfuel.shared.security.OpesFuelPrincipal;
import com.opesware.opesfuel.shared.security.TenantAccessGuard;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

record RecordVaultEntryCommand(
    @NotBlank String stationId,
    @NotBlank String entryType,
    @Min(1) long amountFcfa,
    @NotBlank String handedBy,
    @NotBlank String receivedBy,
    String referenceCode,
    String notes
) {}

@RestController
@RequestMapping("/api/v1/accounting/vault")
public class CashVaultController {
    private static final Set<String> VALID_TYPES = Set.of(
        "SHIFT_DROP", "PETTY_CASH_OUT", "ARMORED_BANK_PICKUP", "MANAGER_HANDOVER"
    );

    private final JdbcTemplate jdbcTemplate;
    private final TenantAccessGuard accessGuard;
    private final AuditTrailRecorder auditRecorder;

    public CashVaultController(
        JdbcTemplate jdbcTemplate,
        TenantAccessGuard accessGuard,
        AuditTrailRecorder auditRecorder
    ) {
        this.jdbcTemplate = jdbcTemplate;
        this.accessGuard = accessGuard;
        this.auditRecorder = auditRecorder;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:read')")
    public Map<String, Object> getVaultSummary(@RequestParam(required = false) String stationId) {
        String tenantId = accessGuard.currentTenantId();
        boolean filterStation = stationId != null && !stationId.isBlank() && !"ALL".equalsIgnoreCase(stationId);
        String sql = filterStation
            ? "SELECT * FROM cash_vault_entries WHERE tenant_id = ? AND station_id = ? ORDER BY recorded_at DESC LIMIT 100"
            : "SELECT * FROM cash_vault_entries WHERE tenant_id = ? ORDER BY recorded_at DESC LIMIT 100";
        Object[] args = filterStation ? new Object[]{tenantId, stationId} : new Object[]{tenantId};

        List<Map<String, Object>> entries = jdbcTemplate.query(sql, (rs, idx) -> Map.<String, Object>ofEntries(
            Map.entry("id", rs.getString("id")),
            Map.entry("stationId", rs.getString("station_id")),
            Map.entry("entryType", rs.getString("entry_type")),
            Map.entry("amountFcfa", rs.getLong("amount_fcfa")),
            Map.entry("runningBalanceFcfa", rs.getLong("running_balance_fcfa")),
            Map.entry("referenceCode", rs.getString("reference_code")),
            Map.entry("handedBy", rs.getString("handed_by")),
            Map.entry("receivedBy", rs.getString("received_by")),
            Map.entry("notes", rs.getString("notes") != null ? rs.getString("notes") : ""),
            Map.entry("recordedAt", rs.getTimestamp("recorded_at").toInstant().toString())
        ), args);

        long currentSafeBalance = entries.isEmpty() ? 0L : ((Number) entries.get(0).get("runningBalanceFcfa")).longValue();
        return Map.of(
            "currentSafeBalanceFcfa", currentSafeBalance,
            "entryCount", entries.size(),
            "entries", entries
        );
    }

    @PostMapping("/entries")
    @Transactional
    @PreAuthorize("hasAnyRole('PLATFORM_ADMIN','OWNER','MANAGER','ACCOUNTANT') or hasAuthority('SCOPE_accounting:write')")
    public Map<String, Object> recordVaultEntry(@Valid @RequestBody RecordVaultEntryCommand cmd) {
        OpesFuelPrincipal principal = accessGuard.currentPrincipal();
        String type = cmd.entryType().trim().toUpperCase();
        if (!VALID_TYPES.contains(type)) {
            throw new IllegalArgumentException("Vault entry type must be SHIFT_DROP, PETTY_CASH_OUT, ARMORED_BANK_PICKUP, or MANAGER_HANDOVER.");
        }

        List<Long> latest = jdbcTemplate.query(
            "SELECT running_balance_fcfa FROM cash_vault_entries WHERE tenant_id = ? AND station_id = ? ORDER BY recorded_at DESC LIMIT 1",
            (rs, idx) -> rs.getLong("running_balance_fcfa"),
            principal.tenantId(), cmd.stationId()
        );
        long prevBalance = latest.isEmpty() ? 0L : latest.get(0);

        long nextBalance = switch (type) {
            case "SHIFT_DROP" -> prevBalance + cmd.amountFcfa();
            case "PETTY_CASH_OUT", "ARMORED_BANK_PICKUP" -> {
                if (cmd.amountFcfa() > prevBalance) {
                    throw new IllegalStateException(
                        "Insufficient cash in station safe (" + prevBalance + " FCFA available; requested " + cmd.amountFcfa() + " FCFA)."
                    );
                }
                yield prevBalance - cmd.amountFcfa();
            }
            default -> prevBalance; // MANAGER_HANDOVER verifies custody without altering physical cash total
        };

        String id = "vlt_" + UUID.randomUUID().toString().substring(0, 10);
        String ref = (cmd.referenceCode() != null && !cmd.referenceCode().isBlank())
            ? cmd.referenceCode().trim()
            : "SAFE-" + UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        jdbcTemplate.update(
            """
            INSERT INTO cash_vault_entries (
                id, tenant_id, station_id, entry_type, amount_fcfa, running_balance_fcfa,
                reference_code, handed_by, received_by, notes, recorded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            id, principal.tenantId(), cmd.stationId(), type, cmd.amountFcfa(), nextBalance,
            ref, cmd.handedBy(), cmd.receivedBy(), cmd.notes(), Timestamp.from(Instant.now())
        );

        auditRecorder.record(
            principal.tenantId(), cmd.stationId(), principal.subject(),
            principal.roles().stream().findFirst().orElse("MANAGER"),
            "CASH_VAULT_" + type, "CASH_VAULT", id,
            type + " of " + cmd.amountFcfa() + " FCFA (" + cmd.handedBy() + " -> " + cmd.receivedBy() + "); safe balance " + nextBalance + " FCFA"
        );

        return Map.of(
            "id", id,
            "entryType", type,
            "amountFcfa", cmd.amountFcfa(),
            "runningBalanceFcfa", nextBalance,
            "referenceCode", ref
        );
    }
}
