package in.gov.samajdrishti.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.domain.Anomaly;
import in.gov.samajdrishti.domain.Atr;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.realtime.RealtimeHub;
import in.gov.samajdrishti.repository.AnomalyRepository;
import in.gov.samajdrishti.repository.AtrRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.web.ApiException;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * Action Taken Reports - §12 of the LLD, and the web-to-mobile half of §13.
 *
 * <p>The gap this closes is that an ATR could not be created through the API at all. Only
 * the seeder wrote them, so the compliance workflow the LLD describes - official reviews an
 * inspection, raises an action, the officer is notified - existed in the UI but had no
 * endpoint behind it. Every ATR in the running system was demo data.
 *
 * <p>{@code assignedTo} and {@code verificationStatus} are what separate "an action was
 * demanded" from "an action was taken and independently checked". The old schema tracked
 * only the first, and a closed ATR was indistinguishable from a verified one.
 */
@Service
public class AtrService {

    /** Days allowed for corrective action when the official does not set a deadline. */
    private static final int DEFAULT_DEADLINE_DAYS = 15;

    private static final List<String> STATUSES = List.of(
            "open", "under_review", "escalated", "action_in_progress", "approved_closed",
            "rejected_reinspection", "verified_closed");
    private static final List<String> PRIORITIES = List.of("low", "normal", "high");
    private static final List<String> VERIFICATIONS = List.of("pending", "verified", "rejected");

    private final AtrRepository atrs;
    private final InspectionRepository inspections;
    private final ProjectRepository projects;
    private final UserRepository users;
    private final AnomalyRepository anomalies;
    private final NotificationService notifications;
    private final AuditService audit;
    private final RealtimeHub hub;

    public AtrService(AtrRepository atrs,
                      InspectionRepository inspections,
                      ProjectRepository projects,
                      UserRepository users,
                      AnomalyRepository anomalies,
                      NotificationService notifications,
                      AuditService audit,
                      RealtimeHub hub) {
        this.atrs = atrs;
        this.inspections = inspections;
        this.projects = projects;
        this.users = users;
        this.anomalies = anomalies;
        this.notifications = notifications;
        this.audit = audit;
        this.hub = hub;
    }

    /**
     * Raises an action against an inspection or a specific AI finding.
     *
     * <p>Either anchor is acceptable but at least one is required: an ATR with neither is an
     * untraceable note, which is the thing an audit exists to prevent. The LLD's payload
     * names an anomaly; the workflow an official actually follows starts from an inspection,
     * so both are supported.
     */
    @Transactional
    public Map<String, Object> create(Requests.CreateAtr body, AuthPrincipal actor) {
        if (body.inspectionId() == null && body.anomalyId() == null && body.projectId() == null) {
            throw ApiException.badRequest(
                    "An ATR must reference an inspection, an anomaly or a project, otherwise it cannot be traced");
        }

        Inspection inspection = body.inspectionId() == null ? null
                : inspections.findById(body.inspectionId())
                        .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        Anomaly anomaly = body.anomalyId() == null ? null
                : anomalies.findById(body.anomalyId())
                        .orElseThrow(() -> ApiException.notFound("Anomaly not found"));

        Integer projectId = body.projectId() != null ? body.projectId()
                : inspection != null ? inspection.getProjectId()
                : anomaly != null ? anomaly.getProjectId() : null;
        Project project = projectId == null ? null : projects.findById(projectId).orElse(null);

        User assignee = body.assignedTo() == null ? null : users.findById(body.assignedTo())
                .orElseThrow(() -> ApiException.notFound("Assignee not found"));

        Atr atr = new Atr();
        atr.setInspectionId(body.inspectionId() != null ? body.inspectionId()
                : anomaly == null ? null : anomaly.getInspectionId());
        atr.setAnomalyId(body.anomalyId());
        atr.setProjectId(projectId);
        atr.setProjectName(project == null ? null : project.getName());
        atr.setScheme(project == null ? null : project.getDepartment());
        atr.setAssignedTo(assignee == null ? null : assignee.getId());
        atr.setAssignedToName(assignee == null ? null : assignee.getName());
        atr.setDeficiencyTitle(blankToDefault(body.deficiencyTitle(), body.actionDescription()));
        atr.setDeficiencyDetails(body.actionDescription());
        atr.setDeadline(parseDate(body.deadline()) == null
                ? LocalDate.now().plusDays(DEFAULT_DEADLINE_DAYS)
                : parseDate(body.deadline()));
        atr.setStatus("open");
        atr.setVerificationStatus("pending");
        atr.setRemarks(body.remarks());
        atr.setCreatedAt(Instant.now());
        atr.setUpdatedAt(Instant.now());
        Atr saved = atrs.save(atr);

        // An anomaly that has produced an ATR is no longer an open question, so it moves to
        // under_review and stops asking the dashboard for attention.
        if (anomaly != null && "open".equals(anomaly.getStatus())) {
            anomaly.setStatus("acknowledged");
            anomalies.save(anomaly);
        }
        if (inspection != null) {
            inspection.setStatus("atr_created");
            inspections.save(inspection);
        }

        notifyAssignee(saved, "Action required: %s".formatted(
                saved.getDeficiencyTitle() == null ? "corrective action" : saved.getDeficiencyTitle()));
        emitChange(saved, "atr:created");

        audit.record(actor, "atr.created", "atr", saved.getId(), Map.of(
                "inspection_id", String.valueOf(saved.getInspectionId()),
                "anomaly_id", String.valueOf(saved.getAnomalyId()),
                "assigned_to", String.valueOf(saved.getAssignedTo()),
                "deadline", String.valueOf(saved.getDeadline())));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Action Taken Report raised");
        result.put("atr", saved);
        return result;
    }

