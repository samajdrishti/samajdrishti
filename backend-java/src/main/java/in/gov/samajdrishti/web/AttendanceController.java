package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.Attendance;
import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.repository.AttendanceRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.AiEngineClient;
import in.gov.samajdrishti.service.AuditService;
import in.gov.samajdrishti.service.GeoService;
import in.gov.samajdrishti.web.dto.Requests;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    /** A check-in further than this from the claimed project is refused outright. */
    private static final double PUNCH_TOLERANCE_M = 250;
    private static final int REVIEW_WINDOW_DAYS = 14;
    private static final int LATE_AFTER_MINUTES = 9 * 60 + 30;

    private final AttendanceRepository attendance;
    private final UserRepository users;
    private final ProjectRepository projects;
    private final GeoService geo;
    private final AuditService audit;
    private final AiEngineClient ai;

    public AttendanceController(AttendanceRepository attendance,
                                UserRepository users,
                                ProjectRepository projects,
                                GeoService geo,
                                AuditService audit,
                                AiEngineClient ai) {
        this.attendance = attendance;
        this.users = users;
        this.projects = projects;
        this.geo = geo;
        this.audit = audit;
        this.ai = ai;
    }

    private record Lookups(Map<Integer, User> usersById, Map<Integer, Project> projectsById) {
    }

    private Lookups lookups() {
        Map<Integer, User> usersById = new LinkedHashMap<>();
        users.findAll().forEach(u -> usersById.put(u.getId(), u));
        Map<Integer, Project> projectsById = new LinkedHashMap<>();
        projects.findAll().forEach(p -> projectsById.put(p.getId(), p));
        return new Lookups(usersById, projectsById);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(@RequestParam(required = false) Integer officialId,
                                          @RequestParam(required = false) Integer projectId,
                                          @RequestParam(required = false) String from,
                                          @RequestParam(required = false) String to,
                                          @RequestParam(required = false) Integer limit) {
        Lookups lookups = lookups();
        LocalDate fromDate = parseDate(from);
        LocalDate toDate = parseDate(to);

        List<Attendance> rows = new ArrayList<>();
        for (Attendance record : attendance.findAllByOrderByIdDesc()) {
            if (officialId != null && !officialId.equals(record.getOfficialId())) {
                continue;
            }
            if (projectId != null && !projectId.equals(record.getProjectId())) {
                continue;
            }
            if (fromDate != null && (record.getDate() == null || record.getDate().isBefore(fromDate))) {
                continue;
            }
            if (toDate != null && (record.getDate() == null || record.getDate().isAfter(toDate))) {
                continue;
            }
            rows.add(record);
            if (rows.size() >= (limit == null ? 100 : Math.min(limit, 500))) {
                break;
            }
        }
        return rows.stream().map(row -> enrich(row, lookups)).toList();
    }

    @PostMapping("/check-in")
    @Transactional
    public ResponseEntity<Map<String, Object>> checkIn(@RequestBody Requests.AttendancePunch body,
                                                       @AuthenticationPrincipal AuthPrincipal current) {
        Map<String, Object> result = punch("check_in", body, current);
        return ResponseEntity.status(201).body(result);
    }

    @PostMapping("/check-out")
    @Transactional
    public ResponseEntity<Map<String, Object>> checkOut(@RequestBody Requests.AttendancePunch body,
                                                        @AuthenticationPrincipal AuthPrincipal current) {
        return ResponseEntity.ok(punch("check_out", body, current));
    }

    private Map<String, Object> punch(String action, Requests.AttendancePunch body, AuthPrincipal current) {
        Integer officialId = "official".equals(current.role()) ? current.id() : body.officialId();
        if (officialId == null) {
            throw ApiException.badRequest("official_id is required");
        }

        Attendance open = attendance.findLatestOpenPunch(officialId).orElse(null);
        GeoPoint observed = GeoPoint.of(body.lat(), body.lng());

        if ("check_out".equals(action)) {
            if (open == null) {
                throw ApiException.badRequest("No open check-in found to close");
            }
            open.setCheckOut(Instant.now());
            if (observed != null) {
                open.setGeoCoords(observed);
            }
            Attendance saved = attendance.save(open);
            audit.record(current, "attendance.checked_out", "attendance", saved.getId(),
                    Map.of("project_id", String.valueOf(saved.getProjectId())));
            return enrich(saved, lookups());
        }

        if (open != null) {
            throw ApiException.badRequest("You already have an open check-in. Check out first.");
        }

        // Geo-fence: refuse a check-in far from the project being claimed.
        if (body.projectId() != null) {
            Project project = projects.findById(body.projectId()).orElse(null);
            Map<String, Object> verdict = geo.verify(
                    project == null ? null : GeoService.normalise(project.getGeoCoords()),
                    observed,
                    PUNCH_TOLERANCE_M);
            if ("suspicious".equals(verdict.get("verdict"))) {
                audit.record(current, "attendance.geo_rejected", "project", body.projectId(),
                        String.valueOf(verdict.get("explanation")));
                throw new ApiException(400,
                        "Check-in rejected: " + verdict.get("explanation"),
                        Map.of("geo_verification", verdict));
            }
        }

        Attendance record = new Attendance();
        record.setOfficialId(officialId);
        record.setProjectId(body.projectId());
        record.setCheckIn(Instant.now());
        record.setGeoCoords(observed);
        record.setDevice(body.device());
        record.setMode(body.mode() == null || body.mode().isBlank() ? "gps" : body.mode());
        record.setDate(LocalDate.now(ZoneId.systemDefault()));
        record.setCreatedAt(Instant.now());
        Attendance saved = attendance.save(record);

        audit.record(current, "attendance.checked_in", "attendance", saved.getId(),
                Map.of("project_id", String.valueOf(saved.getProjectId()), "mode", saved.getMode()));
        return enrich(saved, lookups());
    }

    @GetMapping("/summary")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Transactional(readOnly = true)
    public Map<String, Object> summary() {
        Lookups lookups = lookups();
        List<Attendance> all = attendance.findAllByOrderByIdDesc();
        LocalDate today = LocalDate.now(ZoneId.systemDefault());

        List<Map<String, Object>> aggregates = new ArrayList<>();
        for (User official : users.findByRoleOrderByIdAsc("official")) {
            Map<LocalDate, Map<String, Object>> byDate = new LinkedHashMap<>();
            for (Attendance record : all) {
                if (!Objects.equals(record.getOfficialId(), official.getId()) || record.getDate() == null) {
                    continue;
                }
                Map<String, Object> day = byDate.computeIfAbsent(record.getDate(), key -> dayBucket());
                if (record.getCheckIn() != null && day.get("check_in") == null) {
                    day.put("check_in", record.getCheckIn());
                }
                if (record.getCheckOut() != null) {
                    day.put("check_out", record.getCheckOut());
                }
                if (record.getGeoCoords() != null) {
                    day.put("coords", record.getGeoCoords());
                }
                if (record.getProjectId() != null) {
                    day.put("project_id", record.getProjectId());
                }
            }

            int presentDays = 0;
            int lateDays = 0;
            int missingPunches = 0;
            int geoMismatches = 0;
            for (Map<String, Object> day : byDate.values()) {
                Instant checkIn = (Instant) day.get("check_in");
                Instant checkOut = (Instant) day.get("check_out");
                if (checkIn != null) {
                    presentDays++;
                    if (minutesOfDay(checkIn) > LATE_AFTER_MINUTES) {
                        lateDays++;
                    }
                }
                if ((checkIn != null) != (checkOut != null)) {
                    missingPunches++;
                }
                GeoPoint coords = (GeoPoint) day.get("coords");
                Integer projectId = (Integer) day.get("project_id");
                Project project = projectId == null ? null : lookups.projectsById().get(projectId);
                if (coords != null && project != null
                        && "suspicious".equals(geo.verify(
                                GeoService.normalise(project.getGeoCoords()), coords, 500).get("verdict"))) {
                    geoMismatches++;
                }
            }

            Map<String, Object> row = new LinkedHashMap<>();
            row.put("official_id", official.getId());
            row.put("name", official.getName());
            row.put("department", official.getDepartment());
            row.put("days_present", presentDays);
            row.put("absent_days", Math.max(0, REVIEW_WINDOW_DAYS - presentDays));
            row.put("late_days", lateDays);
            row.put("missing_punches", missingPunches);
            row.put("geo_mismatches", geoMismatches);
            row.put("punctuality_pct",
                    presentDays == 0 ? 0 : Math.round((double) (presentDays - lateDays) / presentDays * 100));
            Map<String, Object> todayBucket = byDate.get(today);
            row.put("checked_in_today", todayBucket != null && todayBucket.get("check_in") != null);
            aggregates.add(row);
        }

        Map<String, Object> totals = new LinkedHashMap<>();
        totals.put("officials", aggregates.size());
        totals.put("present_today", aggregates.stream().filter(a -> Boolean.TRUE.equals(a.get("checked_in_today"))).count());
        totals.put("late_days", aggregates.stream().mapToLong(a -> (Integer) a.get("late_days")).sum());
        totals.put("geo_mismatches", aggregates.stream().mapToLong(a -> (Integer) a.get("geo_mismatches")).sum());

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("officials", aggregates);
        response.put("totals", totals);
        return response;
    }

    /** Attendance irregularities computed by the AI engine. */
    @GetMapping("/anomalies")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Transactional(readOnly = true)
    public Map<String, Object> anomalies() {
        Lookups lookups = lookups();
        List<Map<String, Object>> records = new ArrayList<>();
        for (Attendance row : attendance.findAllByOrderByIdDesc()) {
            Project project = row.getProjectId() == null ? null : lookups.projectsById().get(row.getProjectId());
            GeoPoint projectCoords = project == null ? null : GeoService.normalise(project.getGeoCoords());
            GeoPoint coords = GeoService.normalise(row.getGeoCoords());

            Map<String, Object> record = new LinkedHashMap<>();
            record.put("official_id", row.getOfficialId());
            record.put("date", row.getDate());
            record.put("check_in", row.getCheckIn());
            record.put("check_out", row.getCheckOut());
            record.put("project_id", row.getProjectId());
            record.put("project_lat", projectCoords == null ? null : projectCoords.getLat());
            record.put("project_lng", projectCoords == null ? null : projectCoords.getLng());
            record.put("lat", coords == null ? null : coords.getLat());
            record.put("lng", coords == null ? null : coords.getLng());
            records.add(record);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("irregularities", ai.analyzeAttendance(records));
        response.put("records_analyzed", records.size());
        return response;
    }

    /* ---------------------------------------------------------------- helpers */

    private static Map<String, Object> dayBucket() {
        Map<String, Object> day = new LinkedHashMap<>();
        day.put("check_in", null);
        day.put("check_out", null);
        day.put("coords", null);
        day.put("project_id", null);
        return day;
    }

    private static int minutesOfDay(Instant instant) {
        ZonedDateTime local = instant.atZone(ZoneId.systemDefault());
        return local.getHour() * 60 + local.getMinute();
    }

    private static Map<String, Object> enrich(Attendance row, Lookups lookups) {
        User official = lookups.usersById().get(row.getOfficialId());
        Project project = lookups.projectsById().get(row.getProjectId());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", row.getId());
        body.put("official_id", row.getOfficialId());
        body.put("project_id", row.getProjectId());
        body.put("check_in", row.getCheckIn());
        body.put("check_out", row.getCheckOut());
        body.put("geo_coords", GeoService.normalise(row.getGeoCoords()));
        body.put("device", row.getDevice());
        body.put("mode", row.getMode());
        body.put("date", row.getDate());
        body.put("created_at", row.getCreatedAt());
        body.put("official_name", official == null ? null : official.getName());
        body.put("project_name", project == null ? null : project.getName());
        return body;
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.strip());
        } catch (RuntimeException e) {
            return null;
        }
    }
}
