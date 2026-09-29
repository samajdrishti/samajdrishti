package in.gov.samajdrishti.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/** One inspection of one project, assigned to one field official. */
@Entity
@Table(name = "inspections", indexes = {
        @Index(name = "idx_inspections_assigned", columnList = "assigned_to"),
        @Index(name = "idx_inspections_project", columnList = "project_id"),
        @Index(name = "idx_inspections_status", columnList = "status")
})
public class Inspection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "project_id")
    private Integer projectId;

    /**
     * The institution being inspected.
     *
     * <p>Distinct from {@link #projectId}: the project is the funded work, the institution
     * is the monitored site. They are usually the same pair, so {@code institutionId} is
     * resolved from the project's institution on read - it is stored here because an
     * inspection must remain pointable at the site it visited even if the funding record
     * is later re-pointed.
     */
    @Column(name = "institution_id")
    private Integer institutionId;

    @Column(name = "assignment_id")
    private Integer assignmentId;

    /** Human-facing reference, e.g. {@code INS-10482}. Generated when absent. */
    @Column(name = "inspection_code", length = 24)
    private String inspectionCode;

    @Column(name = "assigned_to")
    private Integer assignedTo;

    @Column(name = "supervisor_id")
    private Integer supervisorId;

    /** {@code pending}, {@code in_progress}, {@code completed} or {@code flagged}. */
    @Column(name = "status", length = 20)
    private String status = "pending";

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @Column(name = "completed_date")
    private LocalDate completedDate;

    @Column(name = "ai_risk_score", precision = 5, scale = 2)
    private BigDecimal aiRiskScore;

    /**
     * Set once the geofence has passed. Written by the location service, read by the
     * state machine: {@code IN_PROGRESS} is not reachable from {@code ACCEPTED} without
     * it, so this is what makes "the officer really was on site" a stored fact rather
     * than a log line.
     */
    @Column(name = "gps_verified", nullable = false)
    private boolean gpsVerified;

    @Column(name = "gps_verified_at")
    private Instant gpsVerifiedAt;

    @Column(name = "gps_distance_meters")
    private Double gpsDistanceMeters;

    @Column(name = "gps_verdict", length = 30)
    private String gpsVerdict;

    /** {@code none}, {@code requested}, {@code active} or {@code ended} - the VC join state. */
    @Column(name = "vc_status", length = 20)
    private String vcStatus = "none";

    @Column(name = "start_time")
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    /** {@code routine}, {@code surprise} or {@code risk_targeted}. */
    @Column(name = "inspection_type", length = 30)
    private String inspectionType = "routine";

    @Column(name = "notes", columnDefinition = "text")
    private String notes;

    @Column(name = "created_at")
    private Instant createdAt;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getProjectId() {
        return projectId;
    }

    public void setProjectId(Integer projectId) {
        this.projectId = projectId;
    }

    public Integer getInstitutionId() {
        return institutionId;
    }

    public void setInstitutionId(Integer institutionId) {
        this.institutionId = institutionId;
    }

    public Integer getAssignmentId() {
        return assignmentId;
    }

    public void setAssignmentId(Integer assignmentId) {
        this.assignmentId = assignmentId;
    }

    public String getInspectionCode() {
        return inspectionCode;
    }

    public void setInspectionCode(String inspectionCode) {
        this.inspectionCode = inspectionCode;
    }

    public Integer getAssignedTo() {
        return assignedTo;
    }

    public void setAssignedTo(Integer assignedTo) {
        this.assignedTo = assignedTo;
    }

    public Integer getSupervisorId() {
        return supervisorId;
    }

    public void setSupervisorId(Integer supervisorId) {
        this.supervisorId = supervisorId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public LocalDate getScheduledDate() {
        return scheduledDate;
    }

    public void setScheduledDate(LocalDate scheduledDate) {
        this.scheduledDate = scheduledDate;
    }

    public LocalDate getCompletedDate() {
        return completedDate;
    }

    public void setCompletedDate(LocalDate completedDate) {
        this.completedDate = completedDate;
    }

    public BigDecimal getAiRiskScore() {
        return aiRiskScore;
    }

    public void setAiRiskScore(BigDecimal aiRiskScore) {
        this.aiRiskScore = aiRiskScore;
    }

    public boolean isGpsVerified() {
        return gpsVerified;
    }

    public void setGpsVerified(boolean gpsVerified) {
        this.gpsVerified = gpsVerified;
    }

    public Instant getGpsVerifiedAt() {
        return gpsVerifiedAt;
    }

    public void setGpsVerifiedAt(Instant gpsVerifiedAt) {
        this.gpsVerifiedAt = gpsVerifiedAt;
    }

    public Double getGpsDistanceMeters() {
        return gpsDistanceMeters;
    }

    public void setGpsDistanceMeters(Double gpsDistanceMeters) {
        this.gpsDistanceMeters = gpsDistanceMeters;
    }

    public String getGpsVerdict() {
        return gpsVerdict;
    }

    public void setGpsVerdict(String gpsVerdict) {
        this.gpsVerdict = gpsVerdict;
    }

    public String getVcStatus() {
        return vcStatus;
    }

    public void setVcStatus(String vcStatus) {
        this.vcStatus = vcStatus;
    }

    public Instant getStartTime() {
        return startTime;
    }

    public void setStartTime(Instant startTime) {
        this.startTime = startTime;
    }

    public Instant getEndTime() {
        return endTime;
    }

    public void setEndTime(Instant endTime) {
        this.endTime = endTime;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public String getInspectionType() {
        return inspectionType;
    }

    public void setInspectionType(String inspectionType) {
        this.inspectionType = inspectionType;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
