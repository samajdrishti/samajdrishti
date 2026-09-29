package in.gov.samajdrishti.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.domain.Anomaly;
import in.gov.samajdrishti.domain.AttendanceRecord;
import in.gov.samajdrishti.domain.ChecklistItem;
import in.gov.samajdrishti.domain.Evidence;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.InspectionAssignment;
import in.gov.samajdrishti.domain.InspectionStatus;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.realtime.RealtimeHub;
import in.gov.samajdrishti.repository.AnomalyRepository;
import in.gov.samajdrishti.repository.AttendanceRecordRepository;
import in.gov.samajdrishti.repository.ChecklistItemRepository;
import in.gov.samajdrishti.repository.EvidenceRepository;
import in.gov.samajdrishti.repository.InspectionAssignmentRepository;
import in.gov.samajdrishti.repository.InspectionChecklistRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.web.ApiException;

/**
 * The inspection lifecycle, LLD §19.
 *
 * <p>Two things this enforces that the previous {@code PUT /status} did not. First, moves are
 * checked against {@link InspectionStatus}'s transition table, so an inspection cannot jump
 * from {@code completed} back to {@code pending} and {@code IN_PROGRESS} is not reachable
 * without a passing geofence - that check was previously advisory, written to a log, and
 * relied on the client. Second, the assignment row moves in step with the inspection, so
 * accept/start/complete are recorded once in the ledger rather than being inferred from an
 * inspection's status later.
 */
@Service
public class InspectionService {

    private final InspectionRepository inspections;
    private final InspectionAssignmentRepository assignments;
    private final ProjectRepository projects;
    private final UserRepository users;
    private final EvidenceRepository evidence;
    private final ChecklistItemRepository checklistItems;
    private final InspectionChecklistRepository checklists;
    private final AttendanceRecordRepository attendance;
    private final AnomalyService anomalyService;
    private final GeoService geo;
    private final AuditService audit;
    private final NotificationService notifications;
    private final RealtimeHub hub;

    public InspectionService(InspectionRepository inspections,
                             InspectionAssignmentRepository assignments,
                             ProjectRepository projects,
                             UserRepository users,
                             EvidenceRepository evidence,
                             ChecklistItemRepository checklistItems,
                             InspectionChecklistRepository checklists,
                             AttendanceRecordRepository attendance,
                             AnomalyService anomalyService,
                             GeoService geo,
                             AuditService audit,
                             NotificationService notifications,
                             RealtimeHub hub) {
        this.inspections = inspections;
        this.assignments = assignments;
        this.projects = projects;
        this.users = users;
        this.evidence = evidence;
        this.checklistItems = checklistItems;
        this.checklists = checklists;
        this.attendance = attendance;
        this.anomalyService = anomalyService;
        this.geo = geo;
        this.audit = audit;
        this.notifications = notifications;
        this.hub = hub;
    }

    /**
     * The officer takes the duty.
     *
     * <p>Separate from {@code /start} on purpose: accepting is an acknowledgement that may
     * happen hours or days before the visit, and the LLD's §19 keeps them as separate states.
     */
    @Transactional
    public Map<String, Object> accept(Integer inspectionId, AuthPrincipal actor) {
        Inspection inspection = ownInspection(inspectionId, actor);
        InspectionStatus from = statusOf(inspection);
        if (from == InspectionStatus.ACCEPTED) {
            throw ApiException.badRequest("This inspection has already been accepted");
        }
        requireTransition(from, InspectionStatus.ACCEPTED);

        inspection.setStatus("accepted");
        inspections.save(inspection);
        assignments.findByInspectionIdAndStatus(inspectionId, "assigned").ifPresent(assignment -> {
            assignment.setStatus("accepted");
            assignment.setAcceptedAt(Instant.now());
            assignments.save(assignment);
        });

        audit.record(actor, "inspection.accepted", "inspection", inspectionId,
                Map.of("from", String.valueOf(from), "to", "ACCEPTED"));
        emit("INSPECTION_ACCEPTED", inspection, Map.of("officer", actor == null ? "" : String.valueOf(actor.name())));
        return response(inspection, "Inspection accepted");
    }

