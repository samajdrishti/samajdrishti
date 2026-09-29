package in.gov.samajdrishti.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

/**
 * A monitored scheme / project.
 *
 * <p>{@code status} is intentionally a free-form column: the demo dataset uses
 * {@code flagged} and the dashboard also writes {@code in_progress}, which the
 * original PostgreSQL {@code CHECK} constraint would have rejected.
 */
@Entity
@Table(name = "projects")
public class Project {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "location", length = 200)
    private String location;

    @Column(name = "department", length = 60)
    private String department;

    @Embedded
    private GeoPoint geoCoords;

    @Column(name = "start_date")
    private LocalDate startDate;

    @Column(name = "end_date")
    private LocalDate endDate;

    @Column(name = "budget", precision = 14, scale = 2)
    private BigDecimal budget;

    @Column(name = "status", length = 20)
    private String status = "pending";

    /**
     * Scheme metadata as JSON text. No public getter, so Jackson only ever exposes the
     * parsed {@link #getMetadata()} view.
     */
    @Column(name = "metadata_json", columnDefinition = "text")
    private String metadataJson;

    @Column(name = "created_at")
    private Instant createdAt;

    /** Scheme metadata (sanction code, capacities, case timeline) as stored on the project. */
    @Transient
    public Object getMetadata() {
        if (metadataJson == null || metadataJson.isBlank()) {
            return null;
        }
        try {
            return JSON.readValue(metadataJson, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception e) {
            return metadataJson;
        }
    }

    public void setMetadata(Object metadata) {
        if (metadata == null) {
            this.metadataJson = null;
            return;
        }
        if (metadata instanceof String text) {
            this.metadataJson = text;
            return;
        }
        try {
            this.metadataJson = JSON.writeValueAsString(metadata);
        } catch (Exception e) {
            this.metadataJson = String.valueOf(metadata);
        }
    }

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

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getDepartment() {
        return department;
    }

    public void setDepartment(String department) {
        this.department = department;
    }

    public GeoPoint getGeoCoords() {
        return geoCoords;
    }

    public void setGeoCoords(GeoPoint geoCoords) {
        this.geoCoords = geoCoords;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public void setStartDate(LocalDate startDate) {
        this.startDate = startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public void setEndDate(LocalDate endDate) {
        this.endDate = endDate;
    }

    public BigDecimal getBudget() {
        return budget;
    }

    public void setBudget(BigDecimal budget) {
        this.budget = budget;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
