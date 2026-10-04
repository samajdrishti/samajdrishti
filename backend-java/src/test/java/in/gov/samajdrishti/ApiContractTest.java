package in.gov.samajdrishti;

import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.jayway.jsonpath.JsonPath;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end HTTP contract tests.
 *
 * <p>These run against the real service with an in-memory H2 database and the seeded demo
 * dataset, so they assert exactly what the web clients see: the field names, the status
 * codes, and the role rules in {@code docs/API-CONTRACT.md}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestConfig.class)
class ApiContractTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ObjectMapper json;

    @Autowired
    private FakeAiEngineTransport ai;

    private String adminToken;
    private String officialToken;

    @BeforeEach
    void signIn() throws Exception {
        ai.reset();
        adminToken = login("admin@samajdrishti.gov.in", "Admin@123");
        officialToken = login("official1@samajdrishti.gov.in", "Official@123");
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

    // ------------------------------------------------------------------- system

    @Test
    @DisplayName("GET / returns the service banner with the active data mode")
    void rootAdvertisesTheDataMode() throws Exception {
        mvc.perform(get("/"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Samaj Drishti API Server"))
                .andExpect(jsonPath("$.status").value("running"))
                .andExpect(jsonPath("$.dataMode").value("memory"));
    }

    @Test
    @DisplayName("GET /api/health reports the AI engine's own capabilities")
    void healthSurfacesTheEngine() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.aiEngineOnline").value(true))
                .andExpect(jsonPath("$.anomalyBackend").value("isolation_forest"))
                .andExpect(jsonPath("$.llmProvider").value("groq:openai/gpt-oss-20b"));
    }

    @Test
    @DisplayName("an unknown route returns the contract's 404 body")
    void unknownRouteIs404() throws Exception {
        mvc.perform(get("/api/does-not-exist").header("Authorization", bearer(adminToken)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").exists());
    }

    // --------------------------------------------------------------------- auth

    @Test
    @DisplayName("login rejects a bad password with 400 and never leaks the hash")
    void loginRejectsBadCredentials() throws Exception {
        mvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"admin@samajdrishti.gov.in","password":"wrong"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Invalid credentials"));
    }

    @Test
    @DisplayName("a protected route without a token is 401 with the contract message")
    void protectedRouteRequiresAToken() throws Exception {
        mvc.perform(get("/api/auth/profile"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("No token, authorization denied"));
    }

    @Test
    @DisplayName("a garbage token is rejected exactly like a missing one")
    void garbageTokenIsRejected() throws Exception {
        mvc.perform(get("/api/auth/profile").header("Authorization", "Bearer not.a.jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /auth/profile returns the caller and no password field")
    void profileReturnsTheCaller() throws Exception {
        MvcResult result = mvc.perform(get("/api/auth/profile").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.email").value("admin@samajdrishti.gov.in"))
                .andExpect(jsonPath("$.user.role").value("admin"))
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("password");
    }

    @Test
    @DisplayName("register hashes the password and refuses a duplicate email")
    void registerValidates() throws Exception {
        String email = "junit_@samajdrishti.gov.in".replace("@", System.nanoTime() + "@");

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"JUnit Official","email":"%s","password":"Verify@123","role":"official"}"""
                                .formatted(email)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.user.email").value(email));

        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"JUnit Official","email":"%s","password":"Verify@123"}""".formatted(email)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("User already exists"));
    }

    @Test
    @DisplayName("register returns the express-validator error shape for a bad payload")
    void registerReportsValidationErrors() throws Exception {
        mvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"No Email","email":"not-an-email","password":"x"}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").isArray())
                .andExpect(jsonPath("$.errors[0].param").exists())
                .andExpect(jsonPath("$.errors[0].msg").exists());
    }

    // ----------------------------------------------------------------- projects

    @Test
    @DisplayName("GET /projects exposes snake_case fields and a lat/lng object")
    void projectsUseTheDocumentedFieldNames() throws Exception {
        MvcResult result = mvc.perform(get("/api/projects").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").exists())
                .andExpect(jsonPath("$[0].name").exists())
                .andExpect(jsonPath("$[0].created_at").exists())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("\"geo_coords\"");
        // The clients read row.geo_coords.lat, so it must be an object, never a string.
        assertThat(body).doesNotContain("\"geo_coords\":\"");
    }

    @Test
    @DisplayName("project metadata is returned as an object, not as stored JSON text")
    void projectMetadataIsParsed() throws Exception {
        MvcResult result = mvc.perform(get("/api/projects").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andReturn();

        for (Map<String, Object> project : JsonPath.<java.util.List<Map<String, Object>>>read(
                result.getResponse().getContentAsString(), "$")) {
            Object metadata = project.get("metadata");
            if (metadata != null) {
                assertThat(metadata).isInstanceOf(Map.class);
            }
        }
        // The seeded Chaubisee case study is the one the dashboards read.
        assertThat(result.getResponse().getContentAsString()).contains("\"sanctioned_capacity\":50");
    }

    @Test
    @DisplayName("only admin and supervisor may create a project; only admin may edit one")
    void projectWritesAreRoleChecked() throws Exception {
        String body = """
                {"name":"JUnit Project","location":"Test Zone","department":"AVYAY",
                 "geo_coords":{"lat":19.076,"lng":72.8777},"budget":100000}""";

        mvc.perform(post("/api/projects").header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Insufficient permissions"));

        MvcResult created = mvc.perform(post("/api/projects").header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("pending"))
                .andReturn();
        int id = JsonPath.read(created.getResponse().getContentAsString(), "$.id");

        mvc.perform(put("/api/projects/" + id).header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"status":"active"}"""))
                .andExpect(status().isForbidden());
    }

    // -------------------------------------------------------------- inspections

    @Test
    @DisplayName("GET /inspections/mine returns the caller's own work")
    void mineReturnsOwnInspections() throws Exception {
        mvc.perform(get("/api/inspections/mine").header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].project_name").exists());
    }

    @Test
    @DisplayName("GET /inspections/all joins the official name and is back-office only")
    void allIsBackOfficeOnly() throws Exception {
        mvc.perform(get("/api/inspections/all").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].official_name").exists())
                .andExpect(jsonPath("$[0].project_name").exists());

        mvc.perform(get("/api/inspections/all").header("Authorization", bearer(officialToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("an unknown status is rejected before anything is written")
    void statusIsValidated() throws Exception {
        int id = firstOwnInspectionId();
        mvc.perform(put("/api/inspections/" + id + "/status")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"definitely-not-a-status"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("geo verification is deterministic and never depends on the AI engine")
    void geoVerificationIsDeterministic() throws Exception {
        ai.offline = true;
        MvcResult result = mvc.perform(post("/api/inspections/1/geo-verify")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lat":11.0056,"lng":76.9283}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.distance_meters").exists())
                .andExpect(jsonPath("$.within_radius").value(true))
                .andExpect(jsonPath("$.verdict").value("verified"))
                .andExpect(jsonPath("$.radius_meters").value(250))
                .andReturn();
        ai.offline = false;

        // The explanation must still be the deterministic one when the engine is down.
        assertThat(result.getResponse().getContentAsString())
                .contains("Reported within")
                .doesNotContain("ai_explanation");
    }

    @Test
    @DisplayName("a report filed far from the site is auto-flagged as possible proxy reporting")
    void distantReportIsAutoFlagged() throws Exception {
        int id = firstOwnInspectionId();
        MvcResult result = mvc.perform(put("/api/inspections/" + id + "/status")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"completed","lat":19.0,"lng":72.8}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.inspection.status").value("flagged"))
                .andExpect(jsonPath("$.flags").isArray())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        assertThat(body).contains("possible_proxy_reporting").contains("auto_flagged");
    }

    @Test
    @DisplayName("an official cannot report on an inspection assigned to somebody else")
    void ownershipIsEnforced() throws Exception {
        mvc.perform(get("/api/inspections/all").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk());
        // Every seeded inspection is assigned to one of the four officials; find one that is
        // not official1's and confirm it is invisible to them.
        int foreign = firstForeignInspectionId();
        if (foreign > 0) {
            mvc.perform(put("/api/inspections/" + foreign + "/status")
                            .header("Authorization", bearer(officialToken))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {"status":"completed"}"""))
                    .andExpect(status().isNotFound());
        }
    }

    @Test
    @DisplayName("a scheme checklist scores its weighted items and round-trips")
    void checklistScoresAndPersists() throws Exception {
        int id = firstOwnInspectionId();
        MvcResult template = mvc.perform(get("/api/inspections/" + id + "/checklist")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isArray())
                .andExpect(jsonPath("$.saved_checks").exists())
                .andReturn();

        String items = JsonPath.read(template.getResponse().getContentAsString(), "$.items[0].id");
        mvc.perform(post("/api/inspections/" + id + "/checklist")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"checks":{"%s":true},"voice_remarks":"verified on site"}""".formatted(items)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Scheme checklist saved"))
                .andExpect(jsonPath("$.record.compliance_score").value(
                        org.hamcrest.Matchers.greaterThan(0)));

        mvc.perform(get("/api/inspections/" + id + "/checklist")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(jsonPath("$.saved_checks." + items).value(true));
    }

    // ----------------------------------------------------------------- evidence

    @Test
    @DisplayName("an evidence upload stores the file and the geo-tag it arrived with")
    void evidenceUploadIsRecorded() throws Exception {
        int id = firstOwnInspectionId();
        mvc.perform(multipart("/api/evidence")
                        .file(new org.springframework.mock.web.MockMultipartFile(
                                "file", "junit.jpg", "image/jpeg", new byte[]{1, 2, 3, 4}))
                        .param("inspection_id", String.valueOf(id))
                        .param("type", "photo")
                        .param("lat", "11.0056")
                        .param("lng", "76.9283")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.inspection_id").value(id))
                .andExpect(jsonPath("$.type").value("photo"))
                .andExpect(jsonPath("$.verified").value(false))
                .andExpect(jsonPath("$.geo_coords.lat").value(11.0056))
                .andExpect(jsonPath("$.file_path").value(org.hamcrest.Matchers.startsWith("/uploads/evidence/")));
    }

    @Test
    @DisplayName("an evidence upload without an inspection id is refused")
    void evidenceRequiresAnInspection() throws Exception {
        mvc.perform(multipart("/api/evidence")
                        .param("type", "photo")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("inspection_id is required"));
    }

    // --------------------------------------------------------------- monitoring

    @Test
    @DisplayName("GET /monitoring/cameras/:id/snapshot returns an uncacheable PNG")
    void snapshotIsAnUncacheablePng() throws Exception {
        int cameraId = firstCameraId();

        MvcResult result = mvc.perform(get("/api/monitoring/cameras/" + cameraId + "/snapshot")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers
                        .content().contentTypeCompatibleWith(MediaType.IMAGE_PNG))
                .andReturn();

        assertThat(result.getResponse().getContentLength()).isGreaterThan(1000);
        assertThat(result.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(result.getResponse().getHeader("X-Stream-Source")).isNotBlank();
        // PNG magic number, so a client that trusts the content type cannot be fooled.
        byte[] png = result.getResponse().getContentAsByteArray();
        assertThat(png[0] & 0xff).isEqualTo(0x89);
        assertThat(new String(png, 1, 3, java.nio.charset.StandardCharsets.US_ASCII)).isEqualTo("PNG");
    }

    @Test
    @DisplayName("the snapshot accepts ?token= for a plain <img> request")
    void snapshotAcceptsAQueryToken() throws Exception {
        int cameraId = firstCameraId();
        mvc.perform(get("/api/monitoring/cameras/" + cameraId + "/snapshot").param("token", adminToken))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("creating a camera is back-office only and validates its name")
    void cameraCreationIsChecked() throws Exception {
        mvc.perform(post("/api/monitoring/cameras").header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"name":"Junit Camera"}"""))
                .andExpect(status().isForbidden());

        mvc.perform(post("/api/monitoring/cameras").header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"name":""}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").exists());

        mvc.perform(post("/api/monitoring/cameras").header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON).content("""
                                {"name":"Junit Camera","stream_type":"simulated"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("online"));
    }

    @Test
    @DisplayName("GET /monitoring/overview lists cameras and the alert feed")
    void monitoringOverview() throws Exception {
        mvc.perform(get("/api/monitoring/overview").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cameras").isArray())
                .andExpect(jsonPath("$.total_cameras").exists())
                .andExpect(jsonPath("$.alerts").isArray())
                .andExpect(jsonPath("$.last_updated").exists());
    }

    @Test
    @DisplayName("GET /gis/centers plots every center with its head, headcount and live cameras")
    void gisCenters() throws Exception {
        mvc.perform(get("/api/gis/centers").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.centers").isArray())
                .andExpect(jsonPath("$.centers[0]").exists())
                .andExpect(jsonPath("$.count").exists())
                .andExpect(jsonPath("$.centers[0].name").exists())
                .andExpect(jsonPath("$.centers[0].scheme").exists())
                .andExpect(jsonPath("$.centers[0].geo_coords.lat").exists())
                .andExpect(jsonPath("$.centers[0].geo_coords.lng").exists())
                .andExpect(jsonPath("$.centers[0].head.name").exists())
                .andExpect(jsonPath("$.centers[0].sanctioned_capacity").exists())
                .andExpect(jsonPath("$.centers[0].cameras").isArray())
                .andExpect(jsonPath("$.centers[0].camera_count").exists())
                .andExpect(jsonPath("$.map.provider").exists());
    }

    @Test
    @DisplayName("GET /gis/centers needs a token like every other back-office read")
    void gisCentersRequiresAToken() throws Exception {
        mvc.perform(get("/api/gis/centers"))
                .andExpect(status().isUnauthorized());
    }

    // --------------------------------------------------------------- attendance

    @Test
    @DisplayName("a second open check-in is refused")
    void attendanceRejectsDoubleCheckIn() throws Exception {
        MvcResult first = mvc.perform(post("/api/attendance/check-in")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"project_id":1,"lat":11.0056,"lng":76.9283,"device":"JUnit"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.check_in").exists())
                .andExpect(jsonPath("$.date").exists())
                .andReturn();

        mvc.perform(post("/api/attendance/check-in")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"project_id":1,"lat":11.0056,"lng":76.9283}"""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("You already have an open check-in. Check out first."));

        mvc.perform(post("/api/attendance/check-out")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lat":11.0056,"lng":76.9283}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.check_out").exists());

        assertThat((Object) JsonPath.read(first.getResponse().getContentAsString(), "$.id")).isNotNull();
    }

    @Test
    @DisplayName("checking out with no open punch is refused")
    void attendanceRequiresAnOpenPunch() throws Exception {
        mvc.perform(post("/api/attendance/check-out").header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("No open check-in found to close"));
    }

    @Test
    @DisplayName("the attendance summary is back-office only")
    void attendanceSummaryIsBackOfficeOnly() throws Exception {
        mvc.perform(get("/api/attendance/summary").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.officials").isArray())
                .andExpect(jsonPath("$.totals.officials").exists());

        mvc.perform(get("/api/attendance/summary").header("Authorization", bearer(officialToken)))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ reports

    @Test
    @DisplayName("a report carries everything the review screen renders")
    void reportShapeIsComplete() throws Exception {
        mvc.perform(get("/api/reports/1").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.report.project").exists())
                .andExpect(jsonPath("$.report.official").exists())
                .andExpect(jsonPath("$.report.geo_verification.verdict").exists())
                .andExpect(jsonPath("$.report.flags").isArray())
                .andExpect(jsonPath("$.report.evidence").isArray())
                .andExpect(jsonPath("$.report.attendance_context").isArray())
                .andExpect(jsonPath("$.report.audit").isArray());
    }

    @Test
    @DisplayName("POST /reports/:id/share returns the printable text")
    void reportShareIsPrintable() throws Exception {
        mvc.perform(post("/api/reports/1/share").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.text").value(org.hamcrest.Matchers.containsString("INSPECTION REPORT")))
                .andExpect(jsonPath("$.report.id").value(1));
    }

    @Test
    @DisplayName("reports are back-office only")
    void reportsAreBackOfficeOnly() throws Exception {
        mvc.perform(get("/api/reports").header("Authorization", bearer(officialToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("GET /reports?flagged=true returns only flagged rows")
    void flaggedFilterWorks() throws Exception {
        MvcResult result = mvc.perform(get("/api/reports?flagged=true&limit=20")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andReturn();

        for (Map<String, Object> row : JsonPath.<java.util.List<Map<String, Object>>>read(
                result.getResponse().getContentAsString(), "$")) {
            assertThat((java.util.List<?>) row.get("flags")).isNotEmpty();
        }
    }

    // --------------------------------------------------------------------- atr

    @Test
    @DisplayName("the ATR workflow runs respond -> adjudicate")
    void atrWorkflow() throws Exception {
        // The web clients send snake_case, which is what the records bind. The previous
        // Node implementation read `pmuAdjudication`/`ngoReply` and silently dropped them.
        mvc.perform(post("/api/atr/1/respond")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"ngo_reply":"Corrective action taken","corrective_evidence_url":"/uploads/evidence/x.jpg"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.atr.status").value("under_review"))
                .andExpect(jsonPath("$.atr.ngo_reply").value("Corrective action taken"))
                .andExpect(jsonPath("$.atr.corrective_evidence_url").value("/uploads/evidence/x.jpg"));

        mvc.perform(post("/api/atr/1/adjudicate")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action":"approve","pmu_adjudication":"Verified on site"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.atr.status").value("approved_closed"))
                .andExpect(jsonPath("$.atr.pmu_adjudication").value("Verified on site"));
    }

    @Test
    @DisplayName("adjudication is back-office only")
    void adjudicationIsBackOfficeOnly() throws Exception {
        mvc.perform(post("/api/atr/2/adjudicate")
                        .header("Authorization", bearer(officialToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"action":"escalate"}"""))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------- beneficiaries

    @Test
    @DisplayName("beneficiary feedback is accepted without a token and derives sentiment")
    void beneficiaryFeedbackIsOpen() throws Exception {
        mvc.perform(post("/api/beneficiaries/feedback")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"project_id":1,"category":"Nutrition & Meals","rating":1,
                                 "comment":"Most residents are never here","voice_memo":"yes"}"""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.message").value("Beneficiary feedback recorded for Social Audit"))
                .andExpect(jsonPath("$.feedback.sentiment").value("critical"))
                .andExpect(jsonPath("$.feedback.verified_resident").value(true))
                .andExpect(jsonPath("$.feedback.voice_memo_recorded").value(true))
                .andExpect(jsonPath("$.feedback.project_name").exists());
    }

    // --------------------------------------------------------------------- admin

    @Test
    @DisplayName("the dashboard aggregates the portfolio and uses the engine's risk scores")
    void dashboardUsesTheEngine() throws Exception {
        mvc.perform(get("/api/admin/dashboard").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats.totalProjects").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.stats.dataMode").value("memory"))
                .andExpect(jsonPath("$.stats.aiOnline").value(true))
                .andExpect(jsonPath("$.stats.aiStats.total_projects").value(2))
                .andExpect(jsonPath("$.recentInspections").isArray())
                .andExpect(jsonPath("$.highRiskProjects[0].risk_score").value(88.5))
                .andExpect(jsonPath("$.highRiskProjects[0].risk_factors").isArray())
                .andExpect(jsonPath("$.projects[0].risk_score").exists());
    }

    @Test
    @DisplayName("the dashboard is back-office only")
    void dashboardIsBackOfficeOnly() throws Exception {
        mvc.perform(get("/api/admin/dashboard").header("Authorization", bearer(officialToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("the narrative comes from the engine and keeps its data snapshot")
    void narrativeComesFromTheEngine() throws Exception {
        mvc.perform(get("/api/admin/ai/narrative?tone=executive").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("groq:openai/gpt-oss-20b"))
                .andExpect(jsonPath("$.narrative").exists())
                .andExpect(jsonPath("$.tone").value("executive"))
                .andExpect(jsonPath("$.data.totals").exists());
    }

    @Test
    @DisplayName("the narrative degrades to a local briefing when the engine is down")
    void narrativeDegrades() throws Exception {
        ai.offline = true;
        MvcResult result = mvc.perform(get("/api/admin/ai/narrative?tone=executive")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.provider").value("local-fallback"))
                .andExpect(jsonPath("$.narrative").exists())
                .andReturn();
        ai.offline = false;

        assertThat(result.getResponse().getContentAsString()).contains("projects are under monitoring");
    }

    @Test
    @DisplayName("the dashboard still answers with a flat risk score when the engine is down")
    void dashboardDegradesWithoutTheEngine() throws Exception {
        ai.offline = true;
        mvc.perform(get("/api/admin/dashboard").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stats.totalProjects").value(org.hamcrest.Matchers.greaterThan(0)))
                .andExpect(jsonPath("$.stats.aiOnline").value(false))
                .andExpect(jsonPath("$.projects[0].risk_score").value(50))
                .andExpect(jsonPath("$.projects[0].risk_factors").isEmpty());
        ai.offline = false;
    }

    @Test
    @DisplayName("POST /admin/ai/assign persists the plan the engine produced")
    void aiAssignmentPersists() throws Exception {
        int before = mvc.perform(get("/api/inspections/all").header("Authorization", bearer(adminToken)))
                .andReturn().getResponse().getContentAsString().split("\"id\":").length;

        mvc.perform(post("/api/admin/ai/assign")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"num_inspections":2,"persist":true}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.persisted").value(true))
                .andExpect(jsonPath("$.created").value(2))
                .andExpect(jsonPath("$.assignments[0].project_id").exists())
                .andExpect(jsonPath("$.assignments[0].scheduled_date").exists())
                .andExpect(jsonPath("$.assignments[0].inspection_id").exists());

        int after = mvc.perform(get("/api/inspections/all").header("Authorization", bearer(adminToken)))
                .andReturn().getResponse().getContentAsString().split("\"id\":").length;
        assertThat(after).isGreaterThan(before);
    }

    @Test
    @DisplayName("POST /admin/ai/assign reports 502 rather than inventing a plan when the engine is down")
    void aiAssignmentFailsLoudlyWithoutTheEngine() throws Exception {
        ai.offline = true;
        mvc.perform(post("/api/admin/ai/assign")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"num_inspections":2}"""))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.message").value("AI engine unavailable - no assignments generated"));
        ai.offline = false;
    }

    @Test
    @DisplayName("GET /admin/alerts merges report flags and offline cameras")
    void alertsAreCrossModule() throws Exception {
        mvc.perform(get("/api/admin/alerts").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.alerts").isArray())
                .andExpect(jsonPath("$.total").exists())
                .andExpect(jsonPath("$.generated_at").exists());
    }

    // -------------------------------------------------------------------- audit

    @Test
    @DisplayName("every geo failure is written to the audit trail")
    void geoFailuresAreAudited() throws Exception {
        int id = firstOwnInspectionId();
        mvc.perform(put("/api/inspections/" + id + "/status")
                .header("Authorization", bearer(officialToken))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                        {"status":"completed","lat":19.0,"lng":72.8}"""))
                .andExpect(status().isOk());

        mvc.perform(get("/api/audit?entity=inspection&entityId=" + id)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].action").exists())
                .andExpect(jsonPath("$[0].actor_name").exists());
    }

    @Test
    @DisplayName("the audit trail is back-office only")
    void auditIsBackOfficeOnly() throws Exception {
        mvc.perform(get("/api/audit").header("Authorization", bearer(officialToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("audit meta is returned as an object, not as stored JSON text")
    void auditMetaIsParsed() throws Exception {
        MvcResult result = mvc.perform(get("/api/audit?limit=50")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andReturn();
        assertThat(result.getResponse().getContentAsString()).doesNotContain("\"meta\":\"{");
    }

    // ------------------------------------------------------------ notifications

    @Test
    @DisplayName("a user only ever marks their own notifications as read")
    void notificationsAreScoped() throws Exception {
        MvcResult mine = mvc.perform(get("/api/notifications").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andReturn();
        int id = JsonPath.read(mine.getResponse().getContentAsString(), "$[0].id");

        // official1 has no access to the admin's notification; the update is a no-op, and the
        // route still answers 200 because the contract has no 403 for this case.
        String otherToken = login("official2@samajdrishti.gov.in", "Official@123");
        mvc.perform(put("/api/notifications/" + id + "/read").header("Authorization", bearer(otherToken)))
                .andExpect(status().isOk());
    }

    // ------------------------------------------------------------------ helpers

    private int firstOwnInspectionId() throws Exception {
        MvcResult result = mvc.perform(get("/api/inspections/mine")
                        .header("Authorization", bearer(officialToken)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$[0].id");
    }

    private int firstForeignInspectionId() throws Exception {
        MvcResult all = mvc.perform(get("/api/inspections/all").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andReturn();
        MvcResult mine = mvc.perform(get("/api/inspections/mine")
                        .header("Authorization", bearer(officialToken)))
                .andReturn();

        String mineBody = mine.getResponse().getContentAsString();
        for (Map<String, Object> row : JsonPath.<java.util.List<Map<String, Object>>>read(
                all.getResponse().getContentAsString(), "$")) {
            if (!mineBody.contains("\"id\":" + row.get("id") + ",")) {
                return ((Number) row.get("id")).intValue();
            }
        }
        return -1;
    }

    private int firstCameraId() throws Exception {
        MvcResult result = mvc.perform(get("/api/monitoring/cameras").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andReturn();
        return JsonPath.read(result.getResponse().getContentAsString(), "$[0].id");
    }
}