    /**
     * The officer arrives and starts work.
     *
     * <p>Requires either a prior passing geofence check or coordinates supplied now, so
     * "started" always means "the officer was verifiably on site". Refusing here is the point
     * of the whole geo-fence mechanism - without it the check is advisory.
     */
    @Transactional
    public Map<String, Object> start(Integer inspectionId, Double lat, Double lng, AuthPrincipal actor) {
        Inspection inspection = ownInspection(inspectionId, actor);
        InspectionStatus from = statusOf(inspection);

        if (!inspection.isGpsVerified() && (lat == null || lng == null)) {
            if ("accepted".equals(inspection.getStatus())) {
                throw ApiException.badRequest(
                        "A location check is required before starting: send the current GPS position, "
                                + "or call POST /inspections/" + inspectionId + "/location first");
            }
        }

        if (lat != null && lng != null) {
            Map<String, Object> verdict = geo.verify(
                    GeoService.normalise(registeredCoords(inspection)),
                    in.gov.samajdrishti.domain.GeoPoint.of(lat, lng));
            if ("verified".equals(String.valueOf(verdict.get("verdict")))) {
                inspection.setGpsVerified(true);
                inspection.setGpsVerifiedAt(Instant.now());
                inspection.setGpsVerdict("verified");
            }
        }

        if (!inspection.isGpsVerified()) {
            throw ApiException.badRequest(
                    "The location check did not pass, so this inspection cannot be started. "
                            + "Report it for review instead.");
        }

        requireTransition(from, InspectionStatus.IN_PROGRESS);
        inspection.setStatus("in_progress");
        inspection.setStartTime(Instant.now());
        inspections.save(inspection);
        assignments.findByInspectionIdAndStatus(inspectionId, "accepted").ifPresent(assignment -> {
            assignment.setStatus("started");
            assignment.setStartedAt(Instant.now());
            assignments.save(assignment);
        });

        audit.record(actor, "inspection.started", "inspection", inspectionId, Map.of(
                "from", String.valueOf(from),
                "gps_verified", String.valueOf(inspection.isGpsVerified())));
        emit("INSPECTION_STARTED", inspection, Map.of(
                "gps_verified", inspection.isGpsVerified(),
                "officer", actor == null ? "" : String.valueOf(actor.name())));
        return response(inspection, "Inspection started");
    }

