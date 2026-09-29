package in.gov.samajdrishti.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.domain.Anomaly;
import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.domain.Institution;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.repository.AnomalyRepository;
import in.gov.samajdrishti.repository.AttendanceRecordRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.InstitutionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.web.ApiException;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * The institution registry, the LLD's {@code institutions} table.
 *
 * <p>Kept separate from {@code projects} deliberately. The LLD models the monitored site as
 * an institution with a type, a scheme, an address, a district and its own geofence radius,
 * and treats that as a different thing from the development work funded at the site. Both
 * dashboards call {@code /api/projects} and must keep working, so {@code projects} is
 * untouched and {@code institution_id} on an inspection links the two.
 */
@Service
public class InstitutionService {

    private static final List<String> TYPES = List.of(
            "home", "hostel", "rehab_centre", "special_school", "shelter", "other");
    private static final List<String> STATUSES = List.of("active", "under_review", "flagged", "closed");

    private final InstitutionRepository institutions;
    private final InspectionRepository inspections;
    private final ProjectRepository projects;
    private final AnomalyRepository anomalies;
    private final AttendanceRecordRepository attendance;
    private final AuditService audit;

    public InstitutionService(InstitutionRepository institutions,
                              InspectionRepository inspections,
                              ProjectRepository projects,
                              AnomalyRepository anomalies,
                              AttendanceRecordRepository attendance,
                              AuditService audit) {
        this.institutions = institutions;
        this.inspections = inspections;
        this.projects = projects;
        this.anomalies = anomalies;
        this.attendance = attendance;
        this.audit = audit;
    }

    /**
     * Creates an institution, optionally standing in for a project.
     *
     * <p>The {@code projectId} link is what lets a geofence radius be honoured for a site
     * whose inspections still point at a project: the geofence service falls back to
     * looking the institution up by project when an inspection has no direct link.
     */
    @Transactional
    public Institution create(Requests.UpsertInstitution body, AuthPrincipal actor) {
        if (body.projectId() != null) {
            projects.findById(body.projectId())
                    .orElseThrow(() -> ApiException.notFound("Project not found"));
        }
        Institution institution = new Institution();
        apply(institution, body);
        institution.setCreatedAt(Instant.now());
        Institution saved = institutions.save(institution);

        audit.record(actor, "institution.created", "institution", saved.getId(), Map.of(
                "name", String.valueOf(saved.getName()),
                "district", String.valueOf(saved.getDistrict()),
                "geofence_radius", String.valueOf(saved.getGeofenceRadius())));
        return saved;
    }

    @Transactional
    public Institution update(Integer id, Requests.UpsertInstitution body, AuthPrincipal actor) {
        Institution institution = require(id);
        apply(institution, body);
        Institution saved = institutions.save(institution);
        audit.record(actor, "institution.updated", "institution", id, Map.of(
                "name", String.valueOf(saved.getName()),
                "geofence_radius", String.valueOf(saved.getGeofenceRadius())));
        return saved;
    }

