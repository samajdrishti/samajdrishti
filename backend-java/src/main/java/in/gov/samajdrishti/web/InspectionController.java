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
import in.gov.samajdrishti.service.GeoService;
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

    private static final List<String> VALID_STATUSES =
            List.of("pending", "in_progress", "completed", "flagged");

    /** Scheme-specific regulatory checklists, per DoSJE inspection guidelines. */
    private static final Map<String, List<ChecklistItem>> SCHEME_CHECKLISTS = Map.of(
            "avyay", List.of(
                    item("resident_headcount", "Resident Headcount Match: Physical count matches approved quota", 25),
                    item("dietary_nutrition", "Nutrition Standard: Clean kitchen, weekly approved menu displayed", 15),
                    item("medical_log", "Medical Attendance: Registered doctor visit verified in logbook", 20),
                    item("hygiene_bedding", "Living Quarters: Sanitized rooms, clean bedding, hot water", 15),
                    item("emergency_medicines", "Medicine Stock: First aid kit & essential chronic illness drugs stocked", 15),
                    item("recreational_counseling", "Recreation & Well-being: TV room, reading materials, counseling logs", 10)),
            "napddr", List.of(
                    item("doctor_duty", "Medical Staff: MBBS Doctor / Psychiatrist verified on active duty", 25),
                    item("detox_ward_safety", "Detox Ward Security: 24/7 nursing and secure patient observation", 20),
                    item("medicine_register", "Schedule-H Register: Controlled medication entries reconciled without gap", 20),
                    item("psychosocial_counseling", "Counseling Protocols: Individual and group therapy session records", 15),
                    item("relapse_tracking", "Post-Discharge Registry: Relapse follow-up documented for alumni", 10),
                    item("nutrition_hygiene", "Sanitation & Diet: Clean kitchen, balanced food, hygienic washrooms", 10)),
            "sipda", List.of(
                    item("barrier_free_ramp", "Accessibility Ramps: CPWD standard 1:12 gradient with dual handrails", 25),
                    item("accessible_toilets", "Barrier-Free Restrooms: Grab bars, wide doorways, wheel-chair turning radius", 20),
                    item("assistive_devices", "Assistive Tech Kits: Screen readers, Braille aids, hearing loop functional", 20),
                    item("trainer_ratio", "Certified Special Educators: Recognized RCI trainer ratio maintained", 15),
                    item("biometric_attendance", "AEBAS Verification: Biometric logs match live classroom headcount", 15),
                    item("placement_records", "Vocational Placement: Job link documentation and certificates current", 5)));

    private static final String DEFAULT_SCHEME = "avyay";

    private final InspectionRepository inspections;
    private final ProjectRepository projects;
    private final UserRepository users;
    private final InspectionChecklistRepository checklists;
    private final GeoService geo;
    private final AuditService audit;
    private final AiEngineClient ai;
    private final RealtimeHub hub;

    public InspectionController(InspectionRepository inspections,
                                ProjectRepository projects,
                                UserRepository users,
                                InspectionChecklistRepository checklists,
                                GeoService geo,
                                AuditService audit,
                                AiEngineClient ai,
                                RealtimeHub hub) {
        this.inspections = inspections;
        this.projects = projects;
        this.users = users;
        this.checklists = checklists;
        this.geo = geo;
        this.audit = audit;
        this.ai = ai;
        this.hub = hub;
    }

    private record ChecklistItem(String id, String title, int weight) {
    }

    private static ChecklistItem item(String id, String title, int weight) {
        return new ChecklistItem(id, title, weight);
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

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> byId(@PathVariable Integer id) {
        Inspection inspection = inspections.findById(id)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        User official = users.findById(inspection.getAssignedTo()).orElse(null);

        Map<String, Object> row = new LinkedHashMap<>(withProject(inspection, project, false));
        row.put("geo_coords", project == null ? null : GeoService.normalise(project.getGeoCoords()));
        row.put("scheme", project == null ? null : project.getDepartment());
        row.put("official_name", official == null ? null : official.getName());
        return row;
    }

    /**
     * Status transitions.
     *
     * <p>Every change is geo-tagged. A report filed far from the registered site is
     * escalated to {@code flagged} automatically, audited, and broadcast - this is the
     * mechanism that reduces fake reporting and proxy functioning.
     */
    @PutMapping("/{id}/status")
    @Transactional
    public Map<String, Object> updateStatus(@PathVariable Integer id,
                                            @RequestBody Requests.UpdateInspectionStatus body,
                                            @AuthenticationPrincipal AuthPrincipal current) {
        if (!VALID_STATUSES.contains(body.status())) {
            throw ApiException.badRequest("status must be one of: " + String.join(", ", VALID_STATUSES));
        }

        Inspection inspection = inspections.findByIdAndAssignedTo(id, current.id())
                .orElseThrow(() -> ApiException.notFound("Inspection not found or not assigned to you"));
        String previousStatus = inspection.getStatus();

        inspection.setStatus(body.status());
        if (body.notes() != null) {
            inspection.setNotes(body.notes());
        }
        inspection.setCompletedDate(body.completedDate() == null ? LocalDate.now() : body.completedDate());
        inspections.save(inspection);

        List<String> flags = new ArrayList<>();
        Map<String, Object> geoVerification = null;

        if (body.lat() != null && body.lng() != null) {
            Project project = projects.findById(inspection.getProjectId()).orElse(null);
            GeoPoint observed = GeoPoint.of(body.lat(), body.lng());
            geoVerification = geo.verify(GeoService.normalise(project == null ? null : project.getGeoCoords()),
                    observed);

            String verdict = String.valueOf(geoVerification.get("verdict"));
            if (!"verified".equals(verdict)) {
                flags.add("suspicious".equals(verdict) ? "possible_proxy_reporting" : "outside_expected_radius");
                audit.record(current, "geo_verification." + verdict, "inspection", inspection.getId(),
                        geoVerification);

                if ("suspicious".equals(verdict)) {
                    inspection.setStatus("flagged");
                    inspections.save(inspection);
                    flags.add("auto_flagged");
                    hub.emit("alert", Map.of(
                            "severity", "high",
                            "message", "Inspection #%d auto-flagged: %s"
                                    .formatted(inspection.getId(), geoVerification.get("explanation")),
                            "meta", Map.of(
                                    "inspection_id", inspection.getId(),
                                    "official", current.name() == null ? "" : current.name())));
                }
            }
        }

        audit.record(current, "inspection.status_changed", "inspection", inspection.getId(),
                Map.of("from", previousStatus == null ? "" : previousStatus,
                        "to", inspection.getStatus(),
                        "geo", geoVerification == null ? "not_provided" : String.valueOf(geoVerification.get("verdict"))));

        hub.emit("inspection:update", Map.of(
                "inspection", inspection,
                "status", inspection.getStatus(),
                "flags", flags));

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("inspection", inspection);
        response.put("geo_verification", geoVerification);
        response.put("flags", flags);
        return response;
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

    @GetMapping("/{id}/checklist")
    @Transactional(readOnly = true)
    public Map<String, Object> getChecklist(@PathVariable Integer id) {
        Inspection inspection = inspections.findById(id)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        String scheme = schemeFor(inspection);
        InspectionChecklist saved = checklists.findByInspectionId(id).orElse(null);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("scheme", scheme.toUpperCase());
        body.put("items", templateFor(scheme));
        body.put("saved_checks", saved == null ? Map.of() : saved.getChecks());
        body.put("compliance_score", saved == null ? null : saved.getComplianceScore());
        body.put("voice_remarks", saved == null ? null : saved.getVoiceRemarks());
        return body;
    }

    @PostMapping("/{id}/checklist")
    @Transactional
    public Map<String, Object> saveChecklist(@PathVariable Integer id,
                                             @RequestBody Requests.Checklist body,
                                             @AuthenticationPrincipal AuthPrincipal current) {
        Inspection inspection = inspections.findById(id)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        String scheme = schemeFor(inspection);
        List<ChecklistItem> template = templateFor(scheme);
        Map<String, Boolean> checks = body.checks() == null ? Map.of() : body.checks();

        int score = 0;
        for (ChecklistItem item : template) {
            if (Boolean.TRUE.equals(checks.get(item.id()))) {
                score += item.weight();
            }
        }

        InspectionChecklist record = checklists.findByInspectionId(id).orElseGet(InspectionChecklist::new);
        record.setInspectionId(id);
        record.setScheme(scheme.toUpperCase());
        record.setChecks(checks);
        record.setComplianceScore(score);
        record.setVoiceRemarks(body.voiceRemarks());
        record.setUpdatedAt(Instant.now());
        InspectionChecklist saved = checklists.save(record);

        audit.record(current, "checklist.submitted", "inspection", id,
                Map.of("scheme", scheme,
                        "compliance_score", String.valueOf(score),
                        "voice_remarks_present", String.valueOf(body.voiceRemarks() != null)));

        return Map.of("message", "Scheme checklist saved", "record", saved);
    }

    /* ---------------------------------------------------------------- helpers */

    private String schemeFor(Inspection inspection) {
        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        String department = project == null ? null : project.getDepartment();
        String scheme = (department == null ? DEFAULT_SCHEME : department).toLowerCase();
        return SCHEME_CHECKLISTS.containsKey(scheme) ? scheme : DEFAULT_SCHEME;
    }

    private static List<ChecklistItem> templateFor(String scheme) {
        return SCHEME_CHECKLISTS.getOrDefault(scheme, SCHEME_CHECKLISTS.get(DEFAULT_SCHEME));
    }

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
