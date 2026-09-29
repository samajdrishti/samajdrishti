package in.gov.samajdrishti.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * A submitted inspection report, stored rather than recomputed.
 *
 * <p>Previously the report was assembled on every read from the inspection, its evidence,
 * the attendance punches and the audit trail. That was fine for a demo and wrong for a
 * record: a report that a supervisor signed off on could change under them the next time
 * evidence was uploaded, and there was no way to ask "what was the conclusion on 12 March".
 *
 * <p>Submitting freezes {@code summary} and {@code findings} as they stood. Later evidence
 * uploads change the underlying data but not the filed report - which is the point of an
 * audit record.
 */
@Entity
@Table(name = "inspection_reports", indexes = {
        @Index(name = "idx_reports_inspection", columnList = "inspection_id"),
        @Index(name = "idx_reports_status", columnList = "report_status"),
        @Index(name = "idx_reports_submitted_by", columnList = "submitted_by")
})
public class InspectionReport {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "inspection_id")
    private Integer inspectionId;

    @Column(name = "project_id")
    private Integer projectId;

    @Column(name = "officer_id")
    private Integer officerId;

    @Column(name = "summary", columnDefinition = "text")
    private String summary;

    /** JSON array of the individual findings/flags raised at submission time. */
    @Column(name = "findings", columnDefinition = "text")
    private String findings;

    /** {@code low}, {@code medium} or {@code high} - derived from the findings at submit time. */
    @Column(name = "risk_level", length = 20)
    private String riskLevel;

    /** {@code draft}, {@code submitted}, {@code under_review}, {@code approved}, {@code rejected}. */
    @Column(name = "report_status", length = 30)
    private String reportStatus = "draft";

    @Column(name = "submitted_by")
    private Integer submittedBy;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    @Column(name = "reviewed_by")
    private Integer reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "review_remarks", columnDefinition = "text")
    private String reviewRemarks;

    /** Snapshot of the geo verdict as it stood at submission, so the record cannot be edited after the fact. */
    @Column(name = "geo_verdict", length = 30)
    private String geoVerdict;

    @Column(name = "distance_meters")
    private Double distanceMeters;

    @Column(name = "compliance_score")
    private Integer complianceScore;

    @Column(name = "evidence_count")
    private Integer evidenceCount;

    @Column(name = "anomaly_count")
    private Integer anomalyCount;

    @Embedded
    private GeoPoint geoCoords;

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

    public Integer getOfficerId() {
        return officerId;
    }

    public void setOfficerId(Integer officerId) {
        this.officerId = officerId;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getFindings() {
        return findings;
    }

    public void setFindings(String findings) {
        this.findings = findings;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public String getReportStatus() {
        return reportStatus;
    }

    public void setReportStatus(String reportStatus) {
        this.reportStatus = reportStatus;
    }

    public Integer getSubmittedBy() {
        return submittedBy;
    }

    public void setSubmittedBy(Integer submittedBy) {
        this.submittedBy = submittedBy;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public void setSubmittedAt(Instant submittedAt) {
        this.submittedAt = submittedAt;
    }

    public Integer getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(Integer reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public Instant getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(Instant reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getReviewRemarks() {
        return reviewRemarks;
    }

    public void setReviewRemarks(String reviewRemarks) {
        this.reviewRemarks = reviewRemarks;
    }

    public String getGeoVerdict() {
        return geoVerdict;
    }

    public void setGeoVerdict(String geoVerdict) {
        this.geoVerdict = geoVerdict;
    }

    public Double getDistanceMeters() {
        return distanceMeters;
    }

    public void setDistanceMeters(Double distanceMeters) {
        this.distanceMeters = distanceMeters;
    }

    public Integer getComplianceScore() {
        return complianceScore;
    }

    public void setComplianceScore(Integer complianceScore) {
        this.complianceScore = complianceScore;
    }

    public Integer getEvidenceCount() {
        return evidenceCount;
    }

    public void setEvidenceCount(Integer evidenceCount) {
        this.evidenceCount = evidenceCount;
    }

    public Integer getAnomalyCount() {
        return anomalyCount;
    }

    public void setAnomalyCount(Integer anomalyCount) {
        this.anomalyCount = anomalyCount;
    }

    public GeoPoint getGeoCoords() {
        return geoCoords;
    }

    public void setGeoCoords(GeoPoint geoCoords) {
        this.geoCoords = geoCoords;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
