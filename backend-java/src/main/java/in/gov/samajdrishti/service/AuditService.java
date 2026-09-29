package in.gov.samajdrishti.service;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

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
            return audit.save(entry);
        } catch (RuntimeException e) {
            log.warn("[audit] could not record event {} - {}", action, e.getMessage());
            return null;
        }
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
