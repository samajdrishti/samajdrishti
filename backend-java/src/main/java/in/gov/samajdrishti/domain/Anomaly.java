package in.gov.samajdrishti.domain;

import java.math.BigDecimal;
import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * A finding raised against one inspection, by the AI engine or by a deterministic rule.
 *
 * <p>The LLD treats AI as an assistance layer, not the final authority, so every row
 * starts life as {@code open} with {@code humanVerified = false} and only a person can
 * close it out. Nothing here is authoritative on its own: {@link #confidence} records
 * how sure the detector was, {@link #source} records which detector, and the audit trail
 * records who signed off.
 */
@Entity
@Table(name = "anomalies", indexes = {
        @Index(name = "idx_anomalies_inspection", columnList = "inspection_id"),
        @Index(name = "idx_anomalies_status", columnList = "status"),
        @Index(name = "idx_anomalies_severity", columnList = "severity")
})
public class Anomaly {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "inspection_id")
    private Integer inspectionId;

    @Column(name = "project_id")
    private Integer projectId;

    /**
     * {@code ATTENDANCE_MISMATCH}, {@code CCTV_UNAVAILABLE}, {@code DUPLICATE_EVIDENCE},
     * {@code MISSING_DOCUMENT}, {@code UNUSUAL_REPORTING_PATTERN},
     * {@code INSPECTION_DEVIATION}, {@code GEO_MISMATCH}, {@code LOW_COMPLIANCE}.
     */
    @Column(name = "anomaly_type", length = 60)
    private String type;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    /** How sure the detector was, 0..1. Null when the finding came from a hard rule. */
    @Column(name = "confidence", precision = 4, scale = 3)
    private BigDecimal confidence;

    /** {@code low}, {@code medium} or {@code high}. */
    @Column(name = "severity", length = 20)
    private String severity;

    @Column(name = "evidence_id")
    private Integer evidenceId;

    /** {@code open}, {@code acknowledged}, {@code confirmed}, {@code dismissed}. */
    @Column(name = "status", length = 20)
    private String status = "open";

    /**
     * Whether a human has signed off on this finding. False by default and only ever set
     * through the verify endpoint - this is the flag the LLD's human-in-the-loop
     * requirement depends on.
     */
    @Column(name = "human_verified", nullable = false)
    private boolean humanVerified;

    @Column(name = "verified_by")
    private Integer verifiedBy;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "verified_remarks", columnDefinition = "text")
    private String verifiedRemarks;

    /** {@code ai} when the Python engine produced it, {@code rule} for a local check. */
    @Column(name = "source", length = 20)
    private String source = "ai";

    /** The detector name, e.g. {@code isolation_forest} or {@code attendance_discrepancy}. */
    @Column(name = "detector", length = 60)
    private String detector;

    /** {@code true} when confidence is high enough that a person should look at it. */
    @Column(name = "requires_human_review", nullable = false)
    private boolean requiresHumanReview = true;

    @Column(name = "created_at")
    private Instant createdAt;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getInspectionId() {
        return inspectionId;
    }

    public void setInspectionId(Integer inspectionId) {
        this.inspectionId = inspectionId;
    }

    public Integer getProjectId() {
        return projectId;
    }

    public void setProjectId(Integer projectId) {
        this.projectId = projectId;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getConfidence() {
        return confidence;
    }

    public void setConfidence(BigDecimal confidence) {
        this.confidence = confidence;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public Integer getEvidenceId() {
        return evidenceId;
    }

    public void setEvidenceId(Integer evidenceId) {
        this.evidenceId = evidenceId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isHumanVerified() {
        return humanVerified;
    }

    public void setHumanVerified(boolean humanVerified) {
        this.humanVerified = humanVerified;
    }

    public Integer getVerifiedBy() {
        return verifiedBy;
    }

    public void setVerifiedBy(Integer verifiedBy) {
        this.verifiedBy = verifiedBy;
    }

    public Instant getVerifiedAt() {
        return verifiedAt;
    }

    public void setVerifiedAt(Instant verifiedAt) {
        this.verifiedAt = verifiedAt;
    }

    public String getVerifiedRemarks() {
        return verifiedRemarks;
    }

    public void setVerifiedRemarks(String verifiedRemarks) {
        this.verifiedRemarks = verifiedRemarks;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getDetector() {
        return detector;
    }

    public void setDetector(String detector) {
        this.detector = detector;
    }

    public boolean isRequiresHumanReview() {
        return requiresHumanReview;
    }

    public void setRequiresHumanReview(boolean requiresHumanReview) {
        this.requiresHumanReview = requiresHumanReview;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
