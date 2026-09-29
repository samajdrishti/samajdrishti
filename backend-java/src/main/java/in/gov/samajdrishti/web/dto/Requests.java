package in.gov.samajdrishti.web.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
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

    public record GeoRequest(Double lat, Double lng) {
    }

    public record Checklist(Map<String, Boolean> checks, String voiceRemarks) {
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

    /** Multipart evidence upload; {@code geo_coords} may also arrive as a JSON string. */
    public record EvidenceUpload(
            String inspectionId,
            String type,
            String timestamp,
            String lat,
            String lng,
            String geoCoords,
            String filePath) {
    }

    public static Instant instantOrNow(Instant value) {
        return value == null ? Instant.now() : value;
    }
}
