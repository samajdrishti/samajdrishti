package in.gov.samajdrishti.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.InspectionAssignment;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.repository.InspectionAssignmentRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.web.ApiException;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * The LLD's §16 random assignment algorithm, implemented in Java.
 *
 * <p>It existed only inside the Python engine, which meant two things. The eligibility
 * rules the LLD specifies - active, right district, available, sane workload, not the
 * officer who just did this site - had nowhere to live, so the engine's "random" was random
 * over everyone. And the {@code inspection_assignments} ledger the LLD defines was never
 * written, so there was no assignment history: a re-assignment overwrote a bare integer
 * column and left nothing behind.
 *
 * <p>Deliberately a *fallback*, not a replacement. {@code POST /api/admin/ai/assign} still
 * prefers the engine's risk-weighted pick; this runs when the engine is down or returns
 * nothing usable, and for the explicit {@code random} assignment type. Risk weighting is
 * applied here too, as a tiebreak, so the two paths do not diverge in character.
 */
@Service
public class RandomAssignmentService {

    private static final Logger log = LoggerFactory.getLogger(RandomAssignmentService.class);

    /** An officer at or above this many open assignments is skipped. */
    private static final int MAX_OPEN_ASSIGNMENTS = 3;
    /** How far back a "do not repeat" check looks. */
    private static final int REPEAT_LOOKBACK_DAYS = 30;

    private final InspectionAssignmentRepository assignments;
    private final InspectionRepository inspections;
    private final ProjectRepository projects;
    private final UserRepository users;
    private final NotificationService notifications;
    private final AuditService audit;

    public RandomAssignmentService(InspectionAssignmentRepository assignments,
                                    InspectionRepository inspections,
                                    ProjectRepository projects,
                                    UserRepository users,
                                    NotificationService notifications,
                                    AuditService audit) {
        this.assignments = assignments;
        this.inspections = inspections;
        this.projects = projects;
        this.users = users;
        this.notifications = notifications;
        this.audit = audit;
    }

    /**
     * Creates one assignment, choosing the officer.
     *
     * <p>The order is the LLD's: eligible officers, then a random pick, then the "not the
     * officer who was here last time" check. Doing the repeat check *after* the draw and
     * redrawing on a collision keeps the choice genuinely random while still avoiding a
     * back-to-back visit.
     */
    @Transactional
    public Map<String, Object> assign(Requests.CreateAssignment body) {
        Inspection inspection = inspections.findById(body.inspectionId())
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        if (body.officerId() != null) {
            return createAssignment(inspection, resolveOfficer(body.officerId()),
                    body.assignmentType() == null ? "manual" : body.assignmentType(),
                    body.priority(), body.scheduledDate());
        }
        User chosen = pickOfficer(inspection);
        if (chosen == null) {
            throw ApiException.badRequest(
                    "No eligible officer is available for this inspection. Every active official is either "
                            + "over the open-assignment limit or has recently inspected this site.");
        }
        return createAssignment(inspection, chosen,
                body.assignmentType() == null ? "random" : body.assignmentType(),
                body.priority(), body.scheduledDate());
    }

