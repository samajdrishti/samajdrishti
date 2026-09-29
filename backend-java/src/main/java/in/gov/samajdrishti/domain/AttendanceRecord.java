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
 * Beneficiary headcount verification for one inspection.
 *
 * <p>Distinct from {@link Attendance}, which is the geo-fenced punch pair an official
 * records for their own site visit. This row is the *evidence* an officer files about the
 * institution: how many beneficiaries are on the roll, how many were marked present, and
 * how many the officer actually counted on the ground. The gap between the last two is the
 * single strongest signal of ghost beneficiaries in the whole system.
 *
 * <p>{@code attendancePercentage} is {@code observed / registered * 100}, computed once on
 * write so the dashboard never has to re-derive it and every row is auditable.
 */
@Entity
@Table(name = "attendance_records", indexes = {
        @Index(name = "idx_attendance_records_inspection", columnList = "inspection_id"),
        @Index(name = "idx_attendance_records_client", columnList = "client_id", unique = true)
})
public class AttendanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "inspection_id")
    private Integer inspectionId;

    @Column(name = "project_id")
    private Integer projectId;

    @Column(name = "recorded_by")
    private Integer recordedBy;

    /** Beneficiaries on the sanctioned roll for this institution. */
    @Column(name = "registered_count")
    private Integer registeredCount;

    /** Beneficiaries marked present by the institution's own register. */
    @Column(name = "reported_count")
    private Integer reportedCount;

    /** Beneficiaries the officer physically counted. */
    @Column(name = "observed_count")
    private Integer observedCount;

    /** {@code observed / registered * 100}, rounded to two decimals. */
    @Column(name = "attendance_percentage", precision = 5, scale = 2)
    private BigDecimal attendancePercentage;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Column(name = "verified_by")
    private Integer verifiedBy;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    /**
     * Client-generated UUID so a retried offline sync is idempotent rather than a second
     * row. Unique when present; null for rows created without one.
     */
    @Column(name = "client_id", length = 64)
    private String clientId;

    @Column(name = "captured_at")
    private Instant capturedAt;

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

    public Integer getRecordedBy() {
        return recordedBy;
    }

    public void setRecordedBy(Integer recordedBy) {
        this.recordedBy = recordedBy;
    }

    public Integer getRegisteredCount() {
        return registeredCount;
    }

    public void setRegisteredCount(Integer registeredCount) {
        this.registeredCount = registeredCount;
    }

    public Integer getReportedCount() {
        return reportedCount;
    }

    public void setReportedCount(Integer reportedCount) {
        this.reportedCount = reportedCount;
    }

    public Integer getObservedCount() {
        return observedCount;
    }

    public void setObservedCount(Integer observedCount) {
        this.observedCount = observedCount;
    }

    public BigDecimal getAttendancePercentage() {
        return attendancePercentage;
    }

    public void setAttendancePercentage(BigDecimal attendancePercentage) {
        this.attendancePercentage = attendancePercentage;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
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

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public Instant getCapturedAt() {
        return capturedAt;
    }

    public void setCapturedAt(Instant capturedAt) {
        this.capturedAt = capturedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