    /**
     * Lists institutions with the counts a monitoring dashboard needs.
     *
     * <p>Loaded per institution in bulk rather than one query each - a district with 200
     * sites would otherwise be 600 round-trips.
     */
    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(String district, String status, String scheme) {
        List<Institution> rows = institutions.findAll();

        // Anomaly rows only carry a project id, so the same project -> institution mapping
        // used for inspections is applied to them. Built per call rather than cached on the
        // bean: a mutable field would not survive concurrent requests safely.
        Map<Integer, Integer> byProject = new java.util.HashMap<>();
        rows.stream()
                .filter(i -> i.getProjectId() != null)
                .forEach(i -> byProject.putIfAbsent(i.getProjectId(), i.getId()));

        Map<Integer, Long> inspectionsBy = new java.util.HashMap<>();
        for (Inspection inspection : inspections.findAll()) {
            Integer key = institutionIdFor(inspection, rows);
            if (key != null) {
                inspectionsBy.merge(key, 1L, Long::sum);
            }
        }
        Map<Integer, Long> anomaliesBy = new java.util.HashMap<>();
        for (Anomaly anomaly : anomalies.findAll()) {
            Integer key = anomaly.getProjectId() == null ? null : byProject.get(anomaly.getProjectId());
            if (key != null) {
                anomaliesBy.merge(key, 1L, Long::sum);
            }
        }

        return rows.stream()
                .filter(i -> district == null || district.isBlank() || district.equalsIgnoreCase(i.getDistrict()))
                .filter(i -> status == null || status.isBlank() || status.equalsIgnoreCase(i.getStatus()))
                .filter(i -> scheme == null || scheme.isBlank() || scheme.equalsIgnoreCase(i.getScheme()))
                .map(i -> {
                    Map<String, Object> body = new LinkedHashMap<>();
                    body.put("id", i.getId());
                    body.put("name", i.getName());
                    body.put("type", i.getType());
                    body.put("scheme", i.getScheme());
                    body.put("address", i.getAddress());
                    body.put("district", i.getDistrict());
                    body.put("state", i.getState());
                    body.put("geo_coords", GeoService.normalise(i.getGeoCoords()));
                    body.put("geofence_radius", Math.round(i.effectiveGeofenceRadius()));
                    body.put("status", i.getStatus());
                    body.put("sanctioned_capacity", i.getSanctionedCapacity());
                    body.put("incharge_name", i.getInchargeName());
                    body.put("incharge_phone", i.getInchargePhone());
                    body.put("project_id", i.getProjectId());
                    body.put("last_inspected_at", i.getLastInspectedAt());
                    body.put("next_inspection_due", i.getNextInspectionDue());
                    body.put("inspection_count", inspectionsBy.getOrDefault(i.getId(), 0L));
                    body.put("anomaly_count", anomaliesBy.getOrDefault(i.getId(), 0L));
                    return body;
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public Institution byId(Integer id) {
        return require(id);
    }

    /**
     * A back office view of the whole estate.
     *
     * <p>Distinct from {@code /api/monitoring/overview}, which reports camera liveness. This
     * one answers "which institutions need a visit and why".
     */
    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        List<Map<String, Object>> rows = list(null, null, null);
        long flagged = rows.stream().filter(r -> "flagged".equals(r.get("status"))).count();
        long due = rows.stream()
                .filter(r -> r.get("next_inspection_due") != null)
                .count();
        long noCapacity = rows.stream()
                .filter(r -> r.get("sanctioned_capacity") == null)
                .count();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("institutions", rows);
        body.put("total", rows.size());
        body.put("flagged", flagged);
        body.put("inspected", rows.stream().filter(r -> r.get("last_inspected_at") != null).count());
        body.put("never_inspected", rows.stream().filter(r -> r.get("last_inspected_at") == null).count());
        body.put("inspection_due", due);
        body.put("missing_sanctioned_capacity", noCapacity);
        return body;
    }

    /* ----------------------------------------------------------------- helpers */

    private void apply(Institution institution, Requests.UpsertInstitution body) {
        institution.setName(body.name());
        institution.setType(normalise(body.type(), TYPES, institution.getType()));
        institution.setScheme(body.scheme());
        institution.setAddress(body.address());
        institution.setDistrict(body.district());
        institution.setState(body.state());
        if (body.geoCoords() != null) {
            institution.setGeoCoords(GeoPoint.of(body.geoCoords().lat(), body.geoCoords().lng()));
        }
        if (body.geofenceRadius() != null) {
            if (body.geofenceRadius() <= 0) {
                throw ApiException.badRequest("geofence_radius must be greater than zero");
            }
            // Capped: a radius large enough to cover a district would defeat the check.
            if (body.geofenceRadius() > 5000) {
                throw ApiException.badRequest("geofence_radius may not exceed 5000 m");
            }
            institution.setGeofenceRadius(body.geofenceRadius());
        }
        institution.setStatus(normalise(body.status(), STATUSES, institution.getStatus()));
        institution.setSanctionedCapacity(body.sanctionedCapacity());
        institution.setInchargeName(body.inchargeName());
        institution.setInchargePhone(body.inchargePhone());
        if (body.projectId() != null) {
            institution.setProjectId(body.projectId());
        }
    }

    private Integer institutionIdFor(Inspection inspection, List<Institution> rows) {
        if (inspection.getInstitutionId() != null) {
            return inspection.getInstitutionId();
        }
        if (inspection.getProjectId() == null) {
            return null;
        }
        return rows.stream()
                .filter(i -> inspection.getProjectId().equals(i.getProjectId()))
                .map(Institution::getId)
                .findFirst()
                .orElse(null);
    }

    private Institution require(Integer id) {
        return institutions.findById(id)
                .orElseThrow(() -> ApiException.notFound("Institution not found"));
    }

    private static String normalise(String value, List<String> allowed, String fallback) {
        if (value == null || value.isBlank()) {
            return fallback;
        }
        String candidate = value.strip().toLowerCase(java.util.Locale.ROOT);
        return allowed.contains(candidate) ? candidate : fallback;
    }
}