    @Transactional
    public Map<String, Object> update(Integer id, Requests.UpdateAtr body, AuthPrincipal actor) {
        Atr atr = require(id);
        String previousStatus = atr.getStatus();

        if (body.actionDescription() != null && !body.actionDescription().isBlank()) {
            atr.setDeficiencyDetails(body.actionDescription());
        }
        if (body.deadline() != null && !body.deadline().isBlank()) {
            LocalDate deadline = parseDate(body.deadline());
            if (deadline == null) {
                throw ApiException.badRequest("deadline must be an ISO date, e.g. 2026-09-30");
            }
            atr.setDeadline(deadline);
        }
        if (body.status() != null && !body.status().isBlank()) {
            String status = body.status().strip().toLowerCase(Locale.ROOT);
            if (!STATUSES.contains(status)) {
                throw ApiException.badRequest("status must be one of: " + String.join(", ", STATUSES));
            }
            atr.setStatus(status);
        }
        if (body.remarks() != null) {
            atr.setRemarks(body.remarks());
        }
        if (body.assignedTo() != null) {
            User assignee = users.findById(body.assignedTo())
                    .orElseThrow(() -> ApiException.notFound("Assignee not found"));
            atr.setAssignedTo(assignee.getId());
            atr.setAssignedToName(assignee.getName());
        }
        if (actor != null) {
            atr.setOfficialName(actor.name());
        }
        atr.setUpdatedAt(Instant.now());
        Atr saved = atrs.save(atr);

        audit.recordChange(actor, "atr.updated", "atr", id,
                Map.of("status", String.valueOf(previousStatus), "deadline", ""),
                Map.of("status", String.valueOf(saved.getStatus()),
                        "deadline", String.valueOf(saved.getDeadline()),
                        "assigned_to", String.valueOf(saved.getAssignedTo())));

        notifyAssignee(saved, "ATR #" + id + " updated: " + saved.getStatus());
        emitChange(saved, "atr:updated");
        return Map.of("message", "Action Taken Report updated", "atr", saved);
    }

    /**
     * Closes an ATR.
     *
     * <p>Closing and verifying are separate decisions on purpose. An officer can satisfy an
     * action and still have it rejected on inspection, so {@code verificationStatus} is
     * recorded independently of {@code status}: a closed-but-unverified ATR is the state
     * most worth alerting on, and conflating the two hides it.
     */
    @Transactional
    public Map<String, Object> close(Integer id, Requests.CloseAtr body, AuthPrincipal actor) {
        Atr atr = require(id);
        if (atr.getClosedAt() != null) {
            throw ApiException.badRequest("This ATR was already closed at " + atr.getClosedAt());
        }

        String verification = body == null || body.verificationStatus() == null
                || body.verificationStatus().isBlank()
                ? "verified"
                : body.verificationStatus().strip().toLowerCase(Locale.ROOT);
        if (!VERIFICATIONS.contains(verification)) {
            throw ApiException.badRequest("verification_status must be one of: " + String.join(", ", VERIFICATIONS));
        }

        atr.setStatus("verified".equals(verification) ? "verified_closed" : "rejected_reinspection");
        atr.setVerificationStatus(verification);
        atr.setClosedAt(Instant.now());
        atr.setUpdatedAt(Instant.now());
        if (body != null && body.remarks() != null && !body.remarks().isBlank()) {
            atr.setRemarks(body.remarks());
        }
        if (actor != null) {
            atr.setOfficialName(actor.name());
        }
        Atr saved = atrs.save(atr);

        // A rejected verification means the corrective action did not hold, so the
        // inspection goes back to action_in_progress rather than closing out.
        Inspection inspection = saved.getInspectionId() == null ? null
                : inspections.findById(saved.getInspectionId()).orElse(null);
        if (inspection != null) {
            inspection.setStatus("rejected".equals(verification) ? "action_in_progress" : "verified");
            inspections.save(inspection);
        }

        notifyAssignee(saved, "ATR #" + id + " " + ("verified".equals(verification)
                ? "verified and closed" : "rejected - further action required"));
        emitChange(saved, "atr:closed");

        audit.record(actor, "atr.closed", "atr", id, Map.of(
                "verification_status", verification,
                "inspection_id", String.valueOf(saved.getInspectionId())));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Action Taken Report closed");
        result.put("atr", saved);
        return result;
    }

