package in.gov.samajdrishti.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.domain.Anomaly;
import in.gov.samajdrishti.domain.AttendanceRecord;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.repository.AnomalyRepository;
import in.gov.samajdrishti.repository.AttendanceRecordRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.realtime.RealtimeHub;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.web.ApiException;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * Beneficiary headcount verification - the LLD's §9 attendance API.
 *
 * <p>Separate from {@link in.gov.samajdrishti.service.AttendanceService}, which records an
 * official's own geo-fenced check-in. This is the officer filing what they counted on the
 * ground, and the whole point of the LLD's worked example: {@code 103/120 = 85.83%}. That
 * number is the anti-fraud signal, so it is computed once on write and stored rather than
 * derived at read time, which keeps every filed figure reproducible.
 */
@Service
public class InspectionAttendanceService {

    /** Below this, the shortfall is treated as ordinary absenteeism by the anomaly rules. */
    public static final BigDecimal WARNING_THRESHOLD = new BigDecimal("90.00");

    private final AttendanceRecordRepository records;
    private final InspectionRepository inspections;
    private final AnomalyRepository anomalies;
    private final AuditService audit;
    private final RealtimeHub hub;

    public InspectionAttendanceService(AttendanceRecordRepository records,
                                       InspectionRepository inspections,
                                       AnomalyRepository anomalies,
                                       AuditService audit,
                                       RealtimeHub hub) {
        this.records = records;
        this.inspections = inspections;
        this.anomalies = anomalies;
        this.audit = audit;
        this.hub = hub;
    }

    /**
     * Files the observed headcount for an inspection.
     *
     * <p>Idempotent on {@code clientId}: the offline queue replays a submission until it
     * gets an ack, and a lost ack must not produce two attendance rows - a second row
     * would corrupt the very statistic this is measuring.
     *
     * @throws ApiException 404 when the inspection does not exist, 400 on a negative count
     *                       or an observed count above the register
     */
    @Transactional
    public Map<String, Object> submit(Integer inspectionId, Requests.SubmitAttendance body, AuthPrincipal actor) {
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));

        if (body.registered() == null || body.reported() == null || body.observed() == null) {
            throw ApiException.badRequest("registered, reported and observed are all required");
        }
        validate(body.registered(), "registered");
        validate(body.reported(), "reported");
        validate(body.observed(), "observed");
        if (body.observed() > body.registered()) {
            throw ApiException.badRequest("observed cannot exceed registered: more people were counted "
                    + "than exist on the roll, which means the roll is wrong");
        }

        if (body.clientId() != null && !body.clientId().isBlank()) {
            var existing = records.findByClientId(body.clientId().strip());
            if (existing.isPresent()) {
                return response(existing.get(), true);
            }
        }

        AttendanceRecord record = new AttendanceRecord();
        record.setInspectionId(inspectionId);
        record.setProjectId(inspection.getProjectId());
        record.setRecordedBy(actor == null ? null : actor.id());
        record.setRegisteredCount(body.registered());
        record.setReportedCount(body.reported());
        record.setObservedCount(body.observed());
        record.setAttendancePercentage(percentage(body.observed(), body.registered()));
        record.setNotes(body.notes());
        record.setClientId(body.clientId() == null || body.clientId().isBlank() ? null : body.clientId().strip());
        record.setCapturedAt(parseInstant(body.capturedAt()));
        record.setCreatedAt(Instant.now());
        AttendanceRecord saved = records.save(record);

        // The AI engine is told what happened rather than asked to judge it: the judgement
        // is a threshold comparison, and the thresholds live in AnomalyService.
        if (saved.getAttendancePercentage().compareTo(WARNING_THRESHOLD) < 0) {
            hub.emit("attendance:mismatch", Map.of(
                    "inspection_id", inspectionId,
                    "registered", saved.getRegisteredCount(),
                    "reported", saved.getReportedCount(),
                    "observed", saved.getObservedCount(),
                    "percentage", saved.getAttendancePercentage()));
        }
        hub.emit("inspection:update", Map.of(
                "inspection", inspection,
                "attendance", saved,
                "anomaly_count", anomalies.countByInspectionId(inspectionId)));

        audit.record(actor, "attendance_record.submitted", "inspection", inspectionId, Map.of(
                "registered", String.valueOf(saved.getRegisteredCount()),
                "reported", String.valueOf(saved.getReportedCount()),
                "observed", String.valueOf(saved.getObservedCount()),
                "percentage", saved.getAttendancePercentage().toPlainString()));

        return response(saved, false);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> forInspection(Integer inspectionId) {
        AttendanceRecord latest = records.findFirstByInspectionIdOrderByIdDesc(inspectionId)
                .orElseThrow(() -> ApiException.notFound("No attendance record for this inspection yet"));
        return response(latest, false);
    }

    @Transactional(readOnly = true)
    public java.util.List<AttendanceRecord> list(Integer inspectionId) {
        return inspectionId == null
                ? records.findAllByOrderByIdDesc()
                : records.findByInspectionIdOrderByIdDesc(inspectionId);
    }

    /** A supervisor confirms or rejects the officer's count. */
    @Transactional
    public AttendanceRecord verify(Integer id, boolean confirmed, String remarks, AuthPrincipal actor) {
        AttendanceRecord record = records.findById(id)
                .orElseThrow(() -> ApiException.notFound("Attendance record not found"));
        record.setVerified(confirmed);
        record.setVerifiedBy(actor == null ? null : actor.id());
        record.setVerifiedAt(Instant.now());
        if (remarks != null && !remarks.isBlank()) {
            record.setNotes(remarks);
        }
        AttendanceRecord saved = records.save(record);
        audit.record(actor, confirmed ? "attendance_record.confirmed" : "attendance_record.rejected",
                "attendance_record", id,
                Map.of("inspection_id", String.valueOf(saved.getInspectionId())));
        return saved;
    }

    /* ----------------------------------------------------------------- helpers */

    /**
     * {@code observed / registered * 100}, rounded to two decimals.
     *
     * <p>A zero register is a division by zero, not a 0% - the officer did not find anyone
     * absent, the record simply cannot say. Returned as null so the caller can tell the
     * two apart.
     */
    public static BigDecimal percentage(Integer observed, Integer registered) {
        if (registered == null || registered <= 0) {
            return null;
        }
        int numerator = observed == null ? 0 : observed;
        return BigDecimal.valueOf(numerator)
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(registered), 2, RoundingMode.HALF_UP);
    }

    private static void validate(int value, String field) {
        if (value < 0) {
            throw ApiException.badRequest(field + " cannot be negative");
        }
    }

    private static Instant parseInstant(String value) {
        if (value == null || value.isBlank()) {
            return Instant.now();
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException e) {
            return Instant.now();
        }
    }

    private static Map<String, Object> response(AttendanceRecord record, boolean duplicate) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("record", record);
        body.put("attendance_percentage", record.getAttendancePercentage());
        body.put("duplicate", duplicate);
        return body;
    }
}