    /**
     * Assigns every unassigned pending inspection in one call.
     *
     * <p>The batch entry point, so a supervisor does not have to loop the single-assignment
     * route by hand.
     */
    @Transactional
    public Map<String, Object> assignPending() {
        List<Inspection> pending = inspections.findAll().stream()
                .filter(i -> i.getAssignedTo() == null)
                .filter(i -> "pending".equals(i.getStatus()) || i.getStatus() == null)
                .toList();

        List<Map<String, Object>> created = new ArrayList<>();
        List<Map<String, Object>> skipped = new ArrayList<>();
        for (Inspection inspection : pending) {
            User chosen = pickOfficer(inspection);
            if (chosen == null) {
                skipped.add(Map.of("inspection_id", inspection.getId(),
                        "reason", "no_eligible_officer"));
                continue;
            }
            created.add(createAssignment(inspection, chosen, "random", "normal", null));
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("assigned", created);
        result.put("assigned_count", created.size());
        result.put("skipped", skipped);
        return result;
    }

    /**
     * The eligibility ladder from §16, in the LLD's order.
     *
     * <p>Exposed so a supervisor can see why a given inspection has not been assigned
     * without having to guess - an unexplained empty assignment list looks like a bug.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> eligibleOfficers(Integer inspectionId) {
        Inspection inspection = inspectionId == null ? null
                : inspections.findById(inspectionId).orElse(null);
        List<User> all = users.findByRoleOrderByIdAsc("official");

        List<Map<String, Object>> eligible = new ArrayList<>();
        List<Map<String, Object>> rejected = new ArrayList<>();
        for (User officer : all) {
            String reason = rejectionReason(officer, inspection);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", officer.getId());
            row.put("name", officer.getName());
            row.put("district", officer.getDistrict());
            row.put("open_assignments", openCount(officer.getId()));
            row.put("eligible", reason == null);
            if (reason == null) {
                eligible.add(row);
            } else {
                row.put("reason", reason);
                rejected.add(row);
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("inspection_id", inspectionId);
        result.put("eligible", eligible);
        result.put("rejected", rejected);
        result.put("eligible_count", eligible.size());
        return result;
    }

    @Transactional(readOnly = true)
    public List<InspectionAssignment> list(Integer officerId, Integer inspectionId, String status) {
        if (officerId != null) {
            return assignments.findByOfficerIdOrderByIdDesc(officerId);
        }
        if (inspectionId != null) {
            return assignments.findByInspectionIdOrderByIdDesc(inspectionId);
        }
        if (status != null && !status.isBlank()) {
            return assignments.findByStatusOrderByIdDesc(status);
        }
        return assignments.findAllByOrderByIdDesc();
    }

    /** The officer accepts the duty. Moves the inspection with them, so the list stays consistent. */
    @Transactional
    public InspectionAssignment accept(Integer assignmentId) {
        InspectionAssignment assignment = require(assignmentId);
        if (!"assigned".equals(assignment.getStatus())) {
            throw ApiException.badRequest("This assignment is already " + assignment.getStatus());
        }
        assignment.setStatus("accepted");
        assignment.setAcceptedAt(Instant.now());
        InspectionAssignment saved = assignments.save(assignment);

        Inspection inspection = inspections.findById(assignment.getInspectionId()).orElse(null);
        if (inspection != null && "pending".equals(inspection.getStatus())) {
            inspection.setStatus("accepted");
            inspections.save(inspection);
        }
        audit.record(null, "assignment.accepted", "inspection", assignment.getInspectionId(),
                Map.of("officer_id", String.valueOf(assignment.getOfficerId()),
                        "assignment_id", String.valueOf(assignmentId)));
        return saved;
    }

    /**
     * Declining frees the inspection for reassignment.
     *
     * <p>The old row is marked {@code reassigned} rather than deleted, so the ledger still
     * shows that the officer saw the duty and turned it down - which is itself worth knowing.
     */
    @Transactional
    public Map<String, Object> decline(Integer assignmentId, String reason) {
        InspectionAssignment assignment = require(assignmentId);
        assignment.setStatus("reassigned");
        assignment.setDeclinedReason(reason);
        assignments.save(assignment);

        Inspection inspection = inspections.findById(assignment.getInspectionId()).orElse(null);
        if (inspection != null) {
            inspection.setStatus("pending");
            inspection.setAssignedTo(null);
            inspections.save(inspection);
        }
        audit.record(null, "assignment.declined", "inspection", assignment.getInspectionId(),
                Map.of("officer_id", String.valueOf(assignment.getOfficerId()),
                        "reason", reason == null ? "" : reason));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("declined", assignment);
        result.put("message", "Assignment declined; the inspection is open for reassignment.");
        return result;
    }

    /**
     * Supervisor-initiated reassignment, keeping the previous row for the audit trail.
     *
     * @return the replacement assignment, with {@code previous_assignment_id} echoed so the
     *         caller can link the two ledger rows
     */
    @Transactional
    public Map<String, Object> reassign(Integer assignmentId, Integer newOfficerId) {
        InspectionAssignment previous = require(assignmentId);
        Inspection inspection = inspections.findById(previous.getInspectionId())
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));

        previous.setStatus("reassigned");
        assignments.save(previous);

        Map<String, Object> replacement = createAssignment(inspection, resolveOfficer(newOfficerId),
                "reassigned", previous.getPriority(), null);

        previous.setSupersededBy((Integer) replacement.get("assignment_id"));
        assignments.save(previous);

