package in.gov.samajdrishti.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.InspectionAssignment;
import in.gov.samajdrishti.domain.Institution;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.realtime.RealtimeHub;
import in.gov.samajdrishti.repository.InspectionAssignmentRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.InstitutionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.web.ApiException;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * Geofence verification, LLD §6 and §17.
 *
 * <p>The haversine calculation itself already existed in {@link GeoService} and is not
 * repeated here. What was missing is persistence and configuration:
 *
 * <ul>
 *   <li>The verdict was computed, returned to the caller, and thrown away. A later read of
 *       the inspection could not say whether the officer had ever proved where they were,
 *       so {@code inspections.gps_verified} is now written and read by the state machine.</li>
 *   <li>The radius was a hardcoded 250 m. A campus spread over acres and a single-room home
 *       are not the same size, so the radius now comes from the institution and only falls
 *       back to 250 m when a site has not declared one.</li>
 * </ul>
 */
@Service
public class GeofenceService {

    private final InspectionRepository inspections;
    private final InstitutionRepository institutions;
    private final ProjectRepository projects;
    private final InspectionAssignmentRepository assignments;
    private final GeoService geo;
    private final AuditService audit;
    private final RealtimeHub hub;

    public GeofenceService(InspectionRepository inspections,
                           InstitutionRepository institutions,
                           ProjectRepository projects,
                           InspectionAssignmentRepository assignments,
                           GeoService geo,
                           AuditService audit,
                           RealtimeHub hub) {
        this.inspections = inspections;
        this.institutions = institutions;
        this.projects = projects;
        this.assignments = assignments;
        this.geo = geo;
        this.audit = audit;
        this.hub = hub;
    }

    /**
     * The LLD's {@code POST /inspections/{id}/location}.
     *
     * <p>Stores the outcome on the inspection: a passing verdict sets {@code gps_verified},
     * which is what makes {@code IN_PROGRESS} reachable, and a failing one records the
     * distance so the report can show how far off it was.
     */
    @Transactional
    public Map<String, Object> verify(Integer inspectionId, Requests.GeoRequest body, AuthPrincipal actor) {
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        Institution institution = resolveInstitution(inspection);

        GeoPoint registered = GeoService.normalise(
                institution != null ? institution.getGeoCoords()
                        : project == null ? null : project.getGeoCoords());
        double radius = institution == null
                ? GeoService.DEFAULT_RADIUS_M
                : institution.effectiveGeofenceRadius();

        GeoPoint observed = GeoPoint.of(body.lat(), body.lng());
        Map<String, Object> verdict = new LinkedHashMap<>(geo.verify(registered, observed, radius));
        verdict.put("inspection_id", inspectionId);
        verdict.put("accuracy", body.accuracy());
        if (institution != null) {
            verdict.put("institution_id", institution.getId());
        }

        String level = String.valueOf(verdict.get("verdict"));
        boolean passed = "verified".equals(level);
        Object distance = verdict.get("distance_meters");

        if (passed) {
            inspection.setGpsVerified(true);
            inspection.setGpsVerifiedAt(Instant.now());
            inspection.setGpsDistanceMeters(distance instanceof Number number ? number.doubleValue() : null);
            inspection.setGpsVerdict(level);
            // The first successful check is also the point the officer can start work.
            if ("accepted".equals(inspection.getStatus())) {
                inspection.setStatus("gps_verified");
            }
            assignments.findByInspectionIdAndStatus(inspectionId, "accepted")
                    .ifPresent(assignment -> {
                        assignment.setStatus("started");
                        assignment.setStartedAt(Instant.now());
                        assignments.save(assignment);
                    });
        } else {
            inspection.setGpsVerdict(level);
            if (distance instanceof Number number) {
                inspection.setGpsDistanceMeters(number.doubleValue());
            }
        }
        inspections.save(inspection);

        audit.record(actor, "geo_verification." + level, "inspection", inspectionId, verdict);
        hub.emit("inspection:location", Map.of(
                "inspection_id", inspectionId,
                "verified", passed,
                "geo_verification", verdict));

        if (!passed && !"unknown".equals(level)) {
            hub.emit("alert", Map.of(
                    "severity", "high".equals(verdict.get("severity")) ? "high" : "medium",
                    "message", "Inspection #" + inspectionId + " location check: " + verdict.get("explanation"),
                    "meta", Map.of("inspection_id", inspectionId,
                            "officer", actor == null || actor.name() == null ? "" : actor.name())));
        }

        // snake_case, matching the rest of the wire contract (JacksonConfig applies
        // SNAKE_CASE to DTOs and every composite response here uses explicit snake_case
        // keys). The LLD's example body spells these in camelCase; the codebase convention
        // wins so a client sees one naming style across the API.
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("verified", passed);
        result.put("distance_meters", verdict.get("distance_meters"));
        result.put("accuracy", body.accuracy());
        result.put("radius_meters", verdict.get("radius_meters"));
        result.put("verdict", level);
        result.put("explanation", verdict.get("explanation"));
        result.put("severity", verdict.get("severity"));
        result.put("institution_id", institution == null ? null : institution.getId());
        result.put("inspection_status", inspection.getStatus());
        return result;
    }

    /**
     * The standing verdict for an inspection, for screens that only need a badge.
     *
     * <p>Recomputed from stored evidence when the live check has never run, so a report
     * submitted without one still gets an answer.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> status(Integer inspectionId) {
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        Institution institution = resolveInstitution(inspection);
        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        double radius = institution == null ? GeoService.DEFAULT_RADIUS_M : institution.effectiveGeofenceRadius();
        GeoPoint registered = GeoService.normalise(
                institution != null ? institution.getGeoCoords()
                        : project == null ? null : project.getGeoCoords());

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("inspection_id", inspectionId);
        result.put("verified", inspection.isGpsVerified());
        result.put("verdict", inspection.getGpsVerdict());
        result.put("distanceMeters", inspection.getGpsDistanceMeters());
        result.put("verifiedAt", inspection.getGpsVerifiedAt());
        result.put("radiusMeters", Math.round(radius));
        result.put("institution_id", institution == null ? null : institution.getId());
        if (inspection.getGpsVerdict() == null) {
            result.put("verdict", geo.verify(registered, null, radius).get("verdict"));
            result.put("explanation", "No location check has been recorded for this inspection yet.");
        }
        return result;
    }

    /**
     * The institution backing an inspection.
     *
     * <p>Resolution order is the stored link, then the institution whose {@code project_id}
     * matches. The fallback matters because inspections created before the institutions table
     * existed have no {@code institution_id} and must still pick up a per-site radius.
     */
    private Institution resolveInstitution(Inspection inspection) {
        if (inspection.getInstitutionId() != null) {
            var direct = institutions.findById(inspection.getInstitutionId());
            if (direct.isPresent()) {
                return direct.get();
            }
        }
        if (inspection.getProjectId() == null) {
            return null;
        }
        return institutions.findFirstByProjectId(inspection.getProjectId()).orElse(null);
    }
}