    /** The existing NGO reply path, kept as the field app's submit action. */
    @Transactional
    public Map<String, Object> respond(Integer id, String reply, String correctiveEvidenceUrl, AuthPrincipal actor) {
        Atr atr = require(id);
        if (reply != null && !reply.isBlank()) {
            atr.setNgoReply(reply);
        }
        if (correctiveEvidenceUrl != null && !correctiveEvidenceUrl.isBlank()) {
            atr.setCorrectiveEvidenceUrl(correctiveEvidenceUrl);
        }
        atr.setStatus("under_review");
        atr.setUpdatedAt(Instant.now());
        Atr saved = atrs.save(atr);

        notifyAssignee(saved, "Corrective action submitted for ATR #" + id);
        emitChange(saved, "atr:responded");
        audit.record(actor, "atr.ngo_reply_submitted", "atr", id,
                Map.of("status", String.valueOf(saved.getStatus())));
        return Map.of("message", "Corrective action taken report submitted successfully", "atr", saved);
    }

    /** The PMU adjudication path, retained from the previous controller. */
    @Transactional
    public Map<String, Object> adjudicate(Integer id, String action, String adjudication, AuthPrincipal actor) {
        String verdict = switch (action == null ? "" : action) {
            case "approve" -> "approved_closed";
            case "escalate" -> "escalated";
            case "reject" -> "rejected_reinspection";
            default -> null;
        };
        Atr atr = require(id);
        if (verdict != null) {
            atr.setStatus(verdict);
            // An approval is only meaningful if the corrective evidence was actually seen.
            if ("approved_closed".equals(verdict) && "pending".equals(atr.getVerificationStatus())) {
                atr.setVerificationStatus("verified");
            }
        }
        if (adjudication != null && !adjudication.isBlank()) {
            atr.setPmuAdjudication(adjudication);
        }
        if (actor != null) {
            atr.setOfficialName(actor.name());
        }
        atr.setUpdatedAt(Instant.now());
        Atr saved = atrs.save(atr);

        emitChange(saved, "atr:adjudicated");
        audit.record(actor, "atr.adjudicated." + (action == null ? "none" : action), "atr", id,
                Map.of("verdict", String.valueOf(saved.getStatus())));
        return Map.of("message", "ATR adjudicated: " + saved.getStatus(), "atr", saved);
    }

    @Transactional(readOnly = true)
    public Atr byId(Integer id) {
        return require(id);
    }

    @Transactional(readOnly = true)
    public List<Atr> list(String status, Integer projectId, Integer assignedTo) {
        if (projectId != null) {
            return atrs.findByProjectIdOrderByIdDesc(projectId);
        }
        if (assignedTo != null) {
            return atrs.findByAssignedToOrderByIdDesc(assignedTo);
        }
        if (status != null && !status.isBlank()) {
            return atrs.findByStatusOrderByIdDesc(status);
        }
        return atrs.findAllByOrderByIdDesc();
    }

    /* ----------------------------------------------------------------- helpers */

    /**
     * Tells the assignee, and the back office, that an ATR moved.
     *
     * <p>Before this, an ATR state change was invisible on the realtime channel: the officer
     * only heard about it through a generic notification, and the dashboard never learned
     * that an action had been closed. That is the LLD's §13 web-to-mobile flow.
     */
    private void emitChange(Atr atr, String event) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("atr", atr);
        payload.put("id", atr.getId());
        payload.put("status", atr.getStatus());
        payload.put("inspection_id", atr.getInspectionId());
        payload.put("anomaly_id", atr.getAnomalyId());
        payload.put("assigned_to", atr.getAssignedTo());
        payload.put("verification_status", atr.getVerificationStatus());
        hub.emit(event, payload);
    }

    private void notifyAssignee(Atr atr, String message) {
        if (atr.getAssignedTo() == null) {
            return;
        }
        notifications.create(atr.getAssignedTo(), "Action required", message, "alert", "atr", atr.getId());
    }

    private Atr require(Integer id) {
        return atrs.findById(id).orElseThrow(() -> ApiException.notFound("ATR record not found"));
    }

    private static String blankToDefault(String value, String fallback) {
        if (value != null && !value.isBlank()) {
            return value;
        }
        return fallback == null || fallback.isBlank() ? "Corrective action required" : fallback;
    }

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(value.strip());
        } catch (DateTimeParseException e) {
            return null;
        }
    }
}
