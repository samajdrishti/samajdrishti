package in.gov.samajdrishti;

import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Contract tests for the capabilities the HLD/LLD adds on top of the original prototype.
 *
 * <p>Same harness as {@link ApiContractTest} - the real service, in-memory H2, the seeded demo
 * dataset - because the point of these is to pin behaviour that only shows up end to end: the
 * offline-sync idempotency, the geofence gate on starting an inspection, the ATR lifecycle,
 * and the human review loop.
 *
 * <p>Two conventions worth knowing when reading these bodies. Every request field is
 * snake_case, because {@code JacksonConfig} applies {@code SNAKE_CASE} to both directions and
 * a camelCase body silently binds to null. And each test builds its own inspection rather than
 * reusing the first of the officer's list, because the suite shares one database and a
 * mutation in one test would otherwise leak into the next.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestConfig.class)
class LldWorkflowTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private FakeAiEngineTransport ai;

    private String adminToken;
    private String officialToken;
    private int officialId;

    @BeforeEach
    void signIn() throws Exception {
        ai.reset();
        adminToken = login("admin@samajdrishti.gov.in", "Admin@123");
        officialToken = login("official1@samajdrishti.gov.in", "Official@123");
        officialId = ownOfficialId();
    }

    private String login(String email, String password) throws Exception {
        MvcResult result = mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}""".formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$.token");
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    // ------------------------------------------------ offline sync (LLD §18)

    @Test
    @DisplayName("a replayed evidence upload with the same client_id does not duplicate the row")
    void evidenceUploadIsIdempotentOnClientId() throws Exception {
        int id = newInspection();
        String clientId = "offline-" + java.util.UUID.randomUUID();

        MvcResult first = mvc.perform(multipart("/api/evidence")
                        .file(new MockMultipartFile("file", "site.jpg", "image/jpeg", new byte[]{9, 8, 7, 6}))
                        .param("inspection_id", String.valueOf(id))
                        .param("lat", String.valueOf(latOf(id)))
                        .param("lng", String.valueOf(lngOf(id)))
                        .param("client_id", clientId)
                        .param("sync_status", "synced")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.duplicate").value(false))
                .andExpect(jsonPath("$.client_id").value(clientId))
                .andExpect(jsonPath("$.file_hash").exists())
                .andReturn();
        int evidenceId = JsonPath.read(first.getResponse().getContentAsString(), "$.id");

        // The ack was lost, so the phone retries the identical upload.
        mvc.perform(multipart("/api/evidence")
                        .file(new MockMultipartFile("file", "site.jpg", "image/jpeg", new byte[]{9, 8, 7, 6}))
                        .param("inspection_id", String.valueOf(id))
                        .param("lat", String.valueOf(latOf(id)))
                        .param("lng", String.valueOf(lngOf(id)))
                        .param("client_id", clientId)
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicate").value(true))
                .andExpect(jsonPath("$.id").value(evidenceId));
    }

    @Test
    @DisplayName("the same bytes under a different client_id are caught as a duplicate hash")
    void evidenceUploadIsIdempotentOnFileHash() throws Exception {
        int id = newInspection();
        byte[] bytes = {(byte) id, 42, 43, 44};

        mvc.perform(multipart("/api/evidence")
                        .file(new MockMultipartFile("file", "a.jpg", "image/jpeg", bytes))
                        .param("inspection_id", String.valueOf(id))
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.duplicate").value(false));

        mvc.perform(multipart("/api/evidence")
                        .file(new MockMultipartFile("file", "b.jpg", "image/jpeg", bytes))
                        .param("inspection_id", String.valueOf(id))
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicate").value(true))
                .andExpect(jsonPath("$.duplicate_hash").value(true));
    }

    @Test
    @DisplayName("an evidence upload of a disallowed type is refused before anything is stored")
    void evidenceUploadValidatesTheFile() throws Exception {
        int id = newInspection();
        mvc.perform(multipart("/api/evidence")
                        .file(new MockMultipartFile("file", "payload.exe",
                                "application/octet-stream", new byte[]{1, 2, 3}))
                        .param("inspection_id", String.valueOf(id))
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").exists());
    }

    // ----------------------------------------------- geofence-gated start (§6/§19)

    @Test
    @DisplayName("an inspection cannot be started without a passing location check")
    void startingRequiresAVerifiedGeofence() throws Exception {
        int id = newInspection();
        mvc.perform(post("/api/inspections/" + id + "/accept")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk());

        // No coordinates at all: the gate must refuse rather than let it through unverified.
        mvc.perform(post("/api/inspections/" + id + "/start")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("location check is required")));

        // Coordinates far from the site: the gate must still refuse.
        mvc.perform(post("/api/inspections/" + id + "/start")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lat":19.0,"lng":72.8}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("did not pass")));

        // On site: allowed, and the flag is persisted.
        mvc.perform(post("/api/inspections/" + id + "/start")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lat":%s,"lng":%s}""".formatted(latOf(id), lngOf(id))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inspection.gps_verified").value(true))
                .andExpect(jsonPath("$.inspection.status").value("in_progress"));
    }

    @Test
    @DisplayName("POST /inspections/{id}/location persists the verdict on the inspection")
    void locationRoutePersistsTheVerdict() throws Exception {
        int id = newInspection();
        // Accepted first: a passing location check only advances an accepted inspection to
        // gps_verified, since §19 requires the officer to have taken the duty on.
        mvc.perform(post("/api/inspections/" + id + "/accept")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk());

        mvc.perform(post("/api/inspections/" + id + "/location")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lat":%s,"lng":%s,"accuracy":8.0}"""
                                .formatted(latOf(id), lngOf(id))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verified").value(true))
                .andExpect(jsonPath("$.accuracy").value(8.0))
                .andExpect(jsonPath("$.radius_meters").value(250))
                .andExpect(jsonPath("$.inspection_status").value("gps_verified"));

        mvc.perform(get("/api/inspections/" + id + "/location")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verified").value(true))
                .andExpect(jsonPath("$.verdict").value("verified"));
    }

    // ---------------------------------------------------- attendance (§9)

    @Test
    @DisplayName("observed/registered is stored as a percentage: 103/120 is 85.83")
    void attendancePercentageIsComputedOnWrite() throws Exception {
        int id = newInspection();
        mvc.perform(post("/api/inspections/" + id + "/attendance")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"registered":120,"reported":120,"observed":103}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attendance_percentage").value(85.83))
                .andExpect(jsonPath("$.record.registered_count").value(120))
                .andExpect(jsonPath("$.record.observed_count").value(103));
    }

    @Test
    @DisplayName("a replayed offline attendance submit does not create a second record")
    void attendanceSubmitIsIdempotent() throws Exception {
        int id = newInspection();
        String clientId = "att-" + java.util.UUID.randomUUID();
        String body = """
                {"registered":50,"reported":50,"observed":48,"client_id":"%s"}""".formatted(clientId);

        mvc.perform(post("/api/inspections/" + id + "/attendance")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicate").value(false));

        mvc.perform(post("/api/inspections/" + id + "/attendance")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.duplicate").value(true));
    }

    @Test
    @DisplayName("counting more people than are on the roll is refused")
    void attendanceRejectsAnImpossibleCount() throws Exception {
        int id = newInspection();
        mvc.perform(post("/api/inspections/" + id + "/attendance")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"registered":10,"reported":10,"observed":25}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("cannot exceed registered")));
    }

    // ---------------------------------------------------- checklist (§8)

    @Test
    @DisplayName("a checklist item can be answered individually with its own remarks")
    void checklistItemsAreIndividuallyAddressable() throws Exception {
        int id = newInspection();
        mvc.perform(put("/api/inspections/" + id + "/checklist/resident_headcount")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"failed","remarks":"Only 96 of 120 residents present"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.item.status").value("failed"))
                .andExpect(jsonPath("$.item.remarks").value("Only 96 of 120 residents present"))
                .andExpect(jsonPath("$.item.verified_at").exists());

        mvc.perform(get("/api/inspections/" + id + "/checklist")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(jsonPath("$.items[?(@.item_code=='resident_headcount')].status").value("failed"));
    }

    @Test
    @DisplayName("failing a checklist item without a remark is refused")
    void failedChecklistItemNeedsAReason() throws Exception {
        int id = newInspection();
        mvc.perform(put("/api/inspections/" + id + "/checklist/medical_log")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"failed"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("needs a remark")));
    }

    @Test
    @DisplayName("an unknown checklist item code is a 404, not a silent no-op")
    void unknownChecklistItemIsNotFound() throws Exception {
        int id = newInspection();
        mvc.perform(put("/api/inspections/" + id + "/checklist/not_a_real_item")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"verified"}"""))
                .andExpect(status().isNotFound());
    }

    // --------------------------------------------------- anomalies (§9/§10)

    @Test
    @DisplayName("analysis persists a finding that stays unverified until a human decides")
    void anomaliesArePersistedAndUnverified() throws Exception {
        int id = newInspection();
        submitShortAttendance(id);

        mvc.perform(post("/api/anomalies/inspections/" + id + "/analyze")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(greaterThan(0)));

        int anomalyId = anomalyIdOfType(id, "ATTENDANCE_MISMATCH");
        mvc.perform(get("/api/anomalies/" + anomalyId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.human_verified").value(false))
                .andExpect(jsonPath("$.status").value("open"))
                .andExpect(jsonPath("$.type").value("ATTENDANCE_MISMATCH"))
                .andExpect(jsonPath("$.severity").value("high"));
    }

    @Test
    @DisplayName("verifying an anomaly records the reviewer, and dismissing needs a reason")
    void anomalyVerificationIsRecorded() throws Exception {
        int id = newInspection();
        submitShortAttendance(id);
        mvc.perform(post("/api/anomalies/inspections/" + id + "/analyze")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());
        int anomalyId = anomalyIdOfType(id, "ATTENDANCE_MISMATCH");

        mvc.perform(put("/api/anomalies/" + anomalyId + "/verify")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"confirmed":false}"""))
                .andExpect(status().isBadRequest());

        mvc.perform(put("/api/anomalies/" + anomalyId + "/verify")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"confirmed":true,"remarks":"Confirmed against the institution register"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.human_verified").value(true))
                .andExpect(jsonPath("$.status").value("confirmed"))
                .andExpect(jsonPath("$.verified_at").exists());
    }

    @Test
    @DisplayName("the deterministic findings still hold when the AI engine is offline")
    void anomaliesSurviveAnOfflineEngine() throws Exception {
        ai.offline = true;
        try {
            int id = newInspection();
            submitShortAttendance(id);
            mvc.perform(post("/api/anomalies/inspections/" + id + "/analyze")
                            .header("Authorization", bearer(adminToken)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.count").value(greaterThan(0)));
        } finally {
            ai.offline = false;
        }
    }

    @Test
    @DisplayName("an officer cannot run the analysis pass, which is a back-office action")
    void analysisIsBackOfficeOnly() throws Exception {
        int id = newInspection();
        mvc.perform(post("/api/anomalies/inspections/" + id + "/analyze")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------ ATR (§12)

    @Test
    @DisplayName("an ATR can be raised, updated, answered, and closed with a verification verdict")
    void atrLifecycle() throws Exception {
        int inspectionId = newInspection();

        MvcResult created = mvc.perform(post("/api/atr")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"inspection_id":%d,"action_description":"Verify the attendance register",
                                 "deadline":"2026-10-15"}""".formatted(inspectionId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.atr.status").value("open"))
                .andExpect(jsonPath("$.atr.verification_status").value("pending"))
                .andReturn();
        int atrId = ((Number) JsonPath.read(created.getResponse().getContentAsString(), "$.atr.id")).intValue();

        mvc.perform(put("/api/atr/" + atrId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"action_in_progress","remarks":"Officer acknowledged"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.atr.status").value("action_in_progress"));

        mvc.perform(post("/api/atr/" + atrId + "/respond")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ngo_reply":"Register corrected and uploaded"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.atr.status").value("under_review"));

        mvc.perform(post("/api/atr/" + atrId + "/close")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"verification_status":"verified","remarks":"Register matches the count"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.atr.status").value("verified_closed"))
                .andExpect(jsonPath("$.atr.closed_at").exists());
    }

    @Test
    @DisplayName("a rejected verification leaves the action open rather than closing it")
    void atrRejectionDoesNotCloseTheAction() throws Exception {
        int inspectionId = newInspection();
        MvcResult created = mvc.perform(post("/api/atr")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"inspection_id":%d,"action_description":"Fix the medicine register"}"""
                                .formatted(inspectionId)))
                .andExpect(status().isOk())
                .andReturn();
        int atrId = ((Number) JsonPath.read(created.getResponse().getContentAsString(), "$.atr.id")).intValue();

        mvc.perform(post("/api/atr/" + atrId + "/close")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"verification_status":"rejected","remarks":"Photo predates the action"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.atr.status").value("rejected_reinspection"))
                .andExpect(jsonPath("$.atr.verification_status").value("rejected"));

        mvc.perform(post("/api/atr/" + atrId + "/close")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("already closed")));
    }

    @Test
    @DisplayName("an ATR with nothing to trace it to is refused")
    void atrNeedsAnAnchor() throws Exception {
        mvc.perform(post("/api/atr")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action_description":"Do the needful"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("must reference")));
    }

    @Test
    @DisplayName("only the back office may raise or close an ATR")
    void atrWritesAreBackOfficeOnly() throws Exception {
        int inspectionId = newInspection();
        mvc.perform(post("/api/atr")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"inspection_id":%d,"action_description":"Unauthorised"}"""
                                .formatted(inspectionId)))
                .andExpect(status().isForbidden());
    }

    // ----------------------------------------------- assignments (§16)

    @Test
    @DisplayName("assigning without naming an officer picks one and records the ledger row")
    void randomAssignmentPicksAnOfficer() throws Exception {
        int inspectionId = unassignedInspection();

        mvc.perform(post("/api/assignments")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"inspection_id":%d}""".formatted(inspectionId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignment.status").value("assigned"))
                .andExpect(jsonPath("$.assignment.assignment_type").value("random"))
                .andExpect(jsonPath("$.officer.id").exists());
    }

    @Test
    @DisplayName("the eligibility list says why each ineligible officer was passed over")
    void eligibilityExplainsItsRejections() throws Exception {
        int inspectionId = unassignedInspection();
        mvc.perform(get("/api/assignments/eligible?inspection_id=" + inspectionId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eligible_count").value(greaterThan(0)));

        // Saturate the chosen officer so the next eligibility query has to reject somebody,
        // which is the only way to observe the reason codes.
        MvcResult assigned = mvc.perform(post("/api/assignments")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"inspection_id":%d}""".formatted(inspectionId)))
                .andExpect(status().isOk())
                .andReturn();
        int chosen = ((Number) JsonPath.<Map<String, Object>>read(
                assigned.getResponse().getContentAsString(), "$.officer").get("id")).intValue();

        for (int i = 0; i < 3; i++) {
            mvc.perform(post("/api/assignments")
                            .header("Authorization", bearer(adminToken))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"inspection_id":%d,"officer_id":%d}"""
                                    .formatted(unassignedInspection(), chosen)))
                    .andExpect(status().isOk());
        }

        mvc.perform(get("/api/assignments/eligible?inspection_id=" + unassignedInspection())
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rejected[?(@.id==%d)].reason".formatted(chosen))
                        .value("at_workload_limit"));
    }

    @Test
    @DisplayName("a declined assignment is kept in the ledger and the inspection re-opens")
    void assignmentAcceptAndDecline() throws Exception {
        int inspectionId = unassignedInspection();
        MvcResult created = mvc.perform(post("/api/assignments")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"inspection_id":%d,"officer_id":%d}"""
                                .formatted(inspectionId, officialId)))
                .andExpect(status().isOk())
                .andReturn();
        int assignmentId = ((Number) JsonPath.read(created.getResponse().getContentAsString(),
                "$.assignment.id")).intValue();

        mvc.perform(post("/api/assignments/" + assignmentId + "/accept")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("accepted"));

        mvc.perform(post("/api/assignments/" + assignmentId + "/decline")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"reason":"Already at another institution"}"""))
                .andExpect(status().isOk());

        // The row is retained rather than deleted, and the inspection is open again.
        mvc.perform(get("/api/assignments?inspection_id=" + inspectionId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("reassigned"))
                .andExpect(jsonPath("$[0].declined_reason").value("Already at another institution"));
    }

    // ------------------------------------------------- institutions (§17 radius)

    @Test
    @DisplayName("an institution carries its own geofence radius, which the location check honours")
    void institutionsConfigureTheGeofence() throws Exception {
        int projectId = newProject(11.0200, 76.9500);
        mvc.perform(post("/api/institutions")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Campus Home","type":"home","district":"Coimbatore",
                                 "project_id":%d,"geofence_radius":800,
                                 "geo_coords":{"lat":11.0200,"lng":76.9500}}""".formatted(projectId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.geofence_radius").value(800.0));

        // ~600 m north of the site: inside the declared 800 m radius, outside the 250 m default.
        int inspectionId = newInspectionFor(projectId);
        mvc.perform(post("/api/inspections/" + inspectionId + "/location")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lat":11.0254,"lng":76.9500}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verified").value(true))
                .andExpect(jsonPath("$.radius_meters").value(800));
    }

    @Test
    @DisplayName("a geofence radius that would cover a whole district is refused")
    void institutionRejectsAnAbsurdRadius() throws Exception {
        mvc.perform(post("/api/institutions")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Too Wide","geofence_radius":50000}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("may not exceed")));
    }

    // ------------------------------------------------------- reports (§21)

    @Test
    @DisplayName("filing a report freezes the summary against later evidence uploads")
    void reportsAreFiledAndFrozen() throws Exception {
        int inspectionId = newInspection();
        MvcResult filed = mvc.perform(post("/api/inspection-reports/inspections/" + inspectionId + "/submit")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"notes":"Overall compliant."}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.report.report_status").value("submitted"))
                .andExpect(jsonPath("$.report.risk_level").exists())
                .andExpect(jsonPath("$.report.geo_verdict").exists())
                .andReturn();
        int reportId = ((Number) JsonPath.read(filed.getResponse().getContentAsString(), "$.report_id")).intValue();

        String summary = JsonPath.read(
                mvc.perform(get("/api/inspection-reports/" + reportId)
                                .header("Authorization", bearer(adminToken)))
                        .andReturn().getResponse().getContentAsString(), "$.summary");

        // Uploading evidence afterwards must not rewrite the filed conclusion.
        mvc.perform(multipart("/api/evidence")
                        .file(new MockMultipartFile("file", "late.jpg", "image/jpeg",
                                new byte[]{(byte) inspectionId, 5, 6}))
                        .param("inspection_id", String.valueOf(inspectionId))
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isCreated());

        String after = JsonPath.read(
                mvc.perform(get("/api/inspection-reports/" + reportId)
                                .header("Authorization", bearer(adminToken)))
                        .andReturn().getResponse().getContentAsString(), "$.summary");
        assertThat(after).isEqualTo(summary);
    }

    @Test
    @DisplayName("a filed report cannot be silently refiled")
    void reportsCannotBeRefiledSilently() throws Exception {
        int inspectionId = newInspection();
        mvc.perform(post("/api/inspection-reports/inspections/" + inspectionId + "/submit")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk());

        mvc.perform(post("/api/inspection-reports/inspections/" + inspectionId + "/submit")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("already filed")));
    }

    // ---------------------------------------------------- state machine (§19)

    @Test
    @DisplayName("an illegal transition is refused with the list of allowed moves")
    void illegalTransitionsAreRefused() throws Exception {
        int id = newInspection();
        mvc.perform(put("/api/inspections/" + id + "/status")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"closed"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(containsString("Allowed next")));
    }

    // ------------------------------------------------------------------ helpers

    /**
     * A fresh inspection on the first seeded project, assigned to official1.
     *
     * <p>Coordinates are the project's own, so a geofence check genuinely passes. Every test
     * builds its own because the suite shares one database: reusing the first row would mean
     * one test's status change decided the next test's outcome.
     */
    private int newInspection() throws Exception {
        int projectId = firstProjectId();
        MvcResult result = mvc.perform(post("/api/inspections/assign")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"project_id":%d,"assigned_to":%d}""".formatted(projectId, officialId)))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).intValue();
    }

    private int newInspectionFor(int projectId) throws Exception {
        MvcResult result = mvc.perform(post("/api/inspections/assign")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"project_id":%d,"assigned_to":%d}""".formatted(projectId, officialId)))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).intValue();
    }

    /** An inspection nobody holds, so the assignment algorithm has to choose. */
    private int unassignedInspection() throws Exception {
        MvcResult result = mvc.perform(post("/api/inspections/assign")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"project_id":%d}""".formatted(firstProjectId())))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).intValue();
    }

    private int newProject(double lat, double lng) throws Exception {
        MvcResult result = mvc.perform(post("/api/projects")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"Test Site %s","department":"avyay",
                                 "geo_coords":{"lat":%s,"lng":%s}}"""
                                .formatted(java.util.UUID.randomUUID(), lat, lng)))
                .andExpect(status().isCreated())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.id")).intValue();
    }

    private void submitShortAttendance(int inspectionId) throws Exception {
        mvc.perform(post("/api/inspections/" + inspectionId + "/attendance")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"registered":100,"reported":100,"observed":40}"""))
                .andExpect(status().isOk());
    }

    /**
     * The id of one specific finding.
     *
     * <p>By type rather than "the first one": the list is newest-first, and the AI engine's
     * own finding is appended after the deterministic ones, so index 0 is whichever ran
     * last rather than the one under test.
     */
    private int anomalyIdOfType(int inspectionId, String type) throws Exception {
        MvcResult result = mvc.perform(get("/api/anomalies/inspections/" + inspectionId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(greaterThan(0)))
                .andReturn();
        for (Map<String, Object> row : JsonPath.<java.util.List<Map<String, Object>>>read(
                result.getResponse().getContentAsString(), "$.anomalies")) {
            if (type.equals(row.get("type"))) {
                return ((Number) row.get("id")).intValue();
            }
        }
        throw new AssertionError("No " + type + " was raised for inspection " + inspectionId);
    }

    private int firstProjectId() throws Exception {
        MvcResult result = mvc.perform(get("/api/projects")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$[0].id");
    }

    private int ownOfficialId() throws Exception {
        MvcResult result = mvc.perform(get("/api/auth/profile")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk())
                .andReturn();
        return ((Number) JsonPath.read(result.getResponse().getContentAsString(), "$.user.id")).intValue();
    }

    /** The registered site coordinates of the project an inspection belongs to. */
    private double latOf(int inspectionId) throws Exception {
        return projectCoord(inspectionId, "lat");
    }

    private double lngOf(int inspectionId) throws Exception {
        return projectCoord(inspectionId, "lng");
    }

    private double projectCoord(int inspectionId, String key) throws Exception {
        MvcResult inspection = mvc.perform(get("/api/inspections/" + inspectionId)
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk())
                .andReturn();
        int projectId = JsonPath.read(inspection.getResponse().getContentAsString(), "$.project_id");
        MvcResult project = mvc.perform(get("/api/projects/" + projectId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(project.getResponse().getContentAsString(), "$.project.geo_coords." + key);
    }
}
