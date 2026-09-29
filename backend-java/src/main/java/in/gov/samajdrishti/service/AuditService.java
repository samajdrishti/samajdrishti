package in.gov.samajdrishti.service;

import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;

import in.gov.samajdrishti.domain.AuditEntry;
import in.gov.samajdrishti.repository.AuditRepository;
import in.gov.samajdrishti.security.AuthPrincipal;

/**
 * Append-only accountability trail.
 *
 * <p>Every state change that matters for accountability - assignments, status changes,
 * geo failures, evidence verification, VC joins - lands here.
 *
 * <p>Recording runs in its own transaction ({@code REQUIRES_NEW}) and swallows its own
 * errors: an audit write must never roll back, or break, the request that caused it.
 */
@Service
public class AuditService {

    private static final Logger log = LoggerFactory.getLogger(AuditService.class);
    private static final int MAX_LIMIT = 500;
    private static final int DEFAULT_LIMIT = 100;

    private final AuditRepository audit;

    public AuditService(AuditRepository audit) {
        this.audit = audit;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AuditEntry record(AuthPrincipal actor, String action, String entity, Integer entityId, Object meta) {
        try {
            AuditEntry entry = new AuditEntry();
            entry.setActorId(actor == null ? null : actor.id());
            entry.setActorName(actor == null || actor.name() == null ? "system" : actor.name());
            entry.setAction(action);
            entry.setEntity(entity);
            entry.setEntityId(entityId);
            entry.setMeta(meta);
            entry.setIpAddress(currentRequestIp());
            return audit.save(entry);
        } catch (RuntimeException e) {
            log.warn("[audit] could not record event {} - {}", action, e.getMessage());
            return null;
        }
    }

    /**
     * Records a change with the before and after states spelled out.
     *
     * <p>Most call sites already pass both states inside {@code meta}, but as an unlabelled
     * payload. This variant puts them in their own columns, so "show me what this row looked
     * like before it was touched" becomes a query rather than a read of every meta blob.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AuditEntry recordChange(AuthPrincipal actor, String action, String entity, Integer entityId,
                                   Object oldValue, Object newValue) {
        try {
            AuditEntry entry = new AuditEntry();
            entry.setActorId(actor == null ? null : actor.id());
            entry.setActorName(actor == null || actor.name() == null ? "system" : actor.name());
            entry.setAction(action);
            entry.setEntity(entity);
            entry.setEntityId(entityId);
            entry.setMeta(Map.of(
                    "old_value", describe(oldValue),
                    "new_value", describe(newValue)));
            entry.setOldValue(encode(oldValue));
            entry.setNewValue(encode(newValue));
            entry.setIpAddress(currentRequestIp());
            return audit.save(entry);
        } catch (RuntimeException e) {
            log.warn("[audit] could not record change {} - {}", action, e.getMessage());
            return null;
        }
    }

    /**
     * The client IP for the current request, or null outside a request (seeder, scheduler).
     *
     * <p>{@code X-Forwarded-For} is preferred when present because the service sits behind a
     * proxy in any real deployment; the first entry is the originating client. The header is
     * only trusted when it names a real address, since it is client-supplied otherwise.
     */
    private String currentRequestIp() {
        RequestAttributes attributes = RequestContextHolder.getRequestAttributes();
        if (!(attributes instanceof ServletRequestAttributes servlet)) {
            return null;
        }
        HttpServletRequest request = servlet.getRequest();
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            String first = forwarded.split(",")[0].strip();
            if (!first.isEmpty() && isAddressLike(first)) {
                return first;
            }
        }
        String remote = request.getRemoteAddr();
        return remote == null || remote.isBlank() ? null : remote;
    }

    private static boolean isAddressLike(String value) {
        if (value.length() > 45) {
            return false;
        }
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            boolean allowed = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
                    || c == '.' || c == ':' || c == '%' || c == '_';
            if (!allowed) {
                return false;
            }
        }
        return true;
    }

    private static String encode(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(value);
        } catch (Exception e) {
            return String.valueOf(value);
        }
    }

    private static String describe(Object value) {
        return value == null ? "" : String.valueOf(value);
    }

    /** Newest first, optionally narrowed to one entity or one entity instance. */
    @Transactional(readOnly = true)
    public List<AuditEntry> list(String entity, Integer entityId, Integer limit) {
        int safeLimit = clamp(limit);
        List<AuditEntry> rows;
        if (entity != null && !entity.isBlank() && entityId != null) {
            rows = audit.findByEntityAndEntityIdOrderByIdDesc(entity, entityId);
        } else if (entity != null && !entity.isBlank()) {
            rows = audit.findByEntityOrderByIdDesc(entity);
        } else {
            rows = audit.findAllByOrderByIdDesc();
        }
        return rows.size() <= safeLimit ? rows : rows.subList(0, safeLimit);
    }

    private static int clamp(Integer limit) {
        if (limit == null) {
            return DEFAULT_LIMIT;
        }
        return Math.min(Math.max(limit, 1), MAX_LIMIT);
    }
}
