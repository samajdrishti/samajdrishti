package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.InspectionChecklist;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.realtime.RealtimeHub;
import in.gov.samajdrishti.repository.InspectionChecklistRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.AiEngineClient;
import in.gov.samajdrishti.service.AuditService;
import in.gov.samajdrishti.service.ChecklistService;
import in.gov.samajdrishti.service.GeoService;
import in.gov.samajdrishti.service.InspectionService;
import in.gov.samajdrishti.web.dto.Requests;
import jakarta.validation.Valid;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/inspections")
public class InspectionController {

    private final InspectionRepository inspections;
    private final ProjectRepository projects;
    private final UserRepository users;
    private final InspectionChecklistRepository checklists;
    private final GeoService geo;
    private final AuditService audit;
    private final AiEngineClient ai;
    private final RealtimeHub hub;
    private final InspectionService lifecycle;
    private final ChecklistService checklistService;

    public InspectionController(InspectionRepository inspections,
                                ProjectRepository projects,
                                UserRepository users,
                                InspectionChecklistRepository checklists,
                                GeoService geo,
                                AuditService audit,
                                AiEngineClient ai,
                                RealtimeHub hub,
                                InspectionService lifecycle,
                                ChecklistService checklistService) {
        this.inspections = inspections;
        this.projects = projects;
        this.users = users;
        this.checklists = checklists;
        this.geo = geo;
        this.audit = audit;
        this.ai = ai;
        this.hub = hub;
        this.lifecycle = lifecycle;
        this.checklistService = checklistService;
    }

    @PostMapping("/assign")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Transactional
    public ResponseEntity<Inspection> assign(@RequestBody Requests.AssignInspection body) {
        Inspection inspection = new Inspection();
        inspection.setProjectId(body.projectId());
        inspection.setAssignedTo(body.assignedTo());
        inspection.setScheduledDate(body.scheduledDate());
        inspection.setAiRiskScore(body.aiRiskScore());
        inspection.setStatus("pending");
        inspection.setCreatedAt(Instant.now());
        Inspection saved = inspections.save(inspection);

        audit.record(null, "inspection.assigned", "inspection", saved.getId(),
                Map.of("project_id", String.valueOf(body.projectId()),
                        "assigned_to", String.valueOf(body.assignedTo())));
        hub.emit("inspection:new", Map.of("inspection", saved));
        return ResponseEntity.status(201).body(saved);
    }

    @GetMapping("/mine")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> mine(@AuthenticationPrincipal AuthPrincipal current) {
        List<Inspection> mine = inspections.findByAssignedToOrderByCreatedAtDesc(current.id());
        Map<Integer, Project> projectsById = projectsById();
        return mine.stream()
                .map(i -> withProject(i, projectsById.get(i.getProjectId()), true))
                .toList();
    }

    @GetMapping("/all")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> all() {
        Map<Integer, Project> projectsById = projectsById();
        Map<Integer, User> usersById = usersById();
        return inspections.findAllByOrderByCreatedAtDesc().stream()
                .map(i -> {
                    Map<String, Object> row = new LinkedHashMap<>(withProject(i, projectsById.get(i.getProjectId()), false));
                    User official = usersById.get(i.getAssignedTo());
                    row.put("official_name", official == null ? null : official.getName());
                    return row;
                })
                .toList();
    }

    /**
     * One inspection.
     *
     * <p>Ownership-checked: an officer may only read their own, which this route previously
     * did not enforce.
     */
    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> byId(@PathVariable Integer id, @AuthenticationPrincipal AuthPrincipal current) {
        boolean backOffice = current != null && current.isBackOffice();
        Inspection inspection = inspections.findById(id)
                .filter(i -> backOffice || current == null || i.getAssignedTo() == null
                        || i.getAssignedTo().equals(current.id()))
                .orElseThrow(() -> ApiException.notFound("Inspection not found or not assigned to you"));
        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        User official = users.findById(inspection.getAssignedTo()).orElse(null);

        Map<String, Object> row = new LinkedHashMap<>(withProject(inspection, project, false));
        row.put("geo_coords", project == null ? null : GeoService.normalise(project.getGeoCoords()));
        row.put("scheme", project == null ? null : project.getDepartment());
        row.put("official_name", official == null ? null : official.getName());
        row.put("gps_verified", inspection.isGpsVerified());
        row.put("gps_verdict", inspection.getGpsVerdict());
        return row;
    }

    /**
     * The LLD's §19 transition endpoints, one per milestone.
     *
     * <p>{@code start} requires a passing geofence, so "in progress" always means the
     * officer was verifiably on site. That check used to be advisory: the status could be set
     * to {@code in_progress} with no coordinates at all, and the failure was logged rather
     * than enforced.
     */
    @PostMapping("/{id}/accept")
    public Map<String, Object> accept(@PathVariable Integer id, @AuthenticationPrincipal AuthPrincipal current) {
        return lifecycle.accept(id, current);
    }

    @PostMapping("/{id}/start")
    public Map<String, Object> start(@PathVariable Integer id,
                                     @RequestBody(required = false) Requests.GeoRequest body,
                                     @AuthenticationPrincipal AuthPrincipal current) {
        return lifecycle.start(id, body == null ? null : body.lat(), body == null ? null : body.lng(), current);
    }

