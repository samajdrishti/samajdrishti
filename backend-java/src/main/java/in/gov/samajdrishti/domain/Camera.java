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

/** Site CCTV camera plus the vision-derived tamper signals shown in the dashboard. */
@Entity
@Table(name = "cameras", indexes = @Index(name = "idx_cameras_project", columnList = "project_id"))
public class Camera {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "name", nullable = false, length = 120)
    private String name;

    @Column(name = "project_id")
    private Integer projectId;

    @Column(name = "location", length = 200)
    private String location;

    /** {@code simulated} (server-rendered), {@code mjpeg} or {@code hls}. */
    @Column(name = "stream_type", length = 20)
    private String streamType = "simulated";

    @Column(name = "stream_url", length = 500)
    private String streamUrl;

    @Embedded
    private GeoPoint geoCoords;

    /** {@code online} or {@code offline}. */
    @Column(name = "status", length = 20)
    private String status = "online";

    @Column(name = "tamper_flag", length = 40)
    private String tamperFlag;

    @Column(name = "occlusion_pct")
    private Double occlusionPct;

    @Column(name = "detected_headcount")
    private Integer detectedHeadcount;

    @Column(name = "aebas_punch_count")
    private Integer aebasPunchCount;

    @Column(name = "anomaly_note", columnDefinition = "text")
    private String anomalyNote;

    @Column(name = "last_seen")
    private Instant lastSeen;

    @Column(name = "created_at")
    private Instant createdAt;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public Integer getProjectId() {
        return projectId;
    }

    public void setProjectId(Integer projectId) {
        this.projectId = projectId;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getStreamType() {
        return streamType;
    }

    public void setStreamType(String streamType) {
        this.streamType = streamType;
    }

    public String getStreamUrl() {
        return streamUrl;
    }

    public void setStreamUrl(String streamUrl) {
        this.streamUrl = streamUrl;
    }

    public GeoPoint getGeoCoords() {
        return geoCoords;
    }

    public void setGeoCoords(GeoPoint geoCoords) {
        this.geoCoords = geoCoords;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getTamperFlag() {
        return tamperFlag;
    }

    public void setTamperFlag(String tamperFlag) {
        this.tamperFlag = tamperFlag;
    }

    public Double getOcclusionPct() {
        return occlusionPct;
    }

    public void setOcclusionPct(Double occlusionPct) {
        this.occlusionPct = occlusionPct;
    }

    public Integer getDetectedHeadcount() {
        return detectedHeadcount;
    }

    public void setDetectedHeadcount(Integer detectedHeadcount) {
        this.detectedHeadcount = detectedHeadcount;
    }

    public Integer getAebasPunchCount() {
        return aebasPunchCount;
    }

    public void setAebasPunchCount(Integer aebasPunchCount) {
        this.aebasPunchCount = aebasPunchCount;
    }

    public String getAnomalyNote() {
        return anomalyNote;
    }

    public void setAnomalyNote(String anomalyNote) {
        this.anomalyNote = anomalyNote;
    }

    public Instant getLastSeen() {
        return lastSeen;
    }

    public void setLastSeen(Instant lastSeen) {
        this.lastSeen = lastSeen;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
