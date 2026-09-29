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

/** Geo-tagged photo / video / document captured during an inspection. */
@Entity
@Table(name = "evidence", indexes = @Index(name = "idx_evidence_inspection", columnList = "inspection_id"))
public class Evidence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "inspection_id")
    private Integer inspectionId;

    /** {@code photo}, {@code video}, {@code audio} or {@code document}. */
    @Column(name = "evidence_type", length = 20)
    private String type;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Embedded
    private GeoPoint geoCoords;

    @Column(name = "captured_at")
    private Instant timestamp;

    @Column(name = "verified", nullable = false)
    private boolean verified;

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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getFilePath() {
        return filePath;
    }

    public void setFilePath(String filePath) {
        this.filePath = filePath;
    }

    public GeoPoint getGeoCoords() {
        return geoCoords;
    }

    public void setGeoCoords(GeoPoint geoCoords) {
        this.geoCoords = geoCoords;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
