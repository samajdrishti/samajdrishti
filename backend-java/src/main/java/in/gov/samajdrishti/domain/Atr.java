package in.gov.samajdrishti.domain;

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
 * Action Taken Report - the DoSJE deficiency workflow:
 * monitor -> record deficiency -> issue deadline -> NGO replies with proof ->
 * PMU adjudication -> escalate or close.
 */
@Entity
@Table(name = "atrs", indexes = @Index(name = "idx_atrs_project", columnList = "project_id"))
public class Atr {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "project_id")
    private Integer projectId;

    @Column(name = "project_name", length = 200)
    private String projectName;

    @Column(name = "inspection_id")
    private Integer inspectionId;

    @Column(name = "scheme", length = 40)
    private String scheme;

    @Column(name = "deficiency_title", length = 300)
    private String deficiencyTitle;

    @Column(name = "deficiency_details", columnDefinition = "text")
    private String deficiencyDetails;

    @Column(name = "deadline")
    private LocalDate deadline;

    /** {@code open}, {@code under_review}, {@code escalated}, {@code approved_closed}, {@code rejected_reinspection}. */
    @Column(name = "status", length = 40)
    private String status;

    @Column(name = "ngo_reply", columnDefinition = "text")
    private String ngoReply;

    @Column(name = "corrective_evidence_url", length = 500)
    private String correctiveEvidenceUrl;

    @Column(name = "pmu_adjudication", columnDefinition = "text")
    private String pmuAdjudication;

    @Column(name = "official_name", length = 120)
    private String officialName;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

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

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public Integer getInspectionId() {
        return inspectionId;
    }

    public void setInspectionId(Integer inspectionId) {
        this.inspectionId = inspectionId;
    }

    public String getScheme() {
        return scheme;
    }

    public void setScheme(String scheme) {
        this.scheme = scheme;
    }

    public String getDeficiencyTitle() {
        return deficiencyTitle;
    }

    public void setDeficiencyTitle(String deficiencyTitle) {
        this.deficiencyTitle = deficiencyTitle;
    }

    public String getDeficiencyDetails() {
        return deficiencyDetails;
    }

    public void setDeficiencyDetails(String deficiencyDetails) {
        this.deficiencyDetails = deficiencyDetails;
    }

    public LocalDate getDeadline() {
        return deadline;
    }

    public void setDeadline(LocalDate deadline) {
        this.deadline = deadline;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getNgoReply() {
        return ngoReply;
    }

    public void setNgoReply(String ngoReply) {
        this.ngoReply = ngoReply;
    }

    public String getCorrectiveEvidenceUrl() {
        return correctiveEvidenceUrl;
    }

    public void setCorrectiveEvidenceUrl(String correctiveEvidenceUrl) {
        this.correctiveEvidenceUrl = correctiveEvidenceUrl;
    }

    public String getPmuAdjudication() {
        return pmuAdjudication;
    }

    public void setPmuAdjudication(String pmuAdjudication) {
        this.pmuAdjudication = pmuAdjudication;
    }

    public String getOfficialName() {
        return officialName;
    }

    public void setOfficialName(String officialName) {
        this.officialName = officialName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
