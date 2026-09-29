package in.gov.samajdrishti;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import in.gov.samajdrishti.config.AppProperties;
import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.service.AiEngineClient;
import in.gov.samajdrishti.service.GeoService;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit tests for the two pieces of business logic that must not depend on a database or
 * a running engine: the geo verdict and the AI client's degradation and caching.
 */
class GeoAndAiClientTest {

    private final GeoService geo = new GeoService();
    private final AppProperties.AiEngine settings = new AppProperties.AiEngine(
            "http://localhost:5001", 3000, 15000);

    // ------------------------------------------------------------------ geometry

    @Test
    @DisplayName("the haversine distance matches the known Delhi-Mumbai great circle")
    void haversineIsAccurate() {
        Double distance = geo.distanceMeters(new GeoPoint(28.6139, 77.2090), new GeoPoint(19.0760, 72.8777));
        assertThat(distance).isNotNull();
        // ~1147 km great-circle, allowing for the spherical-earth approximation.
        assertThat(distance).isBetween(1_140_000d, 1_155_000d);
    }

    @Test
    @DisplayName("an identical pair of coordinates is zero distance")
    void identicalPointsAreZeroApart() {
        assertThat(geo.distanceMeters(new GeoPoint(28.8955, 76.6066), new GeoPoint(28.8955, 76.6066)))
                .isEqualTo(0.0);
    }

    @Test
    @DisplayName("a missing coordinate on either side yields no distance, not a wrong one")
    void missingCoordinatesYieldNoDistance() {
        assertThat(geo.distanceMeters(null, new GeoPoint(28.8955, 76.6066))).isNull();
        assertThat(geo.distanceMeters(new GeoPoint(28.8955, 76.6066), null)).isNull();
        assertThat(geo.distanceMeters(new GeoPoint(), new GeoPoint(1d, 1d))).isNull();    }

    @Test
    @DisplayName("a report inside the radius verifies")
    void insideRadiusVerifies() {
        Map<String, Object> verdict = geo.verify(new GeoPoint(28.8955, 76.6066),
                new GeoPoint(28.8957, 76.6068));
        assertThat(verdict).containsEntry("verdict", "verified")
                .containsEntry("within_radius", true)
                .containsEntry("severity", "low")
                .containsEntry("radius_meters", 250L);
        assertThat((Double) verdict.get("distance_meters")).isLessThan(250d);
    }

    @Test
    @DisplayName("just outside the radius is a mismatch, not a fraud finding")
    void justOutsideIsAMismatch() {
        // ~556 m: past the 250 m radius, but inside the 3x band that is a mismatch.
        Map<String, Object> verdict = geo.verify(new GeoPoint(28.8955, 76.6066),
                new GeoPoint(28.9005, 76.6066), 250);
        assertThat(verdict).containsEntry("verdict", "mismatch")
                .containsEntry("within_radius", false)
                .containsEntry("severity", "medium");
        assertThat((Double) verdict.get("distance_meters")).isBetween(400d, 750d);
    }

    @Test
    @DisplayName("far outside the radius is suspicious proxy reporting")
    void farOutsideIsSuspicious() {
        Map<String, Object> verdict = geo.verify(new GeoPoint(28.8955, 76.6066),
                new GeoPoint(19.0760, 72.8777), 250);
        assertThat(verdict).containsEntry("verdict", "suspicious")
                .containsEntry("severity", "high")
                .containsEntry("within_radius", false);
        assertThat((String) verdict.get("explanation")).contains("proxy");
    }

    @Test
    @DisplayName("an unregistered project or a missing fix yields unknown, never a pass")
    void missingDataIsUnknownNotVerified() {
        assertThat(geo.verify(null, new GeoPoint(28.8955, 76.6066)))
                .containsEntry("verdict", "unknown");
        assertThat(geo.verify(new GeoPoint(28.8955, 76.6066), null))
                .containsEntry("verdict", "unknown")
                .containsEntry("within_radius", false);
    }

    // ---------------------------------------------------------------- ai client

    @Test
    @DisplayName("a dead engine produces a flat risk score instead of an exception")
    void deadEngineFallsBack() {
        FakeAiEngineTransport transport = new FakeAiEngineTransport();
        transport.offline = true;
        AiEngineClient client = new AiEngineClient(transport, settings);

        Map<String, Object> score = client.riskScore(7, Map.of("budget", 100));
        assertThat(score).containsEntry("project_id", 7).containsEntry("risk_score", 50);
        assertThat(client.detectAnomalies(List.of(Map.of("id", 1)))).isEmpty();
        assertThat(client.assignInspections(List.of(), List.of(), 3)).isEmpty();
        assertThat(client.narrative(Map.of(), "executive")).isNull();
    }

    @Test
    @DisplayName("health reports the engine as offline, with the reason, when it is down")
    void healthReportsOffline() {
        FakeAiEngineTransport transport = new FakeAiEngineTransport();
        transport.offline = true;
        Map<String, Object> health = new AiEngineClient(transport, settings).health();

        assertThat(health).containsEntry("online", false);
        assertThat(health.get("error")).asString().contains("connection refused");
    }

    @Test
    @DisplayName("the portfolio risk batch is cached, so a dashboard reload is free")
    void riskBatchIsCached() {
        FakeAiEngineTransport transport = new FakeAiEngineTransport();
        AiEngineClient client = new AiEngineClient(transport, settings);
        List<Map<String, Object>> payload = List.of(
                Map.of("id", 1, "budget", 100),
                Map.of("id", 2, "budget", 200));

        assertThat(client.scoreProjectsBatch(payload)).hasSize(2);
        client.scoreProjectsBatch(payload);
        client.scoreProjectsBatch(payload);

        long scoreCalls = transport.calls().stream()
                .filter("/api/risk/score-batch"::equals).count();
        assertThat(scoreCalls).as("only the first call may reach the engine").isEqualTo(1);
    }

    @Test
    @DisplayName("the health probe is cached too, so polling it is cheap")
    void healthIsCached() {
        FakeAiEngineTransport transport = new FakeAiEngineTransport();
        AiEngineClient client = new AiEngineClient(transport, settings);

        client.health();
        client.health();
        client.health();

        long healthCalls = transport.calls().stream().filter("/api/health"::equals).count();
        assertThat(healthCalls).isEqualTo(1);
    }

    @Test
    @DisplayName("engine responses are passed through unchanged")
    void responsesPassThrough() {
        AiEngineClient client = new AiEngineClient(new FakeAiEngineTransport(), settings);

        assertThat(client.scoreProjectsBatch(List.of(Map.of("id", 1), Map.of("id", 2))))
                .extracting(score -> score.get("project_id"))
                .containsExactly(1, 2);
        assertThat(client.detectAnomalies(List.of(Map.of("id", 1)))).hasSize(1);
        assertThat(client.assignInspections(List.of(Map.of("id", 1)), List.of(Map.of("id", 3)), 2)).hasSize(2);
        assertThat(client.narrative(Map.of(), "executive"))
                .containsEntry("provider", "groq:openai/gpt-oss-20b");
        assertThat(client.analyzeAttendance(List.of(Map.of("official_id", 3)))).hasSize(1);
    }

    @Test
    @DisplayName("an empty portfolio is answered locally, without calling the engine")
    void emptyPortfolioSkipsTheEngine() {
        FakeAiEngineTransport transport = new FakeAiEngineTransport();
        assertThat(new AiEngineClient(transport, settings).scoreProjectsBatch(List.of())).isEmpty();
        assertThat(transport.totalCalls()).isZero();
    }
}
