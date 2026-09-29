package in.gov.samajdrishti.domain;

import java.time.Instant;
import java.time.LocalDate;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

/** One geo-fenced attendance punch pair for an official at a project. */
@Entity
@Table(name = "attendance", indexes = {
        @Index(name = "idx_attendance_official", columnList = "official_id"),
        @Index(name = "idx_attendance_date", columnList = "attendance_date")
})
public class Attendance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "official_id")
    private Integer officialId;

    @Column(name = "project_id")
    private Integer projectId;

    @Column(name = "check_in")
    private Instant checkIn;

    @Column(name = "check_out")
    private Instant checkOut;

    @Embedded
    private GeoPoint geoCoords;

    @Column(name = "device", length = 120)
    private String device;

    @Column(name = "mode", length = 20)
    private String mode = "gps";

    @Column(name = "attendance_date")
    private LocalDate date;

    @Column(name = "created_at")
    private Instant createdAt;

    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public Integer getOfficialId() {
        return officialId;
    }

    public void setOfficialId(Integer officialId) {
        this.officialId = officialId;
    }

    public Integer getProjectId() {
        return projectId;
    }

    public void setProjectId(Integer projectId) {
        this.projectId = projectId;
    }

    public Instant getCheckIn() {
        return checkIn;
    }

    public void setCheckIn(Instant checkIn) {
        this.checkIn = checkIn;
    }

    public Instant getCheckOut() {
        return checkOut;
    }

    public void setCheckOut(Instant checkOut) {
        this.checkOut = checkOut;
    }

    public GeoPoint getGeoCoords() {
        return geoCoords;
    }

    public void setGeoCoords(GeoPoint geoCoords) {
        this.geoCoords = geoCoords;
    }

    public String getDevice() {
        return device;
    }

    public void setDevice(String device) {
        this.device = device;
    }

    public String getMode() {
        return mode;
    }

    public void setMode(String mode) {
        this.mode = mode;
    }

    public LocalDate getDate() {
        return date;
    }

    public void setDate(LocalDate date) {
        this.date = date;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