    /**
     * Ends the field visit.
     *
     * <p>This is the LLD's {@code complete}, which closes the on-site work and triggers the
     * analysis pass. It is not the same as filing the report, which is a separate deliberate
     * act by the officer.
     */
    @Transactional
    public Map<String, Object> complete(Integer inspectionId, String notes, Double lat, Double lng,
                                        AuthPrincipal actor) {
        Inspection inspection = ownInspection(inspectionId, actor);
        InspectionStatus from = statusOf(inspection);

        List<String> flags = new ArrayList<>();
        if (lat != null && lng != null) {
            Map<String, Object> verdict = geo.verify(
                    GeoService.normalise(registeredCoords(inspection)),
                    in.gov.samajdrishti.domain.GeoPoint.of(lat, lng));
            String level = String.valueOf(verdict.get("verdict"));
            inspection.setGpsVerdict(level);
            if (distanceOf(verdict) != null) {
                inspection.setGpsDistanceMeters(distanceOf(verdict));
            }
            if (!"verified".equals(level)) {
                flags.add("suspicious".equals(level) ? "possible_proxy_reporting" : "outside_expected_radius");
                audit.record(actor, "geo_verification." + level, "inspection", inspectionId, verdict);
            } else {
                inspection.setGpsVerified(true);
                inspection.setGpsVerifiedAt(Instant.now());
            }
        }

        inspection.setStatus("completed");
        inspection.setEndTime(Instant.now());
        if (inspection.getCompletedDate() == null) {
            inspection.setCompletedDate(LocalDate.now());
        }
        if (notes != null && !notes.isBlank()) {
            inspection.setNotes(notes);
        }
        inspections.save(inspection);
        assignments.findByInspectionIdAndStatus(inspectionId, "started").ifPresent(assignment -> {
            assignment.setStatus("completed");
            assignment.setCompletedAt(Instant.now());
            assignments.save(assignment);
        });

        // Completion is exactly when the LLD's §21 says AI analysis runs, so it runs here
        // rather than waiting for someone to remember to trigger it.
        Map<String, Object> analysis = anomalyService.analyze(inspectionId, actor);
        inspection.setStatus("ai_analyzed");

        if (flags.contains("possible_proxy_reporting")) {
            inspection.setStatus("flagged");
            flags.add("auto_flagged");
            hub.emit("alert", Map.of(
                    "severity", "high",
                    "message", "Inspection #" + inspectionId + " auto-flagged: reported from outside the site radius",
                    "meta", Map.of("inspection_id", inspectionId,
                            "officer", actor == null || actor.name() == null ? "" : actor.name())));
        }
        inspections.save(inspection);

        audit.record(actor, "inspection.completed", "inspection", inspectionId, Map.of(
                "from", String.valueOf(from),
                "anomalies", String.valueOf(analysis.get("count")),
                "flags", String.join(",", flags)));

        Map<String, Object> body = response(inspection, "Inspection completed");
        body.put("flags", flags);
        body.put("analysis", analysis);
        return body;
    }

    /**
     * The legacy free-form status update.
     *
     * <p>Kept because both shipped clients call it. It is now a thin wrapper over the same
     * transition check the dedicated routes use, so the old route cannot bypass the state
     * machine - that was the whole problem with having only this route.
     */
    @Transactional
    public Map<String, Object> updateStatus(Integer inspectionId, String requestedStatus, String notes,
                                            LocalDate completedDate, Double lat, Double lng,
                                            AuthPrincipal actor) {
        InspectionStatus target = InspectionStatus.parse(requestedStatus);
        if (target == null) {
            throw ApiException.badRequest("Unknown status '" + requestedStatus + "'. Valid values: "
                    + "assigned, accepted, gps_verified, in_progress, vc_active, evidence_captured, "
                    + "checklist_completed, ai_analyzed, submitted, under_review, atr_created, "
                    + "action_in_progress, verified, closed, flagged, cancelled"
                    + " (legacy aliases pending, completed are also accepted)");
        }

        // The convenience aliases collapse onto the dedicated routes, which carry the extra
        // rules (start needs a geofence, complete runs the analysis) rather than duplicating them.
        return switch (target) {
            case ACCEPTED -> accept(inspectionId, actor);
            case IN_PROGRESS, GPS_VERIFIED -> start(inspectionId, lat, lng, actor);
            case SUBMITTED -> complete(inspectionId, notes, lat, lng, actor);
            default -> {
                Inspection inspection = ownInspection(inspectionId, actor);
                InspectionStatus from = statusOf(inspection);
                if (from != target) {
                    requireTransition(from, target);
                }
                String previousStatus = inspection.getStatus();
                inspection.setStatus(target.name().toLowerCase(Locale.ROOT));
                if (notes != null && !notes.isBlank()) {
                    inspection.setNotes(notes);
                }
                if (completedDate != null) {
                    inspection.setCompletedDate(completedDate);
                }
                inspections.save(inspection);
                audit.recordChange(actor, "inspection.status_changed", "inspection", inspectionId,
                        Map.of("status", String.valueOf(previousStatus)),
                        Map.of("status", inspection.getStatus()));
                emit("INSPECTION_UPDATED", inspection, Map.of("from", String.valueOf(previousStatus)));
                yield response(inspection, "Inspection updated");
            }
        };
    }

