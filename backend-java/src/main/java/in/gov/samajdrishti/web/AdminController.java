package in.gov.samajdrishti.web;

import in.gov.samajdrishti.config.AppProperties;
import in.gov.samajdrishti.domain.AuditEntry;
import in.gov.samajdrishti.domain.Camera;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.repository.AuditRepository;
import in.gov.samajdrishti.repository.CameraRepository;
import in.gov.samajdrishti.repository.EvidenceRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.AiEngineClient;
import in.gov.samajdrishti.service.AuditService;
import in.gov.samajdrishti.service.NotificationService;
import in.gov.samajdrishti.web.dto.Requests;
import java.math.BigDecimal;
import java.time.format.DateTimeParseException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Back-office dashboard, AI insights, risk-weighted assignment and the alert feed. */
@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
public class AdminController {

    private final ProjectRepository projects;
    private final InspectionRepository inspections;
    private final EvidenceRepository evidence;
    private final CameraRepository cameras;
    private final UserRepository users;
    private final AuditRepository audit;
    private final ReportController reportController;
    private final AiEngineClient ai;
    private final AuditService auditService;
    private final NotificationService notifications;
    private final AppProperties properties;

    public AdminController(ProjectRepository projects,
                           InspectionRepository inspections,
                           EvidenceRepository evidence,
                           CameraRepository cameras,
                           UserRepository users,
                           AuditRepository audit,
                           ReportController reportController,
                           AiEngineClient ai,
                           AuditService auditService,
                           NotificationService notifications,
                           AppProperties properties) {
        this.projects = projects;
        this.inspections = inspections;
        this.evidence = evidence;
        this.cameras = cameras;
        this.users = users;
        this.audit = audit;
        this.reportController = reportController;
        this.ai = ai;
        this.auditService = auditService;
        this.notifications = notifications;
        this.properties = properties;
    }

    /* -------------------------------------------------------------- dashboard */

    @GetMapping("/dashboard")
    @Transactional(readOnly = true)
    public Map<String, Object> dashboard() {
        List<Project> allProjects = projects.findAll();
        List<Inspection> allInspections = inspections.findAll();
        List<User> officials = users.findByRoleOrderByIdAsc("official");

        List<Map<String, Object>> scored = withRiskScores(allProjects, allInspections);
        List<Map<String, Object>> aiStatInput = scored.stream().map(p -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", p.get("id"));
            row.put("name", p.get("name"));
            row.put("risk_score", p.get("risk_score"));
            return row;
        }).toList();
        Map<String, Object> aiStats = ai.dashboardStats(aiStatInput);

        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("totalProjects", allProjects.size());
        stats.put("totalInspections", allInspections.size());
        stats.put("totalEvidence", evidence.count());
        stats.put("totalOfficials", officials.size());
        stats.put("pendingInspections", count(allInspections, "pending"));
        stats.put("inProgressInspections", count(allInspections, "in_progress"));
        stats.put("completedInspections", count(allInspections, "completed"));
        stats.put("flaggedInspections", count(allInspections, "flagged"));
        stats.put("dataMode", properties.dataMode());
        stats.put("aiOnline", aiStats != null && aiStats.get("total_projects") != null);
        stats.put("aiStats", aiStats != null ? aiStats : Map.of(
                "high_risk_count", 0,
                "medium_risk_count", 0,
                "low_risk_count", 0,
                "average_risk_score", 0,
                "recommendations", List.of()));

        Map<Integer, Project> projectsById = allProjects.stream()
                .collect(Collectors.toMap(Project::getId, p -> p, (a, b) -> a));
        Map<Integer, User> officialsById = officials.stream()
                .collect(Collectors.toMap(User::getId, u -> u, (a, b) -> a));

        List<Map<String, Object>> recent = new ArrayList<>();
        for (Inspection inspection : newestFirst(allInspections).stream().limit(10).toList()) {
            Project project = projectsById.get(inspection.getProjectId());
            User official = officialsById.get(inspection.getAssignedTo());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", inspection.getId());
            row.put("project_id", inspection.getProjectId());
            row.put("assigned_to", inspection.getAssignedTo());
            row.put("status", inspection.getStatus());
            row.put("scheduled_date", inspection.getScheduledDate());
            row.put("completed_date", inspection.getCompletedDate());
            row.put("ai_risk_score", inspection.getAiRiskScore());
            row.put("notes", inspection.getNotes());
            row.put("created_at", inspection.getCreatedAt());
            row.put("project_name", project == null ? null : project.getName());
            row.put("official_name", official == null ? null : official.getName());
            recent.add(row);
        }

