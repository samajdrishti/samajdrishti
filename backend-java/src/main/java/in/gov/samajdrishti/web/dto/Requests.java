package in.gov.samajdrishti.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Request bodies. Every field is bound from the snake_case names in the API contract. */
public final class Requests {

    private Requests() {
    }

    public record Register(
            @NotBlank(message = "Name is required") String name,
            @NotBlank(message = "Valid email is required") @Email(message = "Valid email is required") String email,
            @NotBlank @Size(min = 6, message = "Password must be 6+ characters") String password,
            String role,
            String department,
            String phone) {
    }

    public record Login(
            @NotBlank(message = "Valid email is required") @Email(message = "Valid email is required") String email,
            @NotBlank(message = "Password is required") String password) {
    }

    public record CreateProject(
            @NotBlank(message = "Name is required") String name,
            String description,
            String location,
            String department,
            GeoCoords geoCoords,
            LocalDate startDate,
            LocalDate endDate,
            BigDecimal budget) {
    }

    public record UpdateProject(
            String name,
            String description,
            String status,
            BigDecimal budget) {
    }

    public record AssignInspection(
            Integer projectId,
            Integer assignedTo,
            LocalDate scheduledDate,
            BigDecimal aiRiskScore) {
    }

    public record UpdateInspectionStatus(
            @NotBlank String status,
            String notes,
            LocalDate completedDate,
            Double lat,
            Double lng) {
    }

    public record GeoRequest(Double lat, Double lng, Double accuracy) {
    }

    public record Checklist(Map<String, Boolean> checks, String voiceRemarks) {
    }

    /**
     * Per-item checklist update, the LLD's {@code PUT /checklist/{itemId}}. The path variable
     * carries the item, so the body only needs the answer and the reason.
     */
    public record ChecklistItemUpdate(String status, String remarks, Integer evidenceId, String clientId) {
    }

    /**
     * Beneficiary headcount verification for one inspection.
     *
     * <p>{@code clientId} makes a replayed offline submit idempotent - the field app retries
     * until it gets an ack, and without this each retry would add a row.
     */
    public record SubmitAttendance(
            @NotNull(message = "Registered count is required") Integer registered,
            @NotNull(message = "Reported count is required") Integer reported,
            @NotNull(message = "Observed count is required") Integer observed,
            String notes,
            String capturedAt,
            String clientId) {
    }

    public record VerifyRecord(Boolean confirmed, String remarks) {
    }

    /**
     * Create an ATR, the LLD's {@code POST /api/atr}. Either an anomaly or an inspection must
     * be named so the action is traceable to a finding.
     */
    public record CreateAtr(
            Integer inspectionId,
            Integer anomalyId,
            Integer projectId,
            Integer assignedTo,
            @NotBlank(message = "Action description is required") String actionDescription,
            String deficiencyTitle,
            String deadline,
            String priority,
            String remarks) {
    }

    public record UpdateAtr(
            String actionDescription,
            String deadline,
            String status,
            String remarks,
            Integer assignedTo) {
    }

    public record CloseAtr(String verificationStatus, String remarks) {
    }

    public record AnalyzeInspection(Boolean includeAttendance, Boolean includeGeo) {
    }

    public record SubmitReport(String notes) {
    }

    /** Supervisor decision on a filed report: {@code approve}, {@code reject} or {@code request_changes}. */
    public record ReviewReport(String decision, String remarks) {
    }

    /** New holder for a reassignment. */
    public record Reassign(Integer officerId) {
    }

    public record CreateCamera(
            @NotBlank(message = "Camera name is required") String name,
            Integer projectId,
            String location,
            String streamType,
            String streamUrl,
            Double lat,
            Double lng) {
    }

    public record UpdateCamera(String status) {
    }

    public record AttendancePunch(
            Integer projectId,
            Integer officialId,
            Double lat,
            Double lng,
            String device,
            String mode) {
    }

    public record CreateVcSession(Integer projectId, Integer officialId, String mode) {
    }

    public record JoinLog(Integer userId, String action) {
    }

    public record AiAssignment(Integer numInspections, Boolean persist) {
    }

    public record NgoReply(String ngoReply, String correctiveEvidenceUrl) {
    }

    public record Adjudication(String action, String pmuAdjudication) {
    }

    public record Feedback(
            Integer projectId,
            String category,
            Integer rating,
            String comment,
            String scheme,
            String beneficiaryName,
            String voiceMemo) {
    }

    public record GeoCoords(Double lat, Double lng) {
    }

    /**
     * Multipart evidence upload; {@code geo_coords} may also arrive as a JSON string.
     *
     * <p>{@code clientId} is the offline-sync idempotency key, {@code accuracy} the device's
     * reported GPS accuracy, and {@code syncStatus} lets the phone record a row locally
     * before the bytes have actually left the device.
     */
    public record EvidenceUpload(
            String inspectionId,
            String type,
            String timestamp,
            String lat,
            String lng,
            String geoCoords,
            String filePath,
            String clientId,
            String accuracy,
            String syncStatus) {
    }

    /**
     * Create or update an institution. Coordinates arrive as a {@code geo_coords} object,
     * matching the projects payload so the dashboards can post either shape.
     */
    public record UpsertInstitution(
            @NotBlank(message = "Name is required") String name,
            String type,
            String scheme,
            String address,
            String district,
            String state,
            GeoCoords geoCoords,
            Double geofenceRadius,
            String status,
            Integer sanctionedCapacity,
            Integer projectId,
            String inchargeName,
            String inchargePhone) {
    }

    /**
     * Create an assignment. {@code assignmentType} distinguishes a randomised pick from a
     * supervisor's manual choice, which the audit trail treats differently.
     */
    public record CreateAssignment(
            @NotNull(message = "Inspection is required") Integer inspectionId,
            @NotNull(message = "Officer is required") Integer officerId,
            String assignmentType,
            String priority,
            String scheduledDate) {
    }

    public record DeclineAssignment(String reason) {
    }

    public static Instant instantOrNow(Instant value) {
        return value == null ? Instant.now() : value;
    }
}
