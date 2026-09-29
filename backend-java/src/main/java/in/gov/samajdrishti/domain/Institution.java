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

/**
 * An institution under DoSJE monitoring: a home, a hostel, a rehab centre or a special
 * school, and the point every inspection, camera and attendance record hangs off.
 *
 * <p>Split out from {@link Project} on purpose. The LLD models the monitored site as an
 * *institution* with a type, a scheme, an address and a per-site geofence radius, and
 * separates it from the development work being funded at that site. `projects` stays as
 * the funding/implementation record the dashboards already read, and
 * {@code institution_id} on an inspection is the compatibility link back to it.
 *
 * <p>{@code geofenceRadius} is what makes §17 of the LLD configurable: a 250 m default
 * is fine for a city home, wrong for a campus spread over several acres.
 */
@Entity
@Table(name = "institutions", indexes = {
        @Index(name = "idx_institutions_project", columnList = "project_id"),
        @Index(name = "idx_institutions_district", columnList = "district"),
        @Index(name = "idx_institutions_status", columnList = "status")
})
public class Institution {

    /** Fallback geofence when a site has not declared its own. */
    public static final double DEFAULT_GEOFENCE_RADIUS_M = 250d;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    /** Link to the {@code projects} row that funds this site; kept for dashboard compatibility. */
    @Column(name = "project_id")
    private Integer projectId;

    @Column(name = "name", nullable = false, length = 200)
    private String name;

    /** {@code home}, {@code hostel}, {@code rehab_centre}, {@code special_school}, {@code shelter}, {@code other}. */
    @Column(name = "type", length = 40)
    private String type;

    /** Funding scheme key - {@code avyay}, {@code napddr} or {@code sipda}. */
    @Column(name = "scheme", length = 40)
    private String scheme;

    @Column(name = "address", columnDefinition = "text")
    private String address;

    @Column(name = "district", length = 100)
    private String district;

    @Column(name = "state", length = 100)
    private String state;

    @Embedded
    private GeoPoint geoCoords;

    /** Metres. {@code null} or &lt;= 0 falls back to {@link #DEFAULT_GEOFENCE_RADIUS_M}. */
    @Column(name = "geofence_radius")
    private Double geofenceRadius;

    /** {@code active}, {@code under_review}, {@code flagged} or {@code closed}. */
    @Column(name = "status", length = 30)
    private String status = "active";

    /** Sanctioned beneficiary capacity - the denominator for attendance percentage. */
    @Column(name = "sanctioned_capacity")
    private Integer sanctionedCapacity;

    @Column(name = "incharge_name", length = 120)
    private String inchargeName;

    @Column(name = "incharge_phone", length = 20)
    private String inchargePhone;

    @Column(name = "last_inspected_at")
    private Instant lastInspectedAt;

    @Column(name = "next_inspection_due")
    private LocalDate nextInspectionDue;

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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getScheme() {
        return scheme;
    }

    public void setScheme(String scheme) {
        this.scheme = scheme;
    }

    public String getAddress() {
        return address;
    }

    public void setAddress(String address) {
        this.address = address;
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = district;
    }

    public String getState() {
        return state;
    }

    public void setState(String state) {
        this.state = state;
    }

    public GeoPoint getGeoCoords() {
        return geoCoords;
    }

    public void setGeoCoords(GeoPoint geoCoords) {
        this.geoCoords = geoCoords;
    }

    public Double getGeofenceRadius() {
        return geofenceRadius;
    }

    public void setGeofenceRadius(Double geofenceRadius) {
        this.geofenceRadius = geofenceRadius;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Integer getSanctionedCapacity() {
        return sanctionedCapacity;
    }

    public void setSanctionedCapacity(Integer sanctionedCapacity) {
        this.sanctionedCapacity = sanctionedCapacity;
    }

    public String getInchargeName() {
        return inchargeName;
    }

    public void setInchargeName(String inchargeName) {
        this.inchargeName = inchargeName;
    }

    public String getInchargePhone() {
        return inchargePhone;
    }

    public void setInchargePhone(String inchargePhone) {
        this.inchargePhone = inchargePhone;
    }

    public Instant getLastInspectedAt() {
        return lastInspectedAt;
    }

    public void setLastInspectedAt(Instant lastInspectedAt) {
        this.lastInspectedAt = lastInspectedAt;
    }

    public LocalDate getNextInspectionDue() {
        return nextInspectionDue;
    }

    public void setNextInspectionDue(LocalDate nextInspectionDue) {
        this.nextInspectionDue = nextInspectionDue;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    /** The radius to enforce, never null and never non-positive. */
    public double effectiveGeofenceRadius() {
        return geofenceRadius == null || geofenceRadius <= 0 ? DEFAULT_GEOFENCE_RADIUS_M : geofenceRadius;
    }
}
