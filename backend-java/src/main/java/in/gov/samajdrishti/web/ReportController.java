package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.AuditService;
import in.gov.samajdrishti.service.ReportService;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
@PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
public class ReportController {

    private final ReportService reports;
    private final AuditService audit;

    public ReportController(ReportService reports, AuditService audit) {
        this.reports = reports;
        this.audit = audit;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(@RequestParam(required = false) Integer projectId,
                                          @RequestParam(required = false) String status,
                                          @RequestParam(required = false) String verified,
                                          @RequestParam(required = false) String flagged,
                                          @RequestParam(required = false) Integer limit) {
        ReportService.Context context = reports.loadContext();
        List<Inspection> inspections = new ArrayList<>(context.inspections());
        inspections.sort(ReportService.newestFirst());

        List<Map<String, Object>> built = new ArrayList<>();
        for (Inspection inspection : inspections) {
            if (projectId != null && !projectId.equals(inspection.getProjectId())) {
                continue;
            }
            if (status != null && !status.equals(inspection.getStatus())) {
                continue;
            }
            Map<String, Object> report = reports.buildReport(inspection, context);
            String verdict = verdictOf(report);
            if ("false".equals(verified) && "verified".equals(verdict)) {
                continue;
            }
            if ("true".equals(verified) && !"verified".equals(verdict)) {
                continue;
            }
            if ("true".equals(flagged) && flagsOf(report).isEmpty()) {
                continue;
            }
            built.add(summarise(report));
            if (built.size() >= (limit == null ? 50 : Math.min(limit, 200))) {
                break;
            }
        }
        return built;
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> byId(@PathVariable Integer id) {
        return Map.of("report", reportFor(id));
    }

    @PostMapping("/{id}/share")
    @Transactional(readOnly = true)
    public Map<String, Object> share(@PathVariable Integer id, @AuthenticationPrincipal AuthPrincipal current) {
        Map<String, Object> report = reportFor(id);
        audit.record(current, "report.shared", "inspection", id,
                Map.of("flags", String.valueOf(flagsOf(report).size())));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("text", reports.shareText(report));
        body.put("report", report);
        return body;
    }

    /** Full report for every inspection; also feeds the admin alert feed. */
    public List<Map<String, Object>> buildAllReports() {
        ReportService.Context context = reports.loadContext();
        return context.inspections().stream()
                .map(inspection -> reports.buildReport(inspection, context))
                .toList();
    }

    private Map<String, Object> reportFor(Integer id) {
        ReportService.Context context = reports.loadContext();
        return context.inspections().stream()
                .filter(inspection -> inspection.getId().equals(id))
                .findFirst()
                .map(inspection -> reports.buildReport(inspection, context))
                .orElseThrow(() -> ApiException.notFound("Report not found"));
    }

    private static String verdictOf(Map<String, Object> report) {
        Object verification = report.get("geo_verification");
        return verification instanceof Map<?, ?> map ? String.valueOf(map.get("verdict")) : "unknown";
    }

    @SuppressWarnings("unchecked")
    private static List<String> flagsOf(Map<String, Object> report) {
        Object flags = report.get("flags");
        return flags instanceof List<?> list ? (List<String>) list : List.of();
    }

    private static Map<String, Object> summarise(Map<String, Object> report) {
        Object project = report.get("project");
        Object official = report.get("official");
        Object verification = report.get("geo_verification");

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", report.get("id"));
        row.put("status", report.get("status"));
        row.put("project_name", project instanceof Map<?, ?> map ? map.get("name") : null);
        row.put("project_location", project instanceof Map<?, ?> map ? map.get("location") : null);
        row.put("official_name", official instanceof Map<?, ?> map ? map.get("name") : null);
        row.put("scheduled_date", report.get("scheduled_date"));
        row.put("completed_date", report.get("completed_date"));
        row.put("ai_risk_score", report.get("ai_risk_score"));
        row.put("evidence_count", report.get("evidence_count"));
        row.put("verified_evidence_count", report.get("verified_evidence_count"));
        row.put("geo_verdict", verification instanceof Map<?, ?> map ? map.get("verdict") : null);
        row.put("distance_meters", verification instanceof Map<?, ?> map ? map.get("distance_meters") : null);
        row.put("flags", report.get("flags"));
        return row;
    }
}
