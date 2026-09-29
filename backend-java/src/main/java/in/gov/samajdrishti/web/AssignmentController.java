package in.gov.samajdrishti.web;

import java.util.List;
import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import in.gov.samajdrishti.domain.InspectionAssignment;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.RandomAssignmentService;
import in.gov.samajdrishti.web.dto.Requests;
import in.gov.samajdrishti.web.dto.Requests.Reassign;

/**
 * The assignment ledger, LLD §16.
 *
 * <p>Assignment used to be a bare {@code assigned_to} column on the inspection, so a
 * re-assignment overwrote it and left no record of who originally had the duty. These routes
 * expose the ledger and the accept/decline/reassign lifecycle the LLD's §19 state machine
 * starts from.
 */
@RestController
@RequestMapping("/api/assignments")
public class AssignmentController {

    private final RandomAssignmentService assignments;

    public AssignmentController(RandomAssignmentService assignments) {
        this.assignments = assignments;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<InspectionAssignment> list(@RequestParam(required = false) Integer officerId,
                                           @RequestParam(required = false) Integer inspectionId,
                                           @RequestParam(required = false) String status) {
        return assignments.list(officerId, inspectionId, status);
    }

    /**
     * Who could take this inspection, and why the others cannot.
     *
     * <p>The rejections are the point: an empty eligible list otherwise looks like a bug
     * rather than a workload limit.
     */
    @GetMapping("/eligible")
    @Transactional(readOnly = true)
    public Map<String, Object> eligible(@RequestParam(required = false) Integer inspectionId) {
        return assignments.eligibleOfficers(inspectionId);
    }

    /** Creates an assignment, choosing the officer when none is named. */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> create(@RequestBody Requests.CreateAssignment body) {
        return assignments.assign(body);
    }

    /** Assigns every unassigned pending inspection in one call. */
    @PostMapping("/assign-pending")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> assignPending() {
        return assignments.assignPending();
    }

    @PostMapping("/{id}/accept")
    public InspectionAssignment accept(@PathVariable Integer id, @AuthenticationPrincipal AuthPrincipal current) {
        return assignments.accept(id);
    }

    @PostMapping("/{id}/decline")
    public Map<String, Object> decline(@PathVariable Integer id,
                                       @RequestBody(required = false) Requests.DeclineAssignment body,
                                       @AuthenticationPrincipal AuthPrincipal current) {
        return assignments.decline(id, body == null ? null : body.reason());
    }

    @PutMapping("/{id}/reassign")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> reassign(@PathVariable Integer id, @RequestBody Reassign body) {
        if (body == null || body.officerId() == null) {
            throw ApiException.badRequest("officer_id is required");
        }
        return assignments.reassign(id, body.officerId());
    }
}
