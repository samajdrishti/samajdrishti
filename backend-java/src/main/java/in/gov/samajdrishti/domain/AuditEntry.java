package in.gov.samajdrishti.domain;

import java.time.Instant;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

/**
 * Append-only accountability trail.
 *
 * <p>{@code meta} is stored as the JSON text it is always written as, and handed to
 * clients as the parsed object - exactly what the audit and report screens expect.
 */
@Entity
@Table(name = "audit", indexes = {
        @Index(name = "idx_audit_entity", columnList = "entity,entity_id"),
        @Index(name = "idx_audit_action", columnList = "action_type")
})
public class AuditEntry {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "actor_id")
    private Integer actorId;

    @Column(name = "actor_name", length = 120)
    private String actorName;

    @Column(name = "action_type", nullable = false, length = 80)
    private String action;

    @Column(name = "entity", nullable = false, length = 60)
    private String entity;

    @Column(name = "entity_id")
    private Integer entityId;

    /**
     * Persisted as the JSON text it is always written as. Deliberately has no public
     * getter so Jackson does not expose it as {@code meta_raw}; the API view is
     * {@link #getMeta()}.
     */
    @Column(name = "meta", columnDefinition = "text")
    private String metaRaw;

    @Column(name = "created_at")
    private Instant createdAt;

    /** Parsed {@code meta} for API responses, falling back to the raw text. */
    @Transient
    public Object getMeta() {
        if (metaRaw == null || metaRaw.isBlank()) {
            return null;
        }
        try {
            return JSON.readValue(metaRaw, new TypeReference<Object>() {
            });
        } catch (Exception e) {
            return metaRaw;
        }
    }

    public void setMeta(Object value) {
        if (value == null) {
            this.metaRaw = null;
            return;
        }
        if (value instanceof String text) {
            this.metaRaw = text;
            return;
        }
        try {
            this.metaRaw = JSON.writeValueAsString(value);
        } catch (Exception e) {
            this.metaRaw = String.valueOf(value);
        }
    }

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getActorId() {
        return actorId;
    }

    public void setActorId(Integer actorId) {
        this.actorId = actorId;
    }

    public String getActorName() {
        return actorName;
    }

    public void setActorName(String actorName) {
        this.actorName = actorName;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getEntity() {
        return entity;
    }

    public void setEntity(String entity) {
        this.entity = entity;
    }

    public Integer getEntityId() {
        return entityId;
    }

    public void setEntityId(Integer entityId) {
        this.entityId = entityId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
