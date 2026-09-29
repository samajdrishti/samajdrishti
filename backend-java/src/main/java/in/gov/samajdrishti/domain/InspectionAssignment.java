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

/**
 * One row of the assignment ledger: who was told to inspect what, and how it went.
 *
 * <p>The LLD keeps assignment history separate from the inspection so an officer can
 * accept or decline, and so a re-assignment is recorded rather than overwritten. Without
 * this table {@code inspections.assigned_to} is a bare integer: a supervisor correcting a
 * mistake leaves no trace of who originally had the duty.
 *
 * <p>{@code status} moves {@code assigned -> accepted -> started -> completed}, with
 * {@code declined} and {@code reassigned} as the exits. {@code clientId} makes an offline
 * assignment acknowledgement idempotent.
 */
@Entity
@Table(name = "inspection_assignments", indexes = {
        @Index(name = "idx_assignments_inspection", columnList = "inspection_id"),
        @Index(name = "idx_assignments_officer", columnList = "officer_id"),
        @Index(name = "idx_assignments_status", columnList = "status"),
        @Index(name = "idx_assignments_client", columnList = "client_id", unique = true)
})
public class InspectionAssignment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "inspection_id")
    private Integer inspectionId;

    @Column(name = "officer_id")
    private Integer officerId;

    @Column(name = "project_id")
    private Integer projectId;

    /** {@code random}, {@code manual}, {@code ai_weighted} or {@code reassigned}. */
    @Column(name = "assignment_type", length = 20)
    private String assignmentType = "random";

    @Column(name = "assigned_at")
    private Instant assignedAt;

    @Column(name = "accepted_at")
    private Instant acceptedAt;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    /** {@code low}, {@code normal}, {@code high} - drives the ordering of the officer's list. */
    @Column(name = "priority", length = 20)
    private String priority = "normal";

    /** {@code assigned}, {@code accepted}, {@code started}, {@code completed}, {@code declined}, {@code reassigned}. */
    @Column(name = "status", length = 20)
    private String status = "assigned";

    @Column(name = "scheduled_date")
    private LocalDate scheduledDate;

    @Column(name = "declined_reason", columnDefinition = "text")
    private String declinedReason;

    /** Set when this row was superseded, pointing at the assignment that replaced it. */
    @Column(name = "superseded_by")
    private Integer supersededBy;

    /** Snapshot of the AI risk score at the moment of assignment. */
    @Column(name = "ai_risk_score", precision = 5, scale = 2)
    private BigDecimal aiRiskScore;

    @Column(name = "client_id", length = 64)
    private String clientId;

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

    public Integer getOfficerId() {
        return officerId;
    }

    public void setOfficerId(Integer officerId) {
        this.officerId = officerId;
    }

    public Integer getProjectId() {
        return projectId;
    }

    public void setProjectId(Integer projectId) {
        this.projectId = projectId;
    }

    public String getAssignmentType() {
        return assignmentType;
    }

    public void setAssignmentType(String assignmentType) {
        this.assignmentType = assignmentType;
    }

    public Instant getAssignedAt() {
        return assignedAt;
    }

    public void setAssignedAt(Instant assignedAt) {
        this.assignedAt = assignedAt;
    }

    public Instant getAcceptedAt() {
        return acceptedAt;
    }

    public void setAcceptedAt(Instant acceptedAt) {
        this.acceptedAt = acceptedAt;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public void setStartedAt(Instant startedAt) {
        this.startedAt = startedAt;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }

    public void setCompletedAt(Instant completedAt) {
        this.completedAt = completedAt;
    }

    public String getPriority() {
        return priority;
    }

    public void setPriority(String priority) {
        this.priority = priority;
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

    public String getDeclinedReason() {
        return declinedReason;
    }

    public void setDeclinedReason(String declinedReason) {
        this.declinedReason = declinedReason;
    }

    public Integer getSupersededBy() {
        return supersededBy;
    }

    public void setSupersededBy(Integer supersededBy) {
        this.supersededBy = supersededBy;
    }

    public BigDecimal getAiRiskScore() {
        return aiRiskScore;
    }

    public void setAiRiskScore(BigDecimal aiRiskScore) {
        this.aiRiskScore = aiRiskScore;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
