package in.gov.samajdrishti.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.domain.Anomaly;
import in.gov.samajdrishti.domain.AttendanceRecord;
import in.gov.samajdrishti.domain.AuditEntry;
import in.gov.samajdrishti.domain.Camera;
import in.gov.samajdrishti.domain.ChecklistItem;
import in.gov.samajdrishti.domain.Evidence;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.InspectionChecklist;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.repository.AnomalyRepository;
import in.gov.samajdrishti.repository.AttendanceRecordRepository;
import in.gov.samajdrishti.repository.CameraRepository;
import in.gov.samajdrishti.repository.ChecklistItemRepository;
import in.gov.samajdrishti.repository.EvidenceRepository;
import in.gov.samajdrishti.repository.InspectionChecklistRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.security.AuthPrincipal;

/**
 * Per-inspection analysis, and the persistence of what it finds.
 *
 * <p>This is the LLD's §10 endpoint, and it exists because the previous behaviour was to
 * hand the AI engine a *batch* of inspections on a dashboard read and throw the answer
 * away. Nothing was stored, so two officials opening the same page could see different
 * anomaly lists, and there was no record anyone could sign off - the human-in-the-loop step
 * the LLD's §9 requires had nothing to attach to.
 *
 * <p>Findings are written as {@link Anomaly} rows with {@code humanVerified = false}. The
 * deterministic rules always run; the AI engine is asked to enrich them and any failure
 * there is absorbed, because the LLD is explicit that AI is an assistance layer and a dead
 * engine must not stop an inspection from being reviewed.
 */
@Service
public class AnomalyService {

    /** Below this, the observed headcount gap is ordinary variance rather than a finding. */
    private static final double ATTENDANCE_GAP_THRESHOLD = 0.10;
    /** At or above this the finding is treated as serious enough to require a person. */
    private static final double HIGH_CONFIDENCE = 0.75;
    private static final int LOW_COMPLIANCE_THRESHOLD = 50;

    private final AnomalyRepository anomalies;
    private final InspectionRepository inspections;
    private final ProjectRepository projects;
    private final UserRepository users;
    private final EvidenceRepository evidence;
    private final ChecklistItemRepository checklistItems;
    private final InspectionChecklistRepository checklists;
    private final AttendanceRecordRepository attendance;
    private final CameraRepository cameras;
    private final AuditService audit;
    private final GeoService geo;
    private final AiEngineClient ai;

    public AnomalyService(AnomalyRepository anomalies,
                          InspectionRepository inspections,
                          ProjectRepository projects,
                          UserRepository users,
                          EvidenceRepository evidence,
                          ChecklistItemRepository checklistItems,
                          InspectionChecklistRepository checklists,
                          AttendanceRecordRepository attendance,
                          CameraRepository cameras,
                          AuditService audit,
                          GeoService geo,
                          AiEngineClient ai) {
        this.anomalies = anomalies;
        this.inspections = inspections;
        this.projects = projects;
        this.users = users;
        this.evidence = evidence;
        this.checklistItems = checklistItems;
        this.checklists = checklists;
        this.attendance = attendance;
        this.cameras = cameras;
        this.audit = audit;
        this.geo = geo;
        this.ai = ai;
    }

    /**
     * Runs every detector against one inspection and stores what it finds.
     *
     * <p>Previously-raised open findings of the same type are replaced rather than
     * duplicated, so re-running the analysis on a resubmitted inspection does not
     * accumulate copies of the same complaint.
     *
     * @return the findings as they now stand, and the counts the dashboard shows.
     */
    @Transactional
    public Map<String, Object> analyze(Integer inspectionId, AuthPrincipal actor) {
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> in.gov.samajdrishti.web.ApiException.notFound("Inspection not found"));

