package in.gov.samajdrishti.domain;

import java.time.Instant;

import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/**
 * A geo-tagged photo / video / document captured during an inspection.
 *
 * <p>The offline-first field app queues a capture while out of coverage and replays it
 * when the network returns. Four columns exist purely to make that replay safe:
 *
 * <ul>
 *   <li>{@code clientId} - a UUID minted on the phone. A replayed upload carrying a
 *       clientId the server already has returns the original row instead of writing a
 *       second one, so a lost ack cannot duplicate evidence.</li>
 *   <li>{@code fileHash} - SHA-256 of the bytes. Detects the same file arriving under a
 *       different clientId, which is how a re-captured or resynced photo is spotted.</li>
 *   <li>{@code syncStatus} - {@code pending} while the phone still holds it, {@code synced}
 *       once the server has acknowledged the write.</li>
 *   <li>{@code accuracy} - the GPS accuracy in metres at capture time, so a photo claiming
 *       a 200 m-accurate fix is not weighted the same as one claiming 3 m.</li>
 * </ul>
 */
@Entity
@Table(name = "evidence", indexes = {
        @Index(name = "idx_evidence_inspection", columnList = "inspection_id"),
        @Index(name = "idx_evidence_client", columnList = "client_id"),
        @Index(name = "idx_evidence_hash", columnList = "file_hash")
})
public class Evidence {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "inspection_id")
    private Integer inspectionId;

    /** The officer who uploaded this. */
    @Column(name = "uploaded_by")
    private Integer uploadedBy;

    /** {@code photo}, {@code video}, {@code audio} or {@code document}. */
    @Column(name = "evidence_type", length = 20)
    private String type;

    @Column(name = "file_path", length = 500)
    private String filePath;

    @Column(name = "file_name", length = 300)
    private String fileName;

    @Column(name = "content_type", length = 120)
    private String contentType;

    @Column(name = "file_size")
    private Long fileSize;

    @Embedded
    private GeoPoint geoCoords;

    /** GPS accuracy in metres at capture time, as reported by the device. */
    @Column(name = "accuracy")
    private Double accuracy;

    @Column(name = "captured_at")
    private Instant timestamp;

    /** SHA-256 of the uploaded bytes, lowercase hex. Null for a metadata-only record. */
    @Column(name = "file_hash", length = 64)
    private String fileHash;

    /** Client-generated UUID; the idempotency key for an offline replay. */
    @Column(name = "client_id", length = 64)
    private String clientId;

    /** {@code pending}, {@code synced} or {@code failed}. */
    @Column(name = "sync_status", length = 20)
    private String syncStatus = "synced";

    @Column(name = "previous_hash", length = 64)
    private String previousHash;

    @Column(name = "integrity_status", length = 30)
    private String integrityStatus = "unverified";

    @Column(name = "hash_verified")
    private Boolean hashVerified;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Column(name = "verified_by")
    private Integer verifiedBy;

    @Column(name = "verified_at")
    private Instant verifiedAt;

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

    public Integer getUploadedBy() {
        return uploadedBy;
    }

    public void setUploadedBy(Integer uploadedBy) {
        this.uploadedBy = uploadedBy;
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

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getContentType() {
        return contentType;
    }

    public void setContentType(String contentType) {
        this.contentType = contentType;
    }

    public Long getFileSize() {
        return fileSize;
    }

    public void setFileSize(Long fileSize) {
        this.fileSize = fileSize;
    }

    public GeoPoint getGeoCoords() {
        return geoCoords;
    }

    public void setGeoCoords(GeoPoint geoCoords) {
        this.geoCoords = geoCoords;
    }

    public Double getAccuracy() {
        return accuracy;
    }

    public void setAccuracy(Double accuracy) {
        this.accuracy = accuracy;
    }

    public Instant getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(Instant timestamp) {
        this.timestamp = timestamp;
    }

    public String getFileHash() {
        return fileHash;
    }

    public void setFileHash(String fileHash) {
        this.fileHash = fileHash;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getSyncStatus() {
        return syncStatus;
    }

    public void setSyncStatus(String syncStatus) {
        this.syncStatus = syncStatus;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public String getPreviousHash() {
        return previousHash;
    }

    public void setPreviousHash(String previousHash) {
        this.previousHash = previousHash;
    }

    public String getIntegrityStatus() {
        return integrityStatus != null ? integrityStatus : (verified ? "verified" : (fileHash != null ? "hashed" : "unverified"));
    }

    public void setIntegrityStatus(String integrityStatus) {
        this.integrityStatus = integrityStatus;
    }

    public Boolean getHashVerified() {
        return hashVerified;
    }

    public void setHashVerified(Boolean hashVerified) {
        this.hashVerified = hashVerified;
    }

    @JsonProperty("sha256_hash")
    public String getSha256Hash() {
        return fileHash;
    }

    @JsonProperty("mime_type")
    public String getMimeType() {
        return contentType;
    }
}

