package in.gov.samajdrishti.domain;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/** Beneficiary feedback captured through the social-audit channel. */
@Entity
@Table(name = "beneficiary_feedback", indexes = @Index(name = "idx_feedback_project", columnList = "project_id"))
public class BeneficiaryFeedback {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "project_id")
    private Integer projectId;

    @Column(name = "project_name", length = 200)
    private String projectName;

    @Column(name = "beneficiary_name", length = 160)
    private String beneficiaryName;

    @Column(name = "scheme", length = 40)
    private String scheme;

    @Column(name = "category", length = 120)
    private String category;

    @Column(name = "rating")
    private Integer rating;

    @Column(name = "comment", columnDefinition = "text")
    private String comment;

    /** Derived from {@code rating}: {@code positive}, {@code neutral} or {@code critical}. */
    @Column(name = "sentiment", length = 20)
    private String sentiment;

    @Column(name = "verified_resident", nullable = false)
    private boolean verifiedResident = true;

    @Column(name = "voice_memo_recorded", nullable = false)
    private boolean voiceMemoRecorded;

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

    public String getProjectName() {
        return projectName;
    }

    public void setProjectName(String projectName) {
        this.projectName = projectName;
    }

    public String getBeneficiaryName() {
        return beneficiaryName;
    }

    public void setBeneficiaryName(String beneficiaryName) {
        this.beneficiaryName = beneficiaryName;
    }

    public String getScheme() {
        return scheme;
    }

    public void setScheme(String scheme) {
        this.scheme = scheme;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Integer getRating() {
        return rating;
    }

    public void setRating(Integer rating) {
        this.rating = rating;
    }

    public String getComment() {
        return comment;
    }

    public void setComment(String comment) {
        this.comment = comment;
    }

    public String getSentiment() {
        return sentiment;
    }

    public void setSentiment(String sentiment) {
        this.sentiment = sentiment;
    }

    public boolean isVerifiedResident() {
        return verifiedResident;
    }

    public void setVerifiedResident(boolean verifiedResident) {
        this.verifiedResident = verifiedResident;
    }

    public boolean isVoiceMemoRecorded() {
        return voiceMemoRecorded;
    }

    public void setVoiceMemoRecorded(boolean voiceMemoRecorded) {
        this.voiceMemoRecorded = voiceMemoRecorded;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
