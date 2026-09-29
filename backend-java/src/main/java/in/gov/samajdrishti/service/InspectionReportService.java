package in.gov.samajdrishti.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.domain.Anomaly;
import in.gov.samajdrishti.domain.AttendanceRecord;
import in.gov.samajdrishti.domain.Evidence;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.InspectionReport;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.realtime.RealtimeHub;
import in.gov.samajdrishti.repository.AnomalyRepository;
import in.gov.samajdrishti.repository.AttendanceRecordRepository;
import in.gov.samajdrishti.repository.EvidenceRepository;
import in.gov.samajdrishti.repository.InspectionReportRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.web.ApiException;

/**
 * Filing and reviewing inspection reports, LLD §21's web-official half.
 *
 * <p>The LLD defines an {@code inspection_reports} table with a status, a submitter and a
 * submission time. Previously no report was ever stored: {@code ReportService} rebuilt one
 * from the inspection, its evidence, the attendance punches and the audit trail on every
 * read. That is fine for a demo and wrong for a record - a conclusion a supervisor acted on
 * could change underneath them the next time evidence was uploaded, and there was no way to
 * ask what the finding was on a given date.
 *
 * <p>Submitting freezes the summary, findings and geo verdict as they stood. Later uploads
 * change the underlying rows but not the filed report.
 */
@Service
public class InspectionReportService {

    private static final List<String> STATUSES =
            List.of("draft", "submitted", "under_review", "approved", "rejected");
    private static final List<String> DECISIONS = List.of("approve", "reject", "request_changes");

    private final InspectionReportRepository reports;
    private final InspectionRepository inspections;
    private final ProjectRepository projects;
    private final UserRepository users;
    private final EvidenceRepository evidence;
    private final AnomalyRepository anomalies;
    private final AttendanceRecordRepository attendance;
    private final in.gov.samajdrishti.repository.InspectionChecklistRepository checklists;
    private final GeoService geo;
    private final ReportService computed;
    private final AuditService audit;
    private final NotificationService notifications;
    private final RealtimeHub hub;

    public InspectionReportService(InspectionReportRepository reports,
                                   InspectionRepository inspections,
                                   ProjectRepository projects,
                                   UserRepository users,
                                   EvidenceRepository evidence,
                                   AnomalyRepository anomalies,
                                   AttendanceRecordRepository attendance,
                                   in.gov.samajdrishti.repository.InspectionChecklistRepository checklists,
                                   GeoService geo,
                                   ReportService computed,
                                   AuditService audit,
                                   NotificationService notifications,
                                   RealtimeHub hub) {
        this.reports = reports;
        this.inspections = inspections;
        this.projects = projects;
        this.users = users;
        this.evidence = evidence;
        this.anomalies = anomalies;
        this.attendance = attendance;
        this.checklists = checklists;
        this.geo = geo;
        this.computed = computed;
        this.audit = audit;
        this.notifications = notifications;
        this.hub = hub;
    }

