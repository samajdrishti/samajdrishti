package in.gov.samajdrishti.web;

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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import in.gov.samajdrishti.domain.Anomaly;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.service.AnomalyService;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * Anomaly review - the LLD's §9 "AI as an assistance layer, human review required".
 *
 * <p>Findings are listed to the back office, verified individually, and re-run per
 * inspection. Verification is what turns an AI opinion into a record: only this endpoint
 * sets {@code human_verified}, and it stores who decided and why.
 */
@RestController
@RequestMapping("/api/anomalies")
public class AnomalyController {

    private final AnomalyService anomalies;
    private final in.gov.samajdrishti.repository.InspectionRepository inspections;

    public AnomalyController(AnomalyService anomalies,
                             in.gov.samajdrishti.repository.InspectionRepository inspections) {
        this.anomalies = anomalies;
        this.inspections = inspections;
    }

    /** The LLD's {@code POST /internal/ai/analyze}, exposed on the normal auth path. */
    @PostMapping("/inspections/{inspectionId}/analyze")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public ResponseEntity<Map<String, Object>> analyze(
            @PathVariable Integer inspectionId,
            @AuthenticationPrincipal AuthPrincipal current) {
        return ResponseEntity.ok(anomalies.analyze(inspectionId, current));
    }

    @GetMapping("/inspections/{inspectionId}")
    @Transactional(readOnly = true)
    public Map<String, Object> forInspection(@PathVariable Integer inspectionId) {
        if (!inspections.existsById(inspectionId)) {
            throw ApiException.notFound("Inspection not found");
        }
        return anomalies.forInspection(inspectionId);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Anomaly> list(@RequestParam(required = false) String status,
                              @RequestParam(required = false) Boolean unverified,
                              @RequestParam(required = false) Integer projectId) {
        return anomalies.list(status, unverified, projectId);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Anomaly byId(@PathVariable Integer id) {
        return anomalies.byId(id);
    }

    /**
     * Records the human decision on one finding.
     *
     * <p>{@code confirmed} true accepts the finding as a real deficiency; false dismisses it
     * as a false positive. Both count as reviewed - the point is that a person looked.
     */
    @PutMapping("/{id}/verify")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Anomaly verify(@PathVariable Integer id,
                          @RequestBody(required = false) Requests.VerifyRecord body,
                          @AuthenticationPrincipal AuthPrincipal current) {
        boolean confirmed = body == null || body.confirmed() == null || body.confirmed();
        String remarks = body == null ? null : body.remarks();
        if (!confirmed && (remarks == null || remarks.isBlank())) {
            throw ApiException.badRequest("Dismissing a finding requires a reason");
        }
        return anomalies.verify(id, confirmed, remarks, current);
    }

    /** Everything awaiting a decision, for the dashboard badge. */
    @GetMapping("/pending-review")
    @Transactional(readOnly = true)
    public Map<String, Object> pendingReview() {
        List<Anomaly> rows = anomalies.list(null, true, null);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("anomalies", rows);
        body.put("count", rows.size());
        body.put("highest_severity", AnomalyService.highestSeverity(rows));
        return body;
    }
}
