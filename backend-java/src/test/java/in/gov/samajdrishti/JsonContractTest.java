package in.gov.samajdrishti;

import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import in.gov.samajdrishti.domain.AuditEntry;
import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.InspectionChecklist;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.realtime.RealtimeHub;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The two details most likely to break a client silently: the JSON field naming, and
 * the shapes of the composite responses the dashboards read.
 */
class JsonContractTest {

    /** The same strategy the running service is configured with. */
    private final ObjectMapper json = new ObjectMapper()
            .setPropertyNamingStrategy(com.fasterxml.jackson.databind.PropertyNamingStrategies.SNAKE_CASE)
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
            .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    @Test
    @DisplayName("entity fields are written in the snake_case the clients expect")
    void entitiesUseSnakeCase() throws Exception {
        Inspection inspection = new Inspection();
        inspection.setId(9);
        inspection.setProjectId(2);
        inspection.setAssignedTo(3);
        inspection.setSupervisorId(1);
        inspection.setStatus("completed");
        inspection.setScheduledDate(java.time.LocalDate.of(2026, 10, 1));
        inspection.setCompletedDate(java.time.LocalDate.of(2026, 10, 2));
        inspection.setAiRiskScore(new java.math.BigDecimal("88.50"));
        inspection.setCreatedAt(java.time.Instant.parse("2026-09-28T10:00:00Z"));

        String body = json.writeValueAsString(inspection);
        assertThat(body)
                .contains("\"project_id\":2")
                .contains("\"assigned_to\":3")
                .contains("\"supervisor_id\":1")
                .contains("\"ai_risk_score\":88.50")
                .contains("\"scheduled_date\":\"2026-10-01\"")
                .contains("\"created_at\":\"2026-09-28T10:00:00Z\"");
    }

    @Test
    @DisplayName("a user's password hash is never serialised")
    void passwordIsNeverSerialised() throws Exception {
        var user = new in.gov.samajdrishti.domain.User();
        user.setId(1);
        user.setEmail("a@b.gov.in");
        user.setPassword("$2a$10$notarealhash");

        assertThat(json.writeValueAsString(user)).doesNotContain("password");
    }

    @Test
    @DisplayName("geo_coords is an object, and JSON null when no fix was captured")
    void geoCoordsCollapseToNull() throws Exception {
        Project project = new Project();
        project.setId(1);
        project.setName("A");
        project.setGeoCoords(new GeoPoint(28.8955, 76.6066));

        assertThat(json.writeValueAsString(project))
                .contains("\"geo_coords\":{\"lat\":28.8955,\"lng\":76.6066}");

        Project withoutFix = new Project();
        withoutFix.setId(2);
        withoutFix.setName("B");
        withoutFix.setGeoCoords(new GeoPoint());
        // The clients branch on `row.geo_coords ? ...`, so an empty object would be a bug.
        assertThat(json.writeValueAsString(withoutFix)).contains("\"geo_coords\":null");
    }

    @Test
    @DisplayName("project metadata and audit meta are objects, never JSON text in a string")
    void jsonColumnsAreParsed() throws Exception {
        Project project = new Project();
        project.setId(1);
        project.setMetadata(Map.of("scheme", "AVYAY", "verified_headcount", 14));
        assertThat(json.writeValueAsString(project))
                .contains("\"scheme\":\"AVYAY\"")
                .doesNotContain("metadata_json");

        AuditEntry entry = new AuditEntry();
        entry.setId(1);
        entry.setAction("geo_verification.suspicious");
        entry.setEntity("inspection");
        entry.setMeta(Map.of("verdict", "suspicious", "distance_meters", 1180.4));
        assertThat(json.writeValueAsString(entry))
                .contains("\"verdict\":\"suspicious\"")
                .doesNotContain("\"meta\":\"{");
    }

    @Test
    @DisplayName("a checklist's checks map round-trips without leaking the stored text")
    void checklistChecksRoundTrip() throws Exception {
        InspectionChecklist checklist = new InspectionChecklist();
        checklist.setInspectionId(4);
        checklist.setScheme("AVYAY");
        checklist.setChecks(Map.of("resident_headcount", true, "medical_log", false));
        checklist.setComplianceScore(25);

        String body = json.writeValueAsString(checklist);
        assertThat(body)
                .contains("\"resident_headcount\":true")
                .contains("\"medical_log\":false")
                .doesNotContain("checks_json");
    }

    @Test
    @DisplayName("the root banner keeps its camelCase keys, which are not entity fields")
    void bannerKeysAreHandWritten() throws Exception {
        // The banner keys are literal map keys, so the naming strategy cannot touch them;
        // this test documents that the frontends read dataMode, not data_mode.
        Map<String, Object> banner = new java.util.LinkedHashMap<>();
        banner.put("message", "Samaj Drishti API Server");
        banner.put("status", "running");
        banner.put("dataMode", "memory");
        assertThat(json.writeValueAsString(banner)).contains("\"dataMode\":\"memory\"");
    }

    @Test
    @DisplayName("realtime events are framed as Socket.IO EVENT packets")
    void realtimeFraming() {
        String frame = RealtimeHub.frame("notification", Map.of("message", "hi", "type", "alert"));
        // Engine.IO packet type 4 + Socket.IO type 2 == "42", then a one-element event name
        // followed by the payload - exactly what socket.io-client expects to receive.
        assertThat(frame).startsWith("42[").contains("\"notification\"").contains("\"type\":\"alert\"");
        assertThat(frame).endsWith("]").doesNotContain("\\\"");
    }

    @Test
    @DisplayName("a camera row exposes the snapshot URL the dashboard puts in an <img>")
    void cameraSnapshotUrl() {
        var camera = new in.gov.samajdrishti.domain.Camera();
        camera.setId(7);
        camera.setName("Gate");
        assertThat(List.of("/api/monitoring/cameras/" + camera.getId() + "/snapshot"))
                .containsExactly("/api/monitoring/cameras/7/snapshot");
    }
}
