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

    /**
     * The client IP the action came from.
     *
     * <p>Absent before this column existed, which is why "who changed this" was answerable
     * but "from where" was not. For accountability in a system where credentials are
     * shared between officers it is the difference between an audit trail and a log.
     */
    @Column(name = "ip_address", length = 64)
    private String ipAddress;

    /**
     * The state before the change, as JSON.
     *
     * <p>{@link #meta} already carries this for most call sites, but as an unlabelled
     * blob. Splitting the two sides out means "what did this row look like before it was
     * changed" is answerable with a query rather than by reading every meta payload.
     */
    @Column(name = "old_value", columnDefinition = "text")
    private String oldValue;

    /** The state after the change, as JSON. */
    @Column(name = "new_value", columnDefinition = "text")
    private String newValue;

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

    public String getIpAddress() {
        return ipAddress;
    }

    public void setIpAddress(String ipAddress) {
        this.ipAddress = ipAddress;
    }

    public String getOldValue() {
        return oldValue;
    }

    public void setOldValue(String oldValue) {
        this.oldValue = oldValue;
    }

    public String getNewValue() {
        return newValue;
    }

    public void setNewValue(String newValue) {
        this.newValue = newValue;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
