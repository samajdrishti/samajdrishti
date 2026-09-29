package in.gov.samajdrishti.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.domain.Attendance;
import in.gov.samajdrishti.domain.AuditEntry;
import in.gov.samajdrishti.domain.Evidence;
import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.repository.AttendanceRepository;
import in.gov.samajdrishti.repository.AuditRepository;
import in.gov.samajdrishti.repository.EvidenceRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.repository.UserRepository;

/**
 * Geo-tagged inspection reports.
 *
 * <p>A report is assembled at read time from the inspection, its evidence, the
 * attendance record of the official and the audit trail, then annotated with the flags a
 * supervisor actually acts on: proxy reporting, unverified evidence, early completion.
 */
@Service
public class ReportService {

    private static final List<String> TERMINAL_WITHOUT_EVIDENCE = List.of("completed", "flagged");

    private final ProjectRepository projects;
    private final UserRepository users;
    private final InspectionRepository inspections;
    private final EvidenceRepository evidence;
    private final AuditRepository audit;
    private final AttendanceRepository attendance;
    private final GeoService geo;

    public ReportService(ProjectRepository projects,
                         UserRepository users,
                         InspectionRepository inspections,
                         EvidenceRepository evidence,
                         AuditRepository audit,
                         AttendanceRepository attendance,
                         GeoService geo) {
        this.projects = projects;
        this.users = users;
        this.inspections = inspections;
        this.evidence = evidence;
        this.audit = audit;
        this.attendance = attendance;
        this.geo = geo;
    }

    /** Everything a report needs, loaded once so a list of N reports is not N queries. */
    public record Context(Map<Integer, Project> projectsById,
                          Map<Integer, User> usersById,
                          List<Inspection> inspections,
                          List<Evidence> evidence,
                          List<AuditEntry> auditRows,
                          List<Attendance> attendance) {
    }