        List<Anomaly> found = new ArrayList<>();
        found.addAll(attendanceFindings(inspection));
        found.addAll(evidenceFindings(inspection));
        found.addAll(checklistFindings(inspection));
        found.addAll(geoFindings(inspection));
        found.addAll(cctvFindings(inspection));
        found.addAll(aiFindings(inspection));

        List<Anomaly> saved = new ArrayList<>();
        for (Anomaly finding : found) {
            replaceOpen(inspectionId, finding.getType());
            finding.setInspectionId(inspectionId);
            finding.setProjectId(inspection.getProjectId());
            finding.setCreatedAt(java.time.Instant.now());
            saved.add(anomalies.save(finding));
        }

        audit.record(actor, "anomaly.analysis_run", "inspection", inspectionId, Map.of(
                "findings", String.valueOf(saved.size()),
                "types", saved.stream().map(Anomaly::getType).distinct().toList().toString()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("inspection_id", inspectionId);
        result.put("anomalies", saved);
        result.put("count", saved.size());
        result.put("requires_human_review", saved.stream().filter(Anomaly::isRequiresHumanReview).count());
        result.put("already_raised", anomalies.findByInspectionIdOrderByIdDesc(inspectionId).size());
        return result;
    }

    /** Every finding for one inspection, plus the open ones a reviewer still owes a decision on. */
    @Transactional(readOnly = true)
    public Map<String, Object> forInspection(Integer inspectionId) {
        List<Anomaly> all = anomalies.findByInspectionIdOrderByIdDesc(inspectionId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("inspection_id", inspectionId);
        result.put("anomalies", all);
        result.put("count", all.size());
        result.put("unverified_count", all.stream().filter(a -> !a.isHumanVerified()).count());
        result.put("highest_severity", highestSeverity(all));
        return result;
    }

    @Transactional(readOnly = true)
    public List<Anomaly> list(String status, Boolean unverified, Integer projectId) {
        if (unverified != null && unverified) {
            return anomalies.findByHumanVerifiedFalseOrderByIdDesc();
        }
        if (status != null && !status.isBlank()) {
            return anomalies.findByStatusOrderByIdDesc(status);
        }
        if (projectId != null) {
            return anomalies.findByProjectIdOrderByIdDesc(projectId);
        }
        return anomalies.findAllByOrderByIdDesc();
    }

    @Transactional(readOnly = true)
    public Anomaly byId(Integer id) {
        return anomalies.findById(id)
                .orElseThrow(() -> in.gov.samajdrishti.web.ApiException.notFound("Anomaly not found"));
    }

    /**
     * Records the human decision on a finding.
     *
     * <p>This is the step that makes the LLD's "AI as assistance, not authority" claim real:
     * nothing is ever marked reviewed except through here, and the reviewer and their
     * remarks are stored alongside.
     */
    @Transactional
    public Anomaly verify(Integer id, boolean confirmed, String remarks, AuthPrincipal actor) {
        Anomaly finding = byId(id);
        finding.setHumanVerified(true);
        finding.setStatus(confirmed ? "confirmed" : "dismissed");
        finding.setVerifiedBy(actor == null ? null : actor.id());
        finding.setVerifiedAt(java.time.Instant.now());
        finding.setVerifiedRemarks(remarks);
        finding.setRequiresHumanReview(false);
        Anomaly saved = anomalies.save(finding);

        audit.record(actor, confirmed ? "anomaly.confirmed" : "anomaly.dismissed", "anomaly", id,
                Map.of("type", String.valueOf(saved.getType()),
                        "inspection_id", String.valueOf(saved.getInspectionId()),
                        "remarks", remarks == null ? "" : remarks));
        return saved;
    }

    /** Total findings raised against an inspection, verified or not. */
    @Transactional(readOnly = true)
    public long countFor(Integer inspectionId) {
        return anomalies.countByInspectionId(inspectionId);
    }

    /** Findings still awaiting a human decision - the dashboard's review backlog. */
    @Transactional(readOnly = true)
    public long countUnverifiedFor(Integer inspectionId) {
        return anomalies.countByInspectionIdAndHumanVerifiedFalse(inspectionId);
    }

    /* --------------------------------------------------------------- detectors */

    /**
     * The strongest single anti-fraud signal: how many people were actually on site versus
     * how many the institution reported.
     */
    private List<Anomaly> attendanceFindings(Inspection inspection) {
        List<Anomaly> found = new ArrayList<>();
        for (AttendanceRecord record : attendance.findByInspectionIdOrderByIdDesc(inspection.getId())) {
            int registered = orZero(record.getRegisteredCount());
            int reported = orZero(record.getReportedCount());
            int observed = orZero(record.getObservedCount());
            if (registered <= 0) {
                continue;
            }

            double observedRate = observed / (double) registered;
            double gap = 1 - observedRate;

            if (observed < reported) {
                // The institution claims more than the officer saw: the classic ghost
                // beneficiary pattern, and the more serious direction of the mismatch.
                int over = reported - observed;
                double ratio = over / (double) registered;
                found.add(finding(inspection,
                        "ATTENDANCE_MISMATCH",
                        "Institution reported %d present but the officer counted %d on site "
                                .formatted(reported, observed)
                                + "(%d of %d on the roll are unaccounted for, %.1f%%)."
                                        .formatted(over, registered, ratio * 100),
                        ratio,
                        ratio > 0.15 ? "high" : "medium",
                        "ai",
                        "attendance_discrepancy"));
            } else if (gap > ATTENDANCE_GAP_THRESHOLD) {
                found.add(finding(inspection,
                        "ATTENDANCE_MISMATCH",
                        "Only %d of %d registered beneficiaries were observed (%.1f%% attendance)."
                                .formatted(observed, registered, observedRate * 100),
                        gap,
                        gap > 0.30 ? "high" : "medium",
                        "ai",
                        "attendance_discrepancy"));
            }
        }
        return found;
    }

    /**
     * Evidence integrity: no photos at all, geo-tagged photos, and the same bytes uploaded
     * twice. The duplicate case is only detectable now that uploads carry a hash.
     */
    private List<Anomaly> evidenceFindings(Inspection inspection) {
        List<Anomaly> found = new ArrayList<>();
        List<Evidence> rows = evidence.findByInspectionIdOrderByCreatedAtDesc(inspection.getId());
        if (rows.isEmpty()) {
            if (!"pending".equals(inspection.getStatus())) {
                found.add(finding(inspection, "MISSING_DOCUMENT",
                        "No photo, video or document evidence was captured for this inspection.",
                        0.9, "high", "rule", "evidence_presence"));
            }
            return found;
        }

        List<Evidence> withoutGeo = rows.stream().filter(e -> GeoService.normalise(e.getGeoCoords()) == null).toList();
        if (!withoutGeo.isEmpty()) {
            found.add(finding(inspection, "MISSING_DOCUMENT",
                    withoutGeo.size() + " of " + rows.size()
                            + " evidence item(s) carry no GPS coordinates, so they cannot corroborate a site visit.",
                    0.6, "medium", "rule", "evidence_geo"));
        }

        rows.stream()
                .filter(e -> e.getFileHash() != null)
                .collect(java.util.stream.Collectors.groupingBy(Evidence::getFileHash, java.util.stream.Collectors.toList()))
                .values().stream()
                .filter(group -> group.size() > 1)
                .forEach(group -> found.add(finding(inspection, "DUPLICATE_EVIDENCE",
                        "The same file was uploaded " + group.size() + " times (sha256 "
                                + group.get(0).getFileHash().substring(0, Math.min(12, group.get(0).getFileHash().length()))
                                + "...), which usually means a copy was passed off as a second photograph.",
                        0.8, "medium", "rule", "evidence_hash")));

        return found;
    }

    /** A checklist that scores badly is a finding in its own right, not just a low number. */
    private List<Anomaly> checklistFindings(Inspection inspection) {
        List<Anomaly> found = new ArrayList<>();
        List<ChecklistItem> items = checklistItems.findByInspectionIdOrderByIdAsc(inspection.getId());
        if (!items.isEmpty()) {
            List<ChecklistItem> failed = items.stream()
                    .filter(i -> "failed".equals(i.getStatus()))
                    .toList();
            if (!failed.isEmpty()) {
                found.add(finding(inspection, "MISSING_DOCUMENT",
                        failed.size() + " checklist item(s) failed: "
                                + failed.stream().map(ChecklistItem::getItemCode).limit(4).toList(),
                        0.7, "medium", "rule", "checklist_items"));
            }
            return found;
        }

        // Fall back to the aggregate score when the per-item rows have not been written yet,
        // which is the case for checklists submitted before this table existed.
        InspectionChecklist saved = checklists.findByInspectionId(inspection.getId()).orElse(null);
        if (saved != null && saved.getComplianceScore() != null
                && saved.getComplianceScore() < LOW_COMPLIANCE_THRESHOLD) {
            found.add(finding(inspection, "MISSING_DOCUMENT",
                    "Checklist compliance scored %d/100, below the %d point threshold."
                            .formatted(saved.getComplianceScore(), LOW_COMPLIANCE_THRESHOLD),
                    1 - (saved.getComplianceScore() / 100d), "high", "rule", "checklist_score"));
        }
        return found;
    }

    /**
     * Re-derives the geo verdict from the evidence actually stored, so a finding survives
     * even if the live check was never run at submit time.
     */
    private List<Anomaly> geoFindings(Inspection inspection) {
        List<Anomaly> found = new ArrayList<>();
        if (inspection.isGpsVerified()) {
            return found;
        }
        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        List<Evidence> rows = evidence.findByInspectionIdOrderByCreatedAtDesc(inspection.getId());
        Evidence captured = rows.stream()
                .filter(e -> GeoService.normalise(e.getGeoCoords()) != null)
                .findFirst()
                .orElse(null);
        if (captured == null) {
            return found;
        }
        Map<String, Object> verdict = geo.verify(
                project == null ? null : project.getGeoCoords(), captured.getGeoCoords());
        String level = String.valueOf(verdict.get("verdict"));
        if ("mismatch".equals(level) || "suspicious".equals(level)) {
            found.add(finding(inspection, "INSPECTION_DEVIATION",
                    String.valueOf(verdict.get("explanation")),
                    "suspicious".equals(level) ? 0.92 : 0.65,
                    "suspicious".equals(level) ? "high" : "medium",
                    "rule", "haversine_geo"));
        }
        return found;
    }

    /** A site whose cameras are all down cannot corroborate a visit. */
    private List<Anomaly> cctvFindings(Inspection inspection) {
        List<Anomaly> found = new ArrayList<>();
        List<Camera> siteCameras = cameras.findByProjectId(inspection.getProjectId());
        if (siteCameras.isEmpty()) {
            return found;
        }
        List<Camera> offline = siteCameras.stream()
                .filter(c -> !"online".equals(c.getStatus()))
                .toList();
        if (offline.size() == siteCameras.size()) {
            found.add(finding(inspection, "CCTV_UNAVAILABLE",
                    "All " + siteCameras.size() + " camera(s) at this institution were offline during the inspection.",
                    0.85, "high", "rule", "camera_heartbeat"));
        } else if (!offline.isEmpty()) {
            found.add(finding(inspection, "CCTV_UNAVAILABLE",
                    offline.size() + " of " + siteCameras.size() + " camera(s) were offline during the inspection.",
                    0.6, "medium", "rule", "camera_heartbeat"));
        }
        return found;
    }

    /**
     * Asks the AI engine for anything the local rules did not cover.
     *
     * <p>Best effort by construction: a null transport result, a malformed finding or an
     * engine that is simply not running all end the same way - the deterministic findings
     * still stand.
     */
    private List<Anomaly> aiFindings(Inspection inspection) {
        List<Anomaly> found = new ArrayList<>();
        List<Map<String, Object>> batch = List.of(Map.of(
                "id", inspection.getId(),
                "status", String.valueOf(inspection.getStatus()),
                "scheduled_date", String.valueOf(inspection.getScheduledDate()),
                "completed_date", String.valueOf(inspection.getCompletedDate()),
                "assigned_to", String.valueOf(inspection.getAssignedTo()),
                "ai_risk_score", String.valueOf(inspection.getAiRiskScore())));
        try {
            for (Map<String, Object> raw : ai.detectAnomalies(batch)) {
                Anomaly finding = fromEngineFinding(inspection, raw);
                if (finding != null) {
                    found.add(finding);
                }
            }
        } catch (RuntimeException e) {
            // Deliberate: the local rules above are the floor, not the ceiling.
        }
        return found;
    }

    private Anomaly fromEngineFinding(Inspection inspection, Map<String, Object> raw) {
        String type = upper(raw.get("type"));
        if (type == null) {
            return null;
        }
        Object confidence = raw.get("confidence");
        Double value = confidence instanceof Number number ? number.doubleValue() : null;
        return finding(inspection,
                type,
                raw.get("details") == null ? "Flagged by the AI engine." : String.valueOf(raw.get("details")),
                value == null ? null : value,
                severityOf(raw.get("severity")),
                "ai",
                raw.get("method") == null ? "engine" : String.valueOf(raw.get("method")));
    }

    /* ----------------------------------------------------------------- helpers */

    private Anomaly finding(Inspection inspection, String type, String description,
                            Double confidence, String severity, String source, String detector) {
        Anomaly anomaly = new Anomaly();
        anomaly.setType(type);
        anomaly.setDescription(description);
        anomaly.setSeverity(severity);
        anomaly.setSource(source);
        anomaly.setDetector(detector);
        anomaly.setStatus("open");
        anomaly.setHumanVerified(false);
        if (confidence != null) {
            // Clamped rather than rejected: a detector returning 1.4 should not be able to
            // fail the request, it should just saturate.
            double clamped = Math.min(1d, Math.max(0d, confidence));
            anomaly.setConfidence(BigDecimal.valueOf(clamped).setScale(3, java.math.RoundingMode.HALF_UP));
        }
        anomaly.setRequiresHumanReview(severityIsHigh(severity) || (confidence != null && confidence >= HIGH_CONFIDENCE));
        return anomaly;
    }

    private void replaceOpen(Integer inspectionId, String type) {
        anomalies.findByInspectionIdAndTypeOrderByIdDesc(inspectionId, type).stream()
                .filter(a -> !a.isHumanVerified())
                .findFirst()
                .ifPresent(anomalies::delete);
    }

    public static String highestSeverity(List<Anomaly> rows) {
        return rows.stream()
                .map(Anomaly::getSeverity)
                .filter(java.util.Objects::nonNull)
                .max(java.util.Comparator.comparingInt(AnomalyService::severityRank))
                .orElse(null);
    }

    private static int severityRank(String severity) {
        return switch (severityOf(severity)) {
            case "high" -> 3;
            case "medium" -> 2;
            default -> 1;
        };
    }

    private static boolean severityIsHigh(String severity) {
        return "high".equals(severityOf(severity));
    }

    private static String severityOf(Object value) {
        if (value == null) {
            return "medium";
        }
        return switch (String.valueOf(value).toLowerCase(Locale.ROOT)) {
            case "high", "critical", "severe" -> "high";
            case "low", "minor" -> "low";
            default -> "medium";
        };
    }

    private static String upper(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim().toUpperCase(Locale.ROOT);
        return text.isEmpty() ? null : text;
    }

    private static int orZero(Integer value) {
        return value == null ? 0 : value;
    }
}
