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

import in.gov.samajdrishti.domain.InspectionReport;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.InspectionReportService;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * Filed inspection reports, the LLD's {@code inspection_reports} table.
 *
 * <p>{@code /api/reports} still serves the live, computed view that the dashboards use.
 * This controller serves the *record*: a snapshot frozen at submission that does not change
 * when evidence is uploaded afterwards.
 */
@RestController
@RequestMapping("/api/inspection-reports")
public class InspectionReportController {

    private final InspectionReportService reports;

    public InspectionReportController(InspectionReportService reports) {
        this.reports = reports;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<InspectionReport> list(@RequestParam(required = false) String status,
                                       @RequestParam(required = false) Integer projectId) {
        return reports.list(status, projectId);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public InspectionReport byId(@PathVariable Integer id) {
        return reports.byId(id);
    }

    /** The filed record for one inspection. */
    @GetMapping("/inspections/{inspectionId}")
    @Transactional(readOnly = true)
    public Map<String, Object> forInspection(@PathVariable Integer inspectionId) {
        return reports.forInspection(inspectionId);
    }

    /**
     * Files the report.
     *
     * <p>Freezes the summary, findings, compliance score and geo verdict as they stand, so the
     * conclusion a supervisor acted on cannot be rewritten by a later evidence upload.
     */
    @PostMapping("/inspections/{inspectionId}/submit")
    public Map<String, Object> submit(@PathVariable Integer inspectionId,
                                      @RequestBody(required = false) Requests.SubmitReport body,
                                      @AuthenticationPrincipal AuthPrincipal current) {
        return reports.submit(inspectionId, body == null ? null : body.notes(), current);
    }

    /** Accept, reject or send back for more work. */
    @PutMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> review(@PathVariable Integer id,
                                      @RequestBody Requests.ReviewReport body,
                                      @AuthenticationPrincipal AuthPrincipal current) {
        return reports.review(id, body == null ? null : body.decision(),
                body == null ? null : body.remarks(), current);
    }

}