    /**
     * Freezes the report for an inspection and marks the inspection submitted.
     *
     * <p>Re-submitting replaces the previous filed report rather than adding a second one,
     * so an inspection has exactly one record of what was concluded. The superseded row is
     * left alone in the audit trail.
     */
    @Transactional
    public Map<String, Object> submit(Integer inspectionId, String notes, AuthPrincipal actor) {
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));

        var previous = reports.findFirstByInspectionIdAndReportStatusOrderByIdDesc(inspectionId, "submitted");
        if (previous.isPresent() && "submitted".equals(previous.get().getReportStatus())) {
            throw ApiException.badRequest(
                    "A report for inspection #" + inspectionId + " is already filed; withdraw it before refiling");
        }

        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        List<Evidence> evidenceRows = evidence.findByInspectionIdOrderByCreatedAtDesc(inspectionId);
        List<Anomaly> anomalyRows = anomalies.findByInspectionIdOrderByIdDesc(inspectionId);
        AttendanceRecord attendanceRow = attendance.findFirstByInspectionIdOrderByIdDesc(inspectionId).orElse(null);

        Map<String, Object> live = computed.buildReport(inspection, computed.loadContext());
        @SuppressWarnings("unchecked")
        List<String> flags = (List<String>) live.getOrDefault("flags", List.of());
        Object verification = live.get("geo_verification");
        Map<?, ?> verdict = verification instanceof Map<?, ?> map ? map : Map.of();
        Object levelValue = verdict.get("verdict");
        String level = levelValue == null ? "unknown" : String.valueOf(levelValue);

        InspectionReport report = new InspectionReport();
        report.setInspectionId(inspectionId);
        report.setProjectId(inspection.getProjectId());
        report.setOfficerId(inspection.getAssignedTo());
        report.setSummary(buildSummary(project, inspection, evidenceRows, attendanceRow, anomalyRows, flags, level));
        report.setFindings(String.join("\n", flags));
        report.setRiskLevel(riskLevelOf(flags, anomalyRows));
        report.setReportStatus("submitted");
        report.setSubmittedBy(actor == null ? inspection.getAssignedTo() : actor.id());
        report.setSubmittedAt(Instant.now());
        report.setGeoVerdict(level);
        Object distance = verdict.get("distance_meters");
        report.setDistanceMeters(distance instanceof Number number ? number.doubleValue() : null);
        report.setComplianceScore(complianceScoreOf(inspectionId));
        report.setEvidenceCount(evidenceRows.size());
        report.setAnomalyCount(anomalyRows.size());
        report.setGeoCoords(evidenceRows.isEmpty() ? null : evidenceRows.get(0).getGeoCoords());
        report.setCreatedAt(Instant.now());
        InspectionReport saved = reports.save(report);

        inspection.setStatus("submitted");
        inspection.setSubmittedAt(Instant.now());
        inspection.setEndTime(Instant.now());
        if (notes != null && !notes.isBlank()) {
            inspection.setNotes(notes);
        }
        inspections.save(inspection);

        notifyBackOffice(saved, "Report filed: " + summaryHeadline(report));
        hub.emit("report:submitted", Map.of(
                "inspection_id", inspectionId,
                "report_id", saved.getId(),
                "risk_level", saved.getRiskLevel(),
                "anomaly_count", saved.getAnomalyCount()));

        audit.record(actor, "report.submitted", "inspection", inspectionId, Map.of(
                "report_id", String.valueOf(saved.getId()),
                "risk_level", String.valueOf(saved.getRiskLevel()),
                "anomaly_count", String.valueOf(saved.getAnomalyCount()),
                "geo_verdict", level,
                "flags", String.join(",", flags)));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Inspection report filed");
        result.put("report", saved);
        result.put("report_id", saved.getId());
        return result;
    }

    /** A supervisor accepts or rejects the filed report. */
    @Transactional
    public Map<String, Object> review(Integer reportId, String decision, String remarks, AuthPrincipal actor) {
        InspectionReport report = reports.findById(reportId)
                .orElseThrow(() -> ApiException.notFound("Report not found"));
        if (!"submitted".equals(report.getReportStatus())
                && !"under_review".equals(report.getReportStatus())) {
            throw ApiException.badRequest("A report in state '" + report.getReportStatus() + "' cannot be reviewed");
        }
        if (decision == null || !DECISIONS.contains(decision.strip().toLowerCase(Locale.ROOT))) {
            throw ApiException.badRequest("decision must be one of: " + String.join(", ", DECISIONS));
        }

        String previous = report.getReportStatus();
        report.setReportStatus(switch (decision.strip().toLowerCase(Locale.ROOT)) {
            case "approve" -> "approved";
            case "reject" -> "rejected";
            default -> "under_review";
        });
        report.setReviewedBy(actor == null ? null : actor.id());
        report.setReviewedAt(Instant.now());
        report.setReviewRemarks(remarks);
        InspectionReport saved = reports.save(report);

        Inspection inspection = saved.getInspectionId() == null ? null
                : inspections.findById(saved.getInspectionId()).orElse(null);
        if (inspection != null) {
            inspection.setStatus("approved".equals(saved.getReportStatus()) ? "under_review" : "action_in_progress");
            inspections.save(inspection);
        }

        if (inspection != null && inspection.getAssignedTo() != null) {
            notifications.create(inspection.getAssignedTo(),
                    "Report " + saved.getReportStatus().replace('_', ' '),
                    "Your inspection report #" + reportId + " was " + saved.getReportStatus().replace('_', ' ') + ".",
                    "rejected".equals(saved.getReportStatus()) ? "alert" : "info",
                    "inspection", inspection.getId());
        }
        hub.emit("report:reviewed", Map.of(
                "report_id", reportId,
                "status", saved.getReportStatus(),
                "inspection_id", saved.getInspectionId()));
        audit.recordChange(actor, "report.reviewed", "inspection_report", reportId,
                Map.of("status", String.valueOf(previous)),
                Map.of("status", String.valueOf(saved.getReportStatus()),
                        "remarks", remarks == null ? "" : remarks));

        return Map.of("message", "Report " + saved.getReportStatus(), "report", saved);
    }

    @Transactional(readOnly = true)
    public List<InspectionReport> list(String status, Integer projectId) {
        if (projectId != null) {
            return reports.findByProjectIdOrderByIdDesc(projectId);
        }
        if (status != null && !status.isBlank()) {
            return reports.findByReportStatusOrderByIdDesc(status);
        }
        return reports.findAllByOrderByIdDesc();
    }

    @Transactional(readOnly = true)
    public InspectionReport byId(Integer id) {
        return reports.findById(id).orElseThrow(() -> ApiException.notFound("Report not found"));
    }

    /** The filed report for an inspection, if one exists. */
    @Transactional(readOnly = true)
    public Map<String, Object> forInspection(Integer inspectionId) {
        return reports.findFirstByInspectionIdOrderByIdDesc(inspectionId)
                .map(report -> {
                    Map<String, Object> body = new LinkedHashMap<>();
                    body.put("inspection_id", inspectionId);
                    body.put("report", report);
                    return body;
                })
                .orElseThrow(() -> ApiException.notFound("No report has been filed for this inspection yet"));
    }

    /* ----------------------------------------------------------------- helpers */

    /**
     * The checklist compliance score at filing time, or null when no checklist was filed.
     *
     * <p>Read rather than recomputed so the report records what the officer actually scored
     * at the time, not what the template would yield now.
     */
    private Integer complianceScoreOf(Integer inspectionId) {
        return checklists.findByInspectionId(inspectionId)
                .map(in.gov.samajdrishti.domain.InspectionChecklist::getComplianceScore)
                .orElse(null);
    }

    /**
     * Risk level from the flags and the standing anomalies.
     *
     * <p>Any high-severity anomaly is enough on its own. Otherwise it comes down to the
     * geo verdict and how many flags were raised, since a report with several lesser flags
     * is still a report that needs reading.
     */
    private static String riskLevelOf(List<String> flags, List<Anomaly> anomalyRows) {
        if (anomalyRows.stream().anyMatch(a -> "high".equals(a.getSeverity()))
                || flags.contains("possible_proxy_reporting")
                || flags.contains("no_evidence_captured")) {
            return "high";
        }
        if (flags.contains("outside_expected_radius")
                || flags.contains("evidence_unverified")
                || flags.contains("completed_before_schedule")
                || !anomalyRows.isEmpty()) {
            return "medium";
        }
        return flags.isEmpty() ? "low" : "medium";
    }

    private static String buildSummary(Project project, Inspection inspection, List<Evidence> evidenceRows,
                                       AttendanceRecord attendanceRow, List<Anomaly> anomalyRows,
                                       List<String> flags, String geoVerdict) {
        StringBuilder text = new StringBuilder();
        text.append(project == null ? "Institution #" : project.getName());
        if (project != null && project.getLocation() != null) {
            text.append(" (").append(project.getLocation()).append(')');
        }
        text.append(". ");
        text.append(evidenceRows.size()).append(" evidence item(s) captured");
        if (attendanceRow != null) {
            text.append("; ").append(attendanceRow.getObservedCount())
                    .append(" of ").append(attendanceRow.getRegisteredCount())
                    .append(" beneficiaries observed (")
                    .append(attendanceRow.getAttendancePercentage() == null ? "n/a"
                            : attendanceRow.getAttendancePercentage().toPlainString() + "%")
                    .append(')');
        }
        text.append(". Geo check: ").append(geoVerdict).append(". ");
        if (anomalyRows.isEmpty()) {
            text.append("No anomalies were raised.");
        } else {
            text.append(anomalyRows.size()).append(" anomal")
                    .append(anomalyRows.size() == 1 ? "y" : "ies").append(" raised, ")
                    .append(anomalyRows.stream().filter(a -> "high".equals(a.getSeverity())).count())
                    .append(" high severity, ")
                    .append(anomalyRows.stream().filter(a -> !a.isHumanVerified()).count())
                    .append(" awaiting human review.");
        }
        if (!flags.isEmpty()) {
            text.append(" Flags: ").append(String.join(", ", flags)).append('.');
        }
        if (inspection.getNotes() != null && !inspection.getNotes().isBlank()) {
            text.append(" Officer notes: ").append(inspection.getNotes());
        }
        return text.toString();
    }

    private static String summaryHeadline(InspectionReport report) {
        String summary = report.getSummary();
        if (summary == null) {
            return "inspection report";
        }
        int stop = summary.indexOf(". ");
        return stop > 0 ? summary.substring(0, stop) : summary;
    }

    private void notifyBackOffice(InspectionReport report, String message) {
        // Supervisors, not the officer: the officer already knows they filed it.
        for (User supervisor : users.findByRoleOrderByIdAsc("supervisor")) {
            notifications.create(supervisor.getId(), "Report awaiting review", message, "info",
                    "report", report.getId());
        }
        for (User admin : users.findByRoleOrderByIdAsc("admin")) {
            notifications.create(admin.getId(), "Report awaiting review", message, "info",
                    "report", report.getId());
        }
    }
}