        List<Map<String, Object>> highRisk = scored.stream()
                .sorted(Comparator.comparingDouble((Map<String, Object> p) -> number(p.get("risk_score"))).reversed())
                .limit(6)
                .map(p -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", p.get("id"));
                    row.put("name", p.get("name"));
                    row.put("location", p.get("location"));
                    row.put("status", p.get("status"));
                    row.put("budget", p.get("budget"));
                    row.put("risk_score", p.get("risk_score"));
                    row.put("risk_factors", p.get("risk_factors"));
                    return row;
                })
                .toList();

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("stats", stats);
        body.put("recentInspections", recent);
        body.put("highRiskProjects", highRisk);
        body.put("projects", scored);
        body.put("officials", officials);
        return body;
    }

    @GetMapping("/ai/insights")
    @Transactional(readOnly = true)
    public Map<String, Object> insights() {
        List<Map<String, Object>> batch = new ArrayList<>();
        for (Inspection inspection : inspections.findAllByOrderByCreatedAtDesc().stream().limit(100).toList()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", inspection.getId());
            row.put("project_id", inspection.getProjectId());
            row.put("assigned_to", inspection.getAssignedTo());
            row.put("status", inspection.getStatus());
            row.put("scheduled_date", inspection.getScheduledDate());
            row.put("completed_date", inspection.getCompletedDate());
            row.put("ai_risk_score", inspection.getAiRiskScore());
            batch.add(row);
        }
        return Map.of("anomalies", ai.detectAnomalies(batch));
    }

    @GetMapping("/ai/status")
    public Map<String, Object> aiStatus() {
        return Map.of("aiEngine", ai.health(), "dataMode", properties.dataMode());
    }

    @GetMapping("/ai/narrative")
    @Transactional(readOnly = true)
    public Map<String, Object> narrative(@RequestParam(required = false) String tone) {
        String requested = List.of("executive", "field", "technical").contains(tone) ? tone : "executive";
        Map<String, Object> context = buildNarrativeContext();
        Map<String, Object> generated = ai.narrative(context, requested);

        Map<String, Object> body = new LinkedHashMap<>();
        if (generated != null && generated.get("narrative") != null) {
            body.put("narrative", generated.get("narrative"));
            body.put("provider", generated.getOrDefault("provider", "local-fallback"));
            body.put("model", generated.get("model"));
        } else {
            body.put("narrative", localNarrative(context));
            body.put("provider", "local-fallback");
            body.put("model", null);
        }
        body.put("generated_at", generated == null || generated.get("generated_at") == null
                ? Instant.now().toString()
                : generated.get("generated_at"));
        body.put("tone", requested);
        body.put("data", context);
        return body;
    }

    /**
     * Risk-weighted random assignment.
     *
     * <p>The generated plan is persisted as real pending inspections so field officials
     * see it in the app, and each official is notified.
     */
    @PostMapping("/ai/assign")
    @Transactional
    public Map<String, Object> assign(@RequestBody(required = false) Requests.AiAssignment body) {
        int requested = body == null || body.numInspections() == null ? 5 : body.numInspections();
        boolean persist = body == null || body.persist() == null || body.persist();

        List<Project> allProjects = projects.findAll();
        List<Inspection> allInspections = inspections.findAll();
        List<User> officials = users.findByRoleOrderByIdAsc("official");
        if (allProjects.isEmpty() || officials.isEmpty()) {
            throw ApiException.badRequest("Projects and officials are required for AI assignment");
        }

        List<Map<String, Object>> scored = withRiskScores(allProjects, allInspections);
        List<Map<String, Object>> officialRows = officials.stream().map(u -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", u.getId());
            row.put("name", u.getName());
            row.put("role", u.getRole());
            return row;
        }).toList();

        List<Map<String, Object>> assignments = ai.assignInspections(scored, officialRows, requested);
        if (assignments.isEmpty()) {
            throw ApiException.badGateway("AI engine unavailable - no assignments generated");
        }

        List<Integer> created = new ArrayList<>();
        if (persist) {
            for (Map<String, Object> assignment : assignments) {
                Integer projectId = intOf(assignment.get("project_id"));
                Integer officialId = intOf(assignment.get("official_id"));

                Inspection inspection = new Inspection();
                inspection.setProjectId(projectId);
                inspection.setAssignedTo(officialId);
                inspection.setScheduledDate(toLocalDate(assignment.get("scheduled_date")));
                inspection.setAiRiskScore(toBigDecimal(assignment.get("ai_risk_score")));
                inspection.setStatus("pending");
                inspection.setCreatedAt(Instant.now());
                created.add(inspections.save(inspection).getId());

                String projectName = assignment.get("project_name") == null
                        ? "Project #" + projectId
                        : String.valueOf(assignment.get("project_name"));
                double riskScore = number(assignment.get("ai_risk_score"));
                notifications.create(officialId,
                        "New inspection assigned: %s on %s at %s."
                                .formatted(projectName, assignment.get("scheduled_date"),
                                        assignment.getOrDefault("scheduled_time", "")),
                        riskScore > 70 ? "alert" : "info");
            }
        }

        List<Map<String, Object>> enriched = new ArrayList<>();
        for (int i = 0; i < assignments.size(); i++) {
            Map<String, Object> row = new LinkedHashMap<>(assignments.get(i));
            row.put("inspection_id", i < created.size() ? created.get(i) : null);
            enriched.add(row);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("assignments", enriched);
        result.put("persisted", persist);
        result.put("created", created.size());
        return result;
    }

    /** Cross-module alert feed for the back office. */
    @GetMapping("/alerts")
    @Transactional(readOnly = true)
    public Map<String, Object> alerts() {
        List<Map<String, Object>> alerts = new ArrayList<>();

        for (Map<String, Object> report : reportController.buildAllReports()) {
            @SuppressWarnings("unchecked")
            List<String> flags = (List<String>) report.getOrDefault("flags", List.of());
            if (flags.isEmpty()) {
                continue;
            }
            Object project = report.get("project");
            Object verification = report.get("geo_verification");
            String verdict = verification instanceof Map<?, ?> map ? String.valueOf(map.get("verdict")) : "unknown";
            Object distance = verification instanceof Map<?, ?> map ? map.get("distance_meters") : null;
            String projectName = project instanceof Map<?, ?> map && map.get("name") != null
                    ? String.valueOf(map.get("name"))
                    : "project";

            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("inspection_id", report.get("id"));
            meta.put("geo_verdict", verdict);
            meta.put("distance_meters", distance);
            alerts.add(alert("suspicious".equals(verdict) ? "high" : "medium",
                    "report_" + verdict,
                    "Inspection #%s (%s): %s".formatted(report.get("id"), projectName, String.join(", ", flags)),
                    meta));
        }

        for (Camera camera : cameras.findAll()) {
            if ("online".equals(camera.getStatus())) {
                continue;
            }
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("camera_id", camera.getId());
            meta.put("name", camera.getName());
            meta.put("last_seen", camera.getLastSeen());
            alerts.add(alert("medium", "camera_offline", "A site camera is offline", meta));
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("alerts", alerts);
        body.put("total", alerts.size());
        body.put("generated_at", Instant.now().toString());
        return body;
    }

    /* ---------------------------------------------------------------- helpers */

    private static Map<String, Object> alert(String severity, String type, String message,
                                             Map<String, Object> meta) {
        Map<String, Object> alert = new LinkedHashMap<>();
        alert.put("severity", severity);
        alert.put("type", type);
        alert.put("message", message);
        alert.put("meta", meta);
        return alert;
    }

    private static List<Inspection> newestFirst(List<Inspection> rows) {
        List<Inspection> copy = new ArrayList<>(rows);
        copy.sort(Comparator.comparing(
                (Inspection i) -> i.getCreatedAt() == null ? Instant.EPOCH : i.getCreatedAt(),
                Comparator.reverseOrder()));
        return copy;
    }

    private static long count(List<Inspection> rows, String status) {
        return rows.stream().filter(i -> status.equals(i.getStatus())).count();
    }

    private static double number(Object value) {
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        try {
            return value == null ? 0d : Double.parseDouble(String.valueOf(value));
        } catch (NumberFormatException e) {
            return 0d;
        }
    }

    private static Integer intOf(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.valueOf(text.strip());
            } catch (NumberFormatException e) {
                return null;
            }
        }
        return null;
    }

    private static LocalDate toLocalDate(Object value) {
        if (value instanceof LocalDate date) {
            return date;
        }
        if (value == null) {
            return null;
        }
        try {
            return LocalDate.parse(String.valueOf(value).strip());
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static BigDecimal toBigDecimal(Object value) {
        if (value instanceof BigDecimal decimal) {
            return decimal;
        }
        try {
            return value == null ? null : new BigDecimal(String.valueOf(value));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * The payload the AI engine's risk scorer reasons over: budget, location,
     * department and the project's own inspection history.
     */
    private static List<Map<String, Object>> riskPayload(List<Project> projectList,
                                                         List<Inspection> inspectionList) {
        Map<Integer, List<Map<String, Object>>> historyByProject = new LinkedHashMap<>();
        for (Inspection inspection : inspectionList) {
            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("date", inspection.getCompletedDate() != null
                    ? inspection.getCompletedDate()
                    : inspection.getScheduledDate());
            entry.put("status", inspection.getStatus());
            historyByProject.computeIfAbsent(inspection.getProjectId(), key -> new ArrayList<>()).add(entry);
        }

        List<Map<String, Object>> payload = new ArrayList<>();
        for (Project project : projectList) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", project.getId());
            row.put("name", project.getName());
            row.put("budget", project.getBudget() == null ? 0d : project.getBudget().doubleValue());
            row.put("location", project.getLocation() == null ? "" : project.getLocation());
            row.put("department", project.getDepartment() == null ? "" : project.getDepartment());
            row.put("inspection_history", historyByProject.getOrDefault(project.getId(), List.of()));
            payload.add(row);
        }
        return payload;
    }

    /** Attaches an AI risk score to every project (flat 50 when the engine is down). */
    private List<Map<String, Object>> withRiskScores(List<Project> projectList, List<Inspection> inspectionList) {
        List<Map<String, Object>> scores = ai.scoreProjectsBatch(riskPayload(projectList, inspectionList));
        Map<Object, Map<String, Object>> byProject = new LinkedHashMap<>();
        for (Map<String, Object> score : scores) {
            byProject.put(score.get("project_id"), score);
        }

        List<Map<String, Object>> result = new ArrayList<>();
        for (Project project : projectList) {
            Map<String, Object> score = byProject.get(project.getId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", project.getId());
            row.put("name", project.getName());
            row.put("description", project.getDescription());
            row.put("location", project.getLocation());
            row.put("department", project.getDepartment());
            row.put("geo_coords", project.getGeoCoords());
            row.put("start_date", project.getStartDate());
            row.put("end_date", project.getEndDate());
            row.put("budget", project.getBudget());
            row.put("status", project.getStatus());
            row.put("created_at", project.getCreatedAt());
            row.put("risk_score", score == null || score.get("risk_score") == null ? 50d : score.get("risk_score"));
            row.put("risk_factors", score == null || score.get("factors") == null ? List.of() : score.get("factors"));
            result.add(row);
        }
        return result;
    }

    private Map<String, Object> buildNarrativeContext() {
        List<Project> allProjects = projects.findAll();
        List<Inspection> allInspections = inspections.findAll();
        List<Map<String, Object>> scored = withRiskScores(allProjects, allInspections);
        List<Camera> cameraList = cameras.findAll();
        List<User> officials = users.findByRoleOrderByIdAsc("official");

        Map<String, Long> byStatus = new LinkedHashMap<>();
        allInspections.forEach(i -> byStatus.merge(
                i.getStatus() == null ? "unknown" : i.getStatus(), 1L, Long::sum));

        Map<String, Long> geoCounts = new LinkedHashMap<>();
        for (AuditEntry row : auditService.list("inspection", null, 500)) {
            if (row.getAction() != null && row.getAction().startsWith("geo_verification")) {
                String verdict = row.getAction().substring(row.getAction().lastIndexOf('.') + 1);
                geoCounts.merge(verdict, 1L, Long::sum);
            }
        }

        List<Map<String, Object>> anomalyBatch = new ArrayList<>();
        for (Inspection inspection : allInspections) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", inspection.getId());
            row.put("status", inspection.getStatus());
            row.put("scheduled_date", inspection.getScheduledDate());
            row.put("completed_date", inspection.getCompletedDate());
            row.put("assigned_to", inspection.getAssignedTo());
            row.put("ai_risk_score", inspection.getAiRiskScore());
            anomalyBatch.add(row);
        }

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("projects", allProjects.size());
        totals.put("inspections", allInspections.size());
        totals.put("evidence", evidence.count());
        totals.put("officials", officials.size());
        totals.put("cameras", cameraList.size());
        totals.put("cameras_online", cameraList.stream().filter(c -> "online".equals(c.getStatus())).count());
        totals.put("cameras_offline", cameraList.stream().filter(c -> !"online".equals(c.getStatus())).count());

        List<Map<String, Object>> highestRisk = scored.stream()
                .sorted(Comparator.comparingDouble((Map<String, Object> p) -> number(p.get("risk_score"))).reversed())
                .limit(5)
                .map(p -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("name", p.get("name"));
                    row.put("location", p.get("location"));
                    row.put("budget", p.get("budget"));
                    row.put("risk_score", p.get("risk_score"));
                    row.put("factors", p.get("risk_factors"));
                    return row;
                })
                .toList();

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("department", "Ministry of Social Justice & Empowerment");
        context.put("totals", totals);
        context.put("inspections_by_status", byStatus);
        context.put("geo_verification", geoCounts);
        context.put("highest_risk_projects", highestRisk);
        context.put("anomalies", ai.detectAnomalies(anomalyBatch));
        return context;
    }

    /** Deterministic summary used when the LLM provider is unavailable. */
    @SuppressWarnings("unchecked")
    private static String localNarrative(Map<String, Object> context) {
        Map<String, Object> totals = (Map<String, Object>) context.getOrDefault("totals", Map.of());
        Map<String, Object> byStatus =
                (Map<String, Object>) context.getOrDefault("inspections_by_status", Map.of());
        Map<String, Object> geo = (Map<String, Object>) context.getOrDefault("geo_verification", Map.of());
        List<Map<String, Object>> risky =
                (List<Map<String, Object>>) context.getOrDefault("highest_risk_projects", List.of());

        List<String> parts = new ArrayList<>();
        int projectCount = intOf(totals.getOrDefault("projects", 0));
        int inspectionCount = intOf(totals.getOrDefault("inspections", 0));
        if (projectCount > 0) {
            parts.add("%d projects are under monitoring with %d inspections (%s completed, %s pending, %s flagged)."
                    .formatted(projectCount, inspectionCount,
                            byStatus.getOrDefault("completed", 0),
                            byStatus.getOrDefault("pending", 0),
                            byStatus.getOrDefault("flagged", 0)));
        }
        int cameraTotal = intOf(totals.getOrDefault("cameras", 0));
        if (cameraTotal > 0) {
            int offline = intOf(totals.getOrDefault("cameras_offline", 0));
            parts.add("%s of %s site cameras are online%s."
                    .formatted(totals.getOrDefault("cameras_online", 0), cameraTotal,
                            offline > 0 ? ", " + offline + " offline and need attention" : ""));
        }
        if (!risky.isEmpty()) {
            Map<String, Object> top = risky.get(0);
            List<Map<String, Object>> factors = (List<Map<String, Object>>) top.getOrDefault("factors", List.of());
            String drivers = factors.stream()
                    .map(f -> String.valueOf(f.get("factor")))
                    .filter(s -> !s.isBlank() && !"null".equals(s))
                    .reduce((a, b) -> a + ", " + b)
                    .orElse("");
            parts.add("Highest risk is %s at %s/100%s."
                    .formatted(top.get("name"), top.get("risk_score"),
                            drivers.isEmpty() ? "" : ", driven by " + drivers));
        }
        int suspicious = intOf(geo.getOrDefault("suspicious", 0));
        if (suspicious > 0) {
            parts.add("%d geo-verification failure(s) were detected, which is the strongest available "
                    .formatted(suspicious) + "signal of proxy or fake reporting.");
        } else {
            parts.add("No geo-verification failures are currently on record.");
        }
        return String.join(" ", parts);
    }
}
