package in.gov.samajdrishti.domain;

import java.time.Instant;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

/**
 * Scheme-specific regulatory checklist filed against an inspection.
 *
 * <p>{@code checks} is a {@code {itemId: boolean}} map held as JSON text; it has no
 * public getter so only the parsed {@link #getChecks()} view reaches clients.
 */
@Entity
@Table(name = "inspection_checklists")
public class InspectionChecklist {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "inspection_id", nullable = false, unique = true)
    private Integer inspectionId;

    @Column(name = "scheme", length = 40)
    private String scheme;

    @Column(name = "checks_json", columnDefinition = "text")
    private String checksJson;

    @Column(name = "compliance_score")
    private Integer complianceScore;

    @Column(name = "voice_remarks", columnDefinition = "text")
    private String voiceRemarks;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Transient
    public Map<String, Boolean> getChecks() {
        if (checksJson == null || checksJson.isBlank()) {
            return Map.of();
        }
        try {
            return JSON.readValue(checksJson, new TypeReference<Map<String, Boolean>>() {
            });
        } catch (Exception e) {
            return Map.of();
        }
    }

    public void setChecks(Map<String, Boolean> checks) {
        if (checks == null) {
            this.checksJson = null;
            return;
        }
        try {
            this.checksJson = JSON.writeValueAsString(checks);
        } catch (Exception e) {
            this.checksJson = "{}";
        }
    }

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

    public String getScheme() {
        return scheme;
    }

    public void setScheme(String scheme) {
        this.scheme = scheme;
    }

    public Integer getComplianceScore() {
        return complianceScore;
    }

    public void setComplianceScore(Integer complianceScore) {
        this.complianceScore = complianceScore;
    }

    public String getVoiceRemarks() {
        return voiceRemarks;
    }

    public void setVoiceRemarks(String voiceRemarks) {
        this.voiceRemarks = voiceRemarks;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