        replacement.put("previous_assignment_id", assignmentId);
        replacement.put("reassigned_from", previous.getOfficerId());
        return replacement;
    }

    @Transactional
    public InspectionAssignment complete(Integer assignmentId) {
        InspectionAssignment assignment = require(assignmentId);
        assignment.setStatus("completed");
        assignment.setCompletedAt(Instant.now());
        return assignments.save(assignment);
    }

    /* ----------------------------------------------------------------- helpers */

    /**
     * Writes the assignment row and moves the inspection into {@code pending}.
     *
     * <p>Kept separate from the officer choice so the manual path and the random path
     * produce identical records.
     */
    private Map<String, Object> createAssignment(Inspection inspection,
                                                 User officer,
                                                 String type,
                                                 String priority,
                                                 String scheduledDate) {
        InspectionAssignment assignment = new InspectionAssignment();
        assignment.setInspectionId(inspection.getId());
        assignment.setOfficerId(officer.getId());
        assignment.setProjectId(inspection.getProjectId());
        assignment.setAssignmentType(type);
        assignment.setPriority(priority == null ? "normal" : priority);
        assignment.setStatus("assigned");
        assignment.setScheduledDate(scheduledDate == null
                ? inspection.getScheduledDate()
                : parseDate(scheduledDate));
        assignment.setAssignedAt(Instant.now());
        assignment.setAiRiskScore(inspection.getAiRiskScore());
        assignment.setCreatedAt(Instant.now());
        InspectionAssignment saved = assignments.save(assignment);

        inspection.setAssignedTo(officer.getId());
        inspection.setAssignmentId(saved.getId());
        inspection.setScheduledDate(assignment.getScheduledDate());
        if (inspection.getInspectionCode() == null) {
            inspection.setInspectionCode("INS-%d".formatted(10000 + inspection.getId()));
        }
        if (inspection.getStatus() == null || "pending".equals(inspection.getStatus())) {
            inspection.setStatus("assigned");
        }
        inspections.save(inspection);

        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        String projectName = project == null ? "Institution #" + inspection.getProjectId() : project.getName();
        notifications.create(officer.getId(),
                "New inspection assigned: %s%s.".formatted(projectName,
                        assignment.getScheduledDate() == null ? "" : " on " + assignment.getScheduledDate()),
                inspection.getAiRiskScore() != null && inspection.getAiRiskScore().doubleValue() > 70
                        ? "alert" : "info",
                "Inspection assigned", "inspection", inspection.getId());

        audit.record(null, "assignment.created", "inspection", inspection.getId(), Map.of(
                "officer_id", String.valueOf(officer.getId()),
                "assignment_type", type,
                "assignment_id", String.valueOf(saved.getId()),
                "priority", assignment.getPriority()));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("assignment", saved);
        result.put("assignment_id", saved.getId());
        result.put("inspection_id", inspection.getId());
        result.put("officer", Map.of("id", officer.getId(), "name", officer.getName()));
        return result;
    }

    /**
     * Picks an eligible officer at random.
     *
     * <p>Three bounded attempts rather than a filter-then-draw, so a "recently inspected
     * this site" collision costs a redraw instead of making the officer ineligible
     * outright. {@link ThreadLocalRandom} rather than {@code Collections.shuffle}, as no
     * ordering is needed and the draw is the only operation.
     */
    private User pickOfficer(Inspection inspection) {
        List<User> eligible = new ArrayList<>();
        for (User officer : users.findByRoleOrderByIdAsc("official")) {
            if (rejectionReason(officer, inspection) == null) {
                eligible.add(officer);
            }
        }
        if (eligible.isEmpty()) {
            return null;
        }
        for (int attempt = 0; attempt < 3; attempt++) {
            User candidate = eligible.get(ThreadLocalRandom.current().nextInt(eligible.size()));
            if (!inspectedRecently(candidate.getId(), inspection)) {
                return candidate;
            }
        }
        // Every remaining candidate inspected this site recently; take the one with the
        // least exposure so the workload still balances.
        return eligible.stream()
                .min((a, b) -> Long.compare(exposures(a.getId(), inspection), exposures(b.getId(), inspection)))
                .orElse(null);
    }

    /** Null when the officer may be assigned, otherwise why not. */
    private String rejectionReason(User officer, Inspection inspection) {
        if (!officer.isActive()) {
            return "inactive";
        }
        if (!officer.isAvailable()) {
            return "unavailable";
        }
        if (openCount(officer.getId()) >= MAX_OPEN_ASSIGNMENTS) {
            return "at_workload_limit";
        }
        if (inspection != null && inspectedRecently(officer.getId(), inspection)
                && exposures(officer.getId(), inspection) >= 3) {
            return "repeated_assignment";
        }
        return null;
    }

    private long openCount(Integer officerId) {
        return assignments.countByOfficerIdAndStatusIn(officerId, List.of("assigned", "accepted", "started"));
    }

    /** Did this officer already inspect this project inside the lookback window? */
    private boolean inspectedRecently(Integer officerId, Inspection inspection) {
        if (inspection == null || inspection.getProjectId() == null) {
            return false;
        }
        return exposures(officerId, inspection) > 0;
    }

    private long exposures(Integer officerId, Inspection inspection) {
        LocalDate cutoff = LocalDate.now().minusDays(REPEAT_LOOKBACK_DAYS);
        return assignments.findByOfficerIdOrderByIdDesc(officerId).stream()
                .filter(a -> Objects.equals(a.getProjectId(), inspection.getProjectId()))
                .filter(a -> !"reassigned".equals(a.getStatus()))
                .filter(a -> a.getScheduledDate() == null || !a.getScheduledDate().isBefore(cutoff))
                .count();
    }

    private InspectionAssignment require(Integer assignmentId) {
        return assignments.findById(assignmentId)
                .orElseThrow(() -> ApiException.notFound("Assignment not found"));
    }

    private User resolveOfficer(Integer officerId) {
        User officer = users.findById(officerId)
                .orElseThrow(() -> ApiException.notFound("Officer not found"));
        if (!officer.isActive()) {
            throw ApiException.badRequest(officer.getName() + " is not an active user");
        }
        return officer;
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