    @Transactional(readOnly = true)
    public Context loadContext() {
        Map<Integer, Project> projectsById = projects.findAll().stream()
                .collect(Collectors.toMap(Project::getId, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        Map<Integer, User> usersById = users.findAll().stream()
                .collect(Collectors.toMap(User::getId, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        return new Context(
                projectsById,
                usersById,
                inspections.findAll(),
                evidence.findAll(),
                audit.findByEntityOrderByIdDesc("inspection"),
                attendance.findAllByOrderByIdDesc());
    }

    public Map<String, Object> buildReport(Inspection inspection, Context context) {
        Project project = context.projectsById().get(inspection.getProjectId());
        User official = context.usersById().get(inspection.getAssignedTo());
        User supervisor = context.usersById().get(inspection.getSupervisorId());

        List<Evidence> evidenceRows = context.evidence().stream()
                .filter(e -> Objects.equals(e.getInspectionId(), inspection.getId()))
                .toList();
        List<AuditEntry> geoAudit = context.auditRows().stream()
                .filter(row -> Objects.equals(row.getEntityId(), inspection.getId()))
                .toList();

        Map<String, Object> verification = resolveGeoVerification(inspection, project, evidenceRows, geoAudit);
        List<Attendance> sameDayPunches = context.attendance().stream()
                .filter(a -> Objects.equals(a.getOfficialId(), inspection.getAssignedTo()))
                .filter(a -> a.getDate() != null && a.getDate().equals(inspection.getScheduledDate()))
                .toList();

        Map<String, Object> report = new LinkedHashMap<>();
        report.put("id", inspection.getId());
        report.put("status", inspection.getStatus());
        report.put("scheduled_date", inspection.getScheduledDate());
        report.put("completed_date", inspection.getCompletedDate());
        report.put("notes", inspection.getNotes());
        report.put("ai_risk_score", inspection.getAiRiskScore());
        report.put("created_at", inspection.getCreatedAt());
        report.put("project", project == null ? null : projectSummary(project));
        report.put("official", official == null ? null : officialSummary(official));
        report.put("supervisor", supervisor == null ? null
                : Map.of("id", supervisor.getId(), "name", supervisor.getName()));
        report.put("evidence", evidenceRows);
        report.put("evidence_count", evidenceRows.size());
        report.put("verified_evidence_count", evidenceRows.stream().filter(Evidence::isVerified).count());
        report.put("geo_verification", verification);
        report.put("flags", buildFlags(inspection, verification, evidenceRows, project));
        report.put("attendance_context", sameDayPunches.stream()
                .map(a -> {
                    Map<String, Object> punch = new LinkedHashMap<>();
                    punch.put("date", a.getDate());
                    punch.put("check_in", a.getCheckIn());
                    punch.put("check_out", a.getCheckOut());
                    punch.put("mode", a.getMode());
                    return punch;
                })
                .toList());
        report.put("audit", geoAudit.stream()
                .map(a -> {
                    Map<String, Object> entry = new LinkedHashMap<>();
                    entry.put("action", a.getAction());
                    entry.put("actor", a.getActorName());
                    entry.put("at", a.getCreatedAt());
                    entry.put("meta", a.getMeta());
                    return entry;
                })
                .toList());
        return report;
    }

    private static Map<String, Object> projectSummary(Project project) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("id", project.getId());
        summary.put("name", project.getName());
        summary.put("location", project.getLocation());
        summary.put("department", project.getDepartment());
        summary.put("budget", project.getBudget());
        summary.put("status", project.getStatus());
        summary.put("geo_coords", GeoService.normalise(project.getGeoCoords()));
        return summary;
    }

    private static Map<String, Object> officialSummary(User official) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("id", official.getId());
        summary.put("name", official.getName());
        summary.put("department", official.getDepartment());
        return summary;
    }

    /**
     * A verdict recorded when the official reported the status is authoritative;
     * otherwise the fallback is wherever the evidence itself was captured.
     */
    @SuppressWarnings("unchecked")
    private Map<String, Object> resolveGeoVerification(Inspection inspection,
                                                      Project project,
                                                      List<Evidence> evidenceRows,
                                                      List<AuditEntry> auditRows) {
        for (AuditEntry row : auditRows) {
            if (row.getAction() != null && row.getAction().startsWith("geo_verification")) {
                Object meta = row.getMeta();
                if (meta instanceof Map<?, ?> map) {
                    Map<String, Object> verdict = new LinkedHashMap<>((Map<String, Object>) map);
                    verdict.put("source", "status_update");
                    return verdict;
                }
            }
        }
        if (!evidenceRows.isEmpty()) {
            GeoPoint captured = evidenceRows.get(0).getGeoCoords();
            Map<String, Object> verdict = new LinkedHashMap<>(
                    geo.verify(project == null ? null : project.getGeoCoords(), captured));
            verdict.put("source", "evidence");
            return verdict;
        }
        Map<String, Object> verdict = new LinkedHashMap<>(
                geo.verify(project == null ? null : project.getGeoCoords(), null));
        verdict.put("source", "none");
        return verdict;
    }

    private static List<String> buildFlags(Inspection inspection,
                                           Map<String, Object> verification,
                                           List<Evidence> evidenceRows,
                                           Project project) {
        List<String> flags = new ArrayList<>();
        String verdict = String.valueOf(verification.get("verdict"));
        if ("suspicious".equals(verdict)) {
            flags.add("possible_proxy_reporting");
        }
        if ("mismatch".equals(verdict)) {
            flags.add("outside_expected_radius");
        }
        if ("flagged".equals(inspection.getStatus())) {
            flags.add("flagged_by_official");
        }
        if (!evidenceRows.isEmpty() && evidenceRows.stream().noneMatch(Evidence::isVerified)) {
            flags.add("evidence_unverified");
        }
        if (evidenceRows.isEmpty() && TERMINAL_WITHOUT_EVIDENCE.contains(inspection.getStatus())) {
            flags.add("no_evidence_captured");
        }
        if (inspection.getCompletedDate() != null && inspection.getScheduledDate() != null
                && inspection.getCompletedDate().isBefore(inspection.getScheduledDate())) {
            flags.add("completed_before_schedule");
        }
        if (inspection.getAiRiskScore() != null
                && inspection.getAiRiskScore().doubleValue() > 70d) {
            flags.add("high_risk_project");
        }
        if (project != null && !"active".equals(project.getStatus())
                && "completed".equals(inspection.getStatus())) {
            flags.add("project_not_active");
        }
        return flags;
    }

    /** The plain-text summary returned by {@code POST /reports/:id/share}. */
    public String shareText(Map<String, Object> report) {
        Map<?, ?> project = (Map<?, ?>) report.get("project");
        Map<?, ?> official = (Map<?, ?>) report.get("official");
        Map<?, ?> verification = (Map<?, ?>) report.get("geo_verification");
        @SuppressWarnings("unchecked")
        List<String> flags = (List<String>) report.getOrDefault("flags", List.of());

        StringBuilder lines = new StringBuilder();
        lines.append("SAMAJ DRISHTI - GEO-TAGGED INSPECTION REPORT\n");
        lines.append("Ministry of Social Justice & Empowerment\n\n");
        lines.append("Report ID         : ").append(report.get("id")).append('\n');
        lines.append("Project           : ").append(project == null ? "N/A" : project.get("name")).append('\n');
        lines.append("Location          : ").append(project == null ? "N/A" : project.get("location")).append('\n');
        lines.append("Budget            : ")
                .append(project == null ? "N/A" : inr(project.get("budget"))).append('\n');
        lines.append("Inspecting officer: ").append(official == null ? "Unassigned" : official.get("name")).append('\n');
        lines.append("Scheduled         : ").append(report.getOrDefault("scheduled_date", "N/A")).append('\n');
        lines.append("Completed         : ")
                .append(report.get("completed_date") == null ? "Not completed" : report.get("completed_date"))
                .append('\n');
        lines.append("Status            : ").append(report.get("status")).append('\n');
        lines.append("AI risk score     : ").append(report.getOrDefault("ai_risk_score", "N/A")).append(" / 100\n\n");
        lines.append("Location check    : ")
                .append(String.valueOf(verification.get("verdict")).toUpperCase())
                .append(" - ")
                .append(verification.get("explanation"))
                .append('\n');
        lines.append("Evidence          : ").append(report.get("verified_evidence_count"))
                .append('/').append(report.get("evidence_count")).append(" verified\n");
        lines.append("Flags             : ").append(flags.isEmpty() ? "none" : String.join(", ", flags));

        Object notes = report.get("notes");
        if (notes != null && !String.valueOf(notes).isBlank()) {
            lines.append("\n\nOfficer notes     : ").append(notes);
        }
        return lines.toString();
    }

    private static String inr(Object value) {
        double amount = value instanceof Number number ? number.doubleValue() : 0d;
        return "Rs. " + String.format("%,d", Math.round(amount));
    }

    public static String timestamp() {
        return Instant.now().toString();
    }

    public static Comparator<Inspection> newestFirst() {
        return Comparator.comparing(
                (Inspection i) -> i.getCreatedAt() == null ? Instant.EPOCH : i.getCreatedAt(),
                Comparator.reverseOrder());
    }
}