    /**
     * Ends the field visit and runs the AI analysis pass.
     *
     * <p>Distinct from filing the report, which the officer does deliberately afterwards.
     */
    @PostMapping("/{id}/complete")
    public Map<String, Object> complete(@PathVariable Integer id,
                                        @RequestBody(required = false) Requests.UpdateInspectionStatus body,
                                        @AuthenticationPrincipal AuthPrincipal current) {
        return lifecycle.complete(id,
                body == null ? null : body.notes(),
                body == null ? null : body.lat(),
                body == null ? null : body.lng(),
                current);
    }

    /**
     * Status transitions, the legacy route.
     *
     * <p>Kept because both shipped clients call it. Now enforced against the §19 state
     * machine rather than a four-value list, so it cannot bypass the transition rules the
     * dedicated routes apply.
     */
    @PutMapping("/{id}/status")
    public Map<String, Object> updateStatus(@PathVariable Integer id,
                                            @RequestBody Requests.UpdateInspectionStatus body,
                                            @AuthenticationPrincipal AuthPrincipal current) {
        return lifecycle.updateStatus(id, body.status(), body.notes(), body.completedDate(),
                body.lat(), body.lng(), current);
    }

    /** Standalone location check; the field app calls this while capturing evidence. */
    @PostMapping("/{id}/geo-verify")
    @Transactional(readOnly = true)
    public Map<String, Object> geoVerify(@PathVariable Integer id, @RequestBody Requests.GeoRequest body) {
        Inspection inspection = inspections.findById(id)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        GeoPoint observed = GeoPoint.of(body.lat(), body.lng());

        Map<String, Object> verification = new LinkedHashMap<>(
                geo.verify(GeoService.normalise(project == null ? null : project.getGeoCoords()), observed));

        // AI wording only - the deterministic verdict above stays authoritative.
        Map<String, Object> observation = new LinkedHashMap<>();
        observation.put("inspection_id", inspection.getId());
        observation.put("lat", body.lat());
        observation.put("lng", body.lng());
        Map<String, Object> aiVerdict = ai.geoVerify(
                AiEngineClient.projectForGeo(
                        project == null ? Map.of() : Map.of("id", project.getId(), "name", project.getName()),
                        GeoService.normalise(project == null ? null : project.getGeoCoords())),
                observation);
        if (aiVerdict != null && aiVerdict.get("explanation") != null) {
            verification.put("ai_explanation", aiVerdict.get("explanation"));
        }
        return verification;
    }

    /** How far along an inspection is: evidence, checklist, attendance, anomalies. */
    @GetMapping("/{id}/progress")
    @Transactional(readOnly = true)
    public Map<String, Object> progress(@PathVariable Integer id) {
        return lifecycle.progress(id);
    }

    /**
     * The checklist template plus the officer's answers.
     *
     * <p>Now per-item: each entry carries its own status, remarks and verification time,
     * which the previous {@code {itemId: boolean}} blob could not express.
     */
    @GetMapping("/{id}/checklist")
    @Transactional(readOnly = true)
    public Map<String, Object> getChecklist(@PathVariable Integer id) {
        Map<String, Object> body = new LinkedHashMap<>(checklistService.get(id));
        // The legacy boolean map is still emitted so an older field app keeps rendering.
        InspectionChecklist saved = checklists.findByInspectionId(id).orElse(null);
        body.put("saved_checks", saved == null ? Map.of() : saved.getChecks());
        return body;
    }

    /** The LLD's §8 per-item update. */
    @PutMapping("/{id}/checklist/{itemId}")
    public Map<String, Object> updateChecklistItem(@PathVariable Integer id,
                                                   @PathVariable String itemId,
                                                   @RequestBody Requests.ChecklistItemUpdate body,
                                                   @AuthenticationPrincipal AuthPrincipal current) {
        return checklistService.updateItem(id, itemId, body, current);
    }

    @PostMapping("/{id}/checklist")
    public Map<String, Object> saveChecklist(@PathVariable Integer id,
                                             @RequestBody Requests.Checklist body,
                                             @AuthenticationPrincipal AuthPrincipal current) {
        return checklistService.saveAll(id, body, current);
    }

    /* ---------------------------------------------------------------- helpers */

    private Map<Integer, Project> projectsById() {
        return projects.findAll().stream()
                .collect(java.util.stream.Collectors.toMap(Project::getId, p -> p, (a, b) -> a));
    }

    private Map<Integer, User> usersById() {
        return users.findAll().stream()
                .collect(java.util.stream.Collectors.toMap(User::getId, u -> u, (a, b) -> a));
    }

    /** Flattens an inspection row the way the joined SQL projection did. */
    private static Map<String, Object> withProject(Inspection inspection, Project project, boolean includeLocation) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", inspection.getId());
        row.put("project_id", inspection.getProjectId());
        row.put("assigned_to", inspection.getAssignedTo());
        row.put("supervisor_id", inspection.getSupervisorId());
        row.put("status", inspection.getStatus());
        row.put("scheduled_date", inspection.getScheduledDate());
        row.put("completed_date", inspection.getCompletedDate());
        row.put("ai_risk_score", inspection.getAiRiskScore());
        row.put("notes", inspection.getNotes());
        row.put("created_at", inspection.getCreatedAt());
        row.put("project_name", project == null ? null : project.getName());
        if (includeLocation) {
            row.put("location", project == null ? null : project.getLocation());
        }
        return row;
    }
}
