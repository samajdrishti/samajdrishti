package in.gov.samajdrishti.web;

import java.util.LinkedHashMap;
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
import org.springframework.web.bind.annotation.RestController;

import in.gov.samajdrishti.domain.AttendanceRecord;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.InspectionAttendanceService;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * Beneficiary attendance verification, LLD §9.
 *
 * <p>Nested under inspections because it is per-inspection evidence, distinct from the
 * existing {@code /api/attendance} routes which record an official's own check-in.
 */
@RestController
@RequestMapping("/api/inspections/{inspectionId}/attendance")
public class InspectionAttendanceController {

    private final InspectionAttendanceService attendance;
    private final in.gov.samajdrishti.repository.InspectionRepository inspections;

    public InspectionAttendanceController(InspectionAttendanceService attendance,
                                          in.gov.samajdrishti.repository.InspectionRepository inspections) {
        this.attendance = attendance;
        this.inspections = inspections;
    }

    /**
     * Files the observed headcount.
     *
     * <p>{@code 103/120} is stored as {@code 85.83} - computed once on write so the figure on
     * the record is exactly what was filed, rather than a re-derivation from whatever the
     * register says now.
     */
    @PostMapping
    public Map<String, Object> submit(@PathVariable Integer inspectionId,
                                      @RequestBody Requests.SubmitAttendance body,
                                      @AuthenticationPrincipal AuthPrincipal current) {
        return attendance.submit(inspectionId, body, current);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Map<String, Object> latest(@PathVariable Integer inspectionId) {
        if (!inspections.existsById(inspectionId)) {
            throw ApiException.notFound("Inspection not found");
        }
        return attendance.forInspection(inspectionId);
    }

    /** Every record filed for an inspection, newest first. */
    @GetMapping("/history")
    @Transactional(readOnly = true)
    public List<AttendanceRecord> history(@PathVariable Integer inspectionId) {
        return attendance.list(inspectionId);
    }

    @PutMapping("/{id}/verify")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public AttendanceRecord verify(@PathVariable Integer inspectionId, @PathVariable Integer id,
                                   @RequestBody(required = false) Requests.VerifyRecord body,
                                   @AuthenticationPrincipal AuthPrincipal current) {
        boolean confirmed = body == null || body.confirmed() == null || body.confirmed();
        return attendance.verify(id, confirmed, body == null ? null : body.remarks(), current);
    }
}