    /** Progress summary an officer sees on their list. */
    @Transactional(readOnly = true)
    public Map<String, Object> progress(Integer inspectionId) {
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        List<ChecklistItem> items = checklistItems.findByInspectionIdOrderByIdAsc(inspectionId);
        long answered = items.stream()
                .filter(i -> "verified".equals(i.getStatus()) || "failed".equals(i.getStatus()))
                .count();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("inspection_id", inspectionId);
        body.put("status", inspection.getStatus());
        body.put("gps_verified", inspection.isGpsVerified());
        body.put("evidence_count", evidence.countByInspectionId(inspectionId));
        body.put("checklist", Map.of("answered", answered, "total", items.isEmpty() ? null : items.size()));
        body.put("compliance_score", checklists.findByInspectionId(inspectionId)
                .map(in.gov.samajdrishti.domain.InspectionChecklist::getComplianceScore)
                .orElse(null));
        body.put("attendance", attendance.findFirstByInspectionIdOrderByIdDesc(inspectionId).orElse(null));
        body.put("anomaly_count", anomalyService.countFor(inspectionId));
        body.put("unverified_anomalies", anomalyService.countUnverifiedFor(inspectionId));
        return body;
    }

    /* ----------------------------------------------------------------- helpers */

    /**
     * Fetches an inspection the caller is responsible for.
     *
     * <p>Back-office roles may touch any inspection; an officer only their own. Previously
     * three read/write routes skipped this check entirely, so any authenticated user could
     * read another officer's inspection and submit a checklist against it.
     */
    private Inspection ownInspection(Integer inspectionId, AuthPrincipal actor) {
        if (actor == null) {
            throw ApiException.badRequest("Authentication is required");
        }
        if (actor.isBackOffice()) {
            return inspections.findById(inspectionId)
                    .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        }
        return inspections.findByIdAndAssignedTo(inspectionId, actor.id())
                .orElseThrow(() -> ApiException.notFound("Inspection not found or not assigned to you"));
    }

    private void requireTransition(InspectionStatus from, InspectionStatus to) {
        if (!from.canTransitionTo(to)) {
            throw ApiException.badRequest("Cannot move an inspection from " + from + " to " + to
                    + ". Allowed next: " + (from.allowedNext().isEmpty() ? "nothing, this is a final state"
                    : String.join(", ", from.allowedNext().stream().map(Enum::name).toList())));
        }
    }

    private InspectionStatus statusOf(Inspection inspection) {
        InspectionStatus parsed = InspectionStatus.parse(inspection.getStatus());
        return parsed == null ? InspectionStatus.ASSIGNED : parsed;
    }

    private in.gov.samajdrishti.domain.GeoPoint registeredCoords(Inspection inspection) {
        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        return GeoService.normalise(project == null ? null : project.getGeoCoords());
    }

    private static Double distanceOf(Map<String, Object> verdict) {
        Object distance = verdict.get("distance_meters");
        return distance instanceof Number number ? number.doubleValue() : null;
    }

    private void emit(String event, Inspection inspection, Map<String, Object> extra) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("event", event);
        payload.put("inspectionId", inspection.getId());
        payload.put("inspection_code", inspection.getInspectionCode());
        payload.put("institutionId", inspection.getInstitutionId());
        payload.put("projectId", inspection.getProjectId());
        payload.put("officerId", inspection.getAssignedTo());
        payload.put("status", inspection.getStatus());
        payload.put("gpsVerified", inspection.isGpsVerified());
        payload.put("timestamp", Instant.now().toString());
        payload.putAll(extra);
        hub.emit("inspection:event", payload);
    }

    private Map<String, Object> response(Inspection inspection, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", message);
        body.put("inspection", inspection);
        return body;
    }
}
