package in.gov.samajdrishti;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import in.gov.samajdrishti.config.AppProperties;
import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.service.AiEngineClient;
import in.gov.samajdrishti.service.AiEngineTransport;
import in.gov.samajdrishti.service.GeoService;
import in.gov.samajdrishti.service.TtlCache;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.InstanceOfAssertFactories.DOUBLE;

/**
 * Unit tests for the core business logic that must never depend on a database or
 * a live Python engine: the geo-verification calculations and the AI client's
 * degradation, fallback handling, caching, and payload mapping.
 */
class GeoAndAiClientTest {

    private final GeoService geo = new GeoService();
    private final AppProperties.AiEngine settings = new AppProperties.AiEngine(
            "http://localhost:5001", 3000, 15000, "");

    // =========================================================================
    // 1. GEO VERIFICATION & DISTANCE CALCULATIONS
    // =========================================================================

    @Nested
    @DisplayName("Geo Distance Calculations")
    class GeoDistanceTests {

        @Test
        @DisplayName("the haversine distance matches the known Delhi-Mumbai great circle")
        void haversineIsAccurate() {
            Double distance = geo.distanceMeters(new GeoPoint(28.6139, 77.2090), new GeoPoint(19.0760, 72.8777));
            assertThat(distance).isNotNull();
            // ~1147 km great-circle, allowing for spherical-earth approximation.
            assertThat(distance).isBetween(1_140_000d, 1_155_000d);
        }

        @Test
        @DisplayName("an identical pair of coordinates is zero distance")
        void identicalPointsAreZeroApart() {
            assertThat(geo.distanceMeters(new GeoPoint(28.8955, 76.6066), new GeoPoint(28.8955, 76.6066)))
                    .isEqualTo(0.0);
        }

        @Test
        @DisplayName("antipodal points span the maximum half-circumference of the Earth")
        void antipodalPointsSpanEarthCircumference() {
            // (0, 0) and (0, 180) are on opposite sides of the equator: ~20,015 km
            Double distance = geo.distanceMeters(new GeoPoint(0.0, 0.0), new GeoPoint(0.0, 180.0));
            assertThat(distance).isNotNull();
            assertThat(distance).isBetween(20_000_000d, 20_050_000d);
        }

        @Test
        @DisplayName("missing or incomplete coordinates yield no distance (null), never an error or 0")
        void missingOrIncompleteCoordinatesYieldNull() {
            GeoPoint valid = new GeoPoint(28.8955, 76.6066);

            assertThat(geo.distanceMeters(null, valid)).isNull();
            assertThat(geo.distanceMeters(valid, null)).isNull();
            assertThat(geo.distanceMeters(new GeoPoint(), valid)).isNull();
            assertThat(geo.distanceMeters(new GeoPoint(null, 76.6066), valid)).isNull();
            assertThat(geo.distanceMeters(valid, new GeoPoint(28.8955, null))).isNull();
        }

        @ParameterizedTest(name = "lat={0}, lng={1} should be invalid")
        @CsvSource({
                "91.0, 77.0",
                "-90.1, 77.0",
                "28.0, 180.1",
                "28.0, -181.0"
        })
        @DisplayName("out-of-range latitude or longitude is rejected as invalid")
        void outOfRangeCoordinatesAreRejected(double lat, double lng) {
            assertThat(GeoService.isValidCoordinate(lat, lng)).isFalse();
            assertThat(GeoService.normalise(lat, lng)).isNull();
            assertThat(GeoService.normalise(new GeoPoint(lat, lng))).isNull();
            assertThat(geo.distanceMeters(new GeoPoint(lat, lng), new GeoPoint(28.0, 77.0))).isNull();
        }

        @Test
        @DisplayName("normalise helper preserves valid points and discards partial/null ones")
        void normaliseCoordinates() {
            assertThat(GeoService.normalise(28.8955, 76.6066)).isNotNull()
                    .matches(p -> p.getLat().equals(28.8955) && p.getLng().equals(76.6066));
            assertThat(GeoService.normalise((Double) null, 76.6066)).isNull();
            assertThat(GeoService.normalise(28.8955, null)).isNull();

            GeoPoint complete = new GeoPoint(28.8955, 76.6066);
            assertThat(GeoService.normalise(complete)).isSameAs(complete);
            assertThat(GeoService.normalise(new GeoPoint(null, 76.6066))).isNull();
            assertThat(GeoService.normalise((GeoPoint) null)).isNull();
        }

        @Test
        @DisplayName("antimeridian crossing calculates shortest arc across 180 degrees longitude")
        void antimeridianCrossingCalculatesShortestArc() {
            Double distance = geo.distanceMeters(new GeoPoint(0.0, 179.99), new GeoPoint(0.0, -179.99));
            assertThat(distance).isNotNull();
            // ~2.22 km (0.02 deg * 111.319 km/deg), NOT ~20,015 km long-arc around globe
            assertThat(distance).isBetween(2_200d, 2_250d);
        }

        @ParameterizedTest(name = "boundary coordinate lat={0}, lng={1} is valid")
        @CsvSource({
                "90.0, 180.0",
                "-90.0, -180.0",
                "90.0, -180.0",
                "-90.0, 180.0",
                "0.0, 0.0"
        })
        @DisplayName("exact boundary coordinates on poles and date lines are accepted")
        void exactBoundaryCoordinatesAreAccepted(double lat, double lng) {
            assertThat(GeoService.isValidCoordinate(lat, lng)).isTrue();
            assertThat(GeoService.normalise(lat, lng)).isNotNull();
        }

        @Test
        @DisplayName("special IEEE floating-point values are rejected")
        void specialFloatingPointValuesAreRejected() {
            assertThat(GeoService.isValidCoordinate(Double.NaN, 76.6)).isFalse();
            assertThat(GeoService.isValidCoordinate(28.8, Double.NaN)).isFalse();
            assertThat(GeoService.isValidCoordinate(Double.POSITIVE_INFINITY, 76.6)).isFalse();
            assertThat(GeoService.isValidCoordinate(28.8, Double.NEGATIVE_INFINITY)).isFalse();
        }

        @Test
        @DisplayName("sub-meter GPS micro-distance does not produce numerical instability")
        void subMeterMicroDistance() {
            GeoPoint p1 = new GeoPoint(28.895500, 76.606600);
            GeoPoint p2 = new GeoPoint(28.895501, 76.606600); // ~0.11 meters north
            Double distance = geo.distanceMeters(p1, p2);
            assertThat(distance).isNotNull().isBetween(0.05, 0.20);
        }

        @Test
        @DisplayName("bearing calculation returns correct compass heading and forward azimuth")
        void bearingAndCompassCalculation() {
            GeoPoint origin = new GeoPoint(28.0, 77.0);
            GeoPoint north = new GeoPoint(29.0, 77.0);
            GeoPoint east = new GeoPoint(28.0, 78.0);
            GeoPoint south = new GeoPoint(27.0, 77.0);
            GeoPoint west = new GeoPoint(28.0, 76.0);

            Double bearingNorth = GeoService.initialBearing(origin, north);
            assertThat(bearingNorth).isEqualTo(0.0);
            assertThat(GeoService.compassDirection(bearingNorth)).isEqualTo("N");

            Double bearingEast = GeoService.initialBearing(origin, east);
            assertThat(bearingEast).isBetween(89.0, 91.0);
            assertThat(GeoService.compassDirection(bearingEast)).isEqualTo("E");

            Double bearingSouth = GeoService.initialBearing(origin, south);
            assertThat(bearingSouth).isEqualTo(180.0);
            assertThat(GeoService.compassDirection(bearingSouth)).isEqualTo("S");

            Double bearingWest = GeoService.initialBearing(origin, west);
            assertThat(bearingWest).isBetween(269.0, 271.0);
            assertThat(GeoService.compassDirection(bearingWest)).isEqualTo("W");
        }
    }

    @Nested
    @DisplayName("Geo Radius & Anti-Fraud Verification")
    class GeoVerificationTests {

        private final GeoPoint project = new GeoPoint(28.8955, 76.6066);

        @Test
        @DisplayName("a report inside the radius verifies with low severity")
        void insideRadiusVerifies() {
            Map<String, Object> verdict = geo.verify(project, new GeoPoint(28.8957, 76.6068));
            assertThat(verdict)
                    .containsEntry("verdict", GeoService.VERDICT_VERIFIED)
                    .containsEntry("within_radius", true)
                    .containsEntry("severity", GeoService.SEVERITY_LOW)
                    .containsEntry("radius_meters", 250L);
            assertThat(verdict.get("distance_meters"))
                    .asInstanceOf(DOUBLE)
                    .isLessThan(250d);
            assertThat(verdict.get("explanation")).asString()
                    .contains("within")
                    .contains("allowed radius 250 m");
        }

        @Test
        @DisplayName("just outside the radius (up to 3x) is a mismatch, not a fraud finding")
        void justOutsideIsAMismatch() {
            // ~556 m: past the 250 m radius, but inside the 750 m (3x) band
            Map<String, Object> verdict = geo.verify(project, new GeoPoint(28.9005, 76.6066), 250);
            assertThat(verdict)
                    .containsEntry("verdict", GeoService.VERDICT_MISMATCH)
                    .containsEntry("within_radius", false)
                    .containsEntry("severity", GeoService.SEVERITY_MEDIUM);
            assertThat(verdict.get("distance_meters"))
                    .asInstanceOf(DOUBLE)
                    .isBetween(400d, 750d);
            assertThat(verdict.get("explanation")).asString()
                    .contains("just outside")
                    .contains("Needs a supervisor check");
        }

        @Test
        @DisplayName("far outside the radius (> 3x) flags suspicious proxy or fake reporting")
        void farOutsideIsSuspicious() {
            Map<String, Object> verdict = geo.verify(project, new GeoPoint(19.0760, 72.8777), 250);
            assertThat(verdict)
                    .containsEntry("verdict", GeoService.VERDICT_SUSPICIOUS)
                    .containsEntry("severity", GeoService.SEVERITY_HIGH)
                    .containsEntry("within_radius", false);
            assertThat(verdict.get("explanation")).asString()
                    .contains("proxy or fake reporting");
        }

        @Test
        @DisplayName("an unregistered project or missing GPS fix yields unknown, never a pass")
        void missingDataIsUnknownNotVerified() {
            Map<String, Object> noProject = geo.verify(null, project);
            assertThat(noProject)
                    .containsEntry("verdict", GeoService.VERDICT_UNKNOWN)
                    .containsEntry("severity", GeoService.SEVERITY_LOW)
                    .containsEntry("within_radius", false);

            Map<String, Object> noSubmission = geo.verify(project, null);
            assertThat(noSubmission)
                    .containsEntry("verdict", GeoService.VERDICT_UNKNOWN)
                    .containsEntry("severity", GeoService.SEVERITY_LOW)
                    .containsEntry("within_radius", false);
        }

        @ParameterizedTest(name = "radius <= 0 ({0}) defaults to 250m")
        @ValueSource(doubles = {0.0, -10.0, -250.0})
        @DisplayName("invalid or zero radius automatically falls back to the default 250 meters")
        void zeroOrNegativeRadiusDefaultsTo250m(double invalidRadius) {
            Map<String, Object> verdict = geo.verify(project, project, invalidRadius);
            assertThat(verdict).containsEntry("radius_meters", 250L);
        }

        @Test
        @DisplayName("verdict contains bearing and directional heading guidance for inspectors")
        void verdictIncludesBearingGuidance() {
            GeoPoint site = new GeoPoint(28.8955, 76.6066);
            GeoPoint inspectorObservation = new GeoPoint(28.8900, 76.6066); // south of site
            Map<String, Object> verdict = geo.verify(site, inspectorObservation, 250);

            assertThat(verdict)
                    .containsKey("bearing_degrees")
                    .containsKey("bearing_direction");
            // Inspector is south, so site is North of inspector (bearing ~0 / N)
            assertThat(verdict.get("bearing_direction")).isEqualTo("N");
        }

        @Test
        @DisplayName("typed GeoVerdict record matches verdict map and guarantees type-safety")
        void typedGeoVerdictRecord() {
            GeoPoint site = new GeoPoint(28.8955, 76.6066);
            GeoPoint submission = new GeoPoint(28.8957, 76.6068);
            GeoService.GeoVerdict record = geo.verifyVerdict(site, submission, 250);

            assertThat(record.verdict()).isEqualTo(GeoService.VERDICT_VERIFIED);
            assertThat(record.withinRadius()).isTrue();
            assertThat(record.severity()).isEqualTo(GeoService.SEVERITY_LOW);
            assertThat(record.radiusMeters()).isEqualTo(250L);
            assertThat(record.toMap()).containsEntry("verdict", GeoService.VERDICT_VERIFIED);
        }
    }

    // =========================================================================
    // 2. AI CLIENT RESILIENCE & OFFLINE DEGRADATION
    // =========================================================================

    @Nested
    @DisplayName("AI Client Degradation & Offline Fallbacks")
    class AiClientOfflineDegradationTests {

        private FakeAiEngineTransport transport;
        private AiEngineClient client;

        @BeforeEach
        void setUp() {
            transport = new FakeAiEngineTransport();
            transport.offline = true;
            client = new AiEngineClient(transport, settings);
        }

        @Test
        @DisplayName("a dead engine produces a flat risk score (50) instead of throwing an exception")
        void deadEngineRiskScoreFallsBack() {
            Map<String, Object> score = client.riskScore(7, Map.of("budget", 100));
            assertThat(score)
                    .containsEntry("project_id", 7)
                    .containsEntry("risk_score", 50)
                    .containsEntry("factors", List.of());
        }

        @Test
        @DisplayName("offline engine gracefully degrades lists to empty rather than failing callers")
        void deadEngineReturnsEmptyListsForBatchOperations() {
            assertThat(client.scoreProjectsBatch(List.of(Map.of("id", 1)))).isEmpty();
            assertThat(client.detectAnomalies(List.of(Map.of("id", 1)))).isEmpty();
            assertThat(client.assignInspections(List.of(), List.of(), 3)).isEmpty();
            assertThat(client.analyzeAttendance(List.of(Map.of("official_id", 3)))).isEmpty();
            assertThat(client.detectSuspiciousPatterns(List.of(Map.of("id", 1)))).isEmpty();
        }

        @Test
        @DisplayName("offline engine returns null for optional enrichments (narrative, stats, geo-wording)")
        void deadEngineEnrichmentReturnsNull() {
            assertThat(client.narrative(Map.of(), "executive")).isNull();
            assertThat(client.dashboardStats(List.of(Map.of("id", 1)))).isNull();
            assertThat(client.geoVerify(Map.of("id", 1), Map.of("lat", 28.0))).isNull();
        }

        @Test
        @DisplayName("health reports the engine as offline with error message when down")
        void healthReportsOffline() {
            Map<String, Object> health = client.health();
            assertThat(health)
                    .containsEntry("online", false)
                    .containsEntry("url", settings.baseUrl());
            assertThat(health.get("error")).asString().contains("connection refused");
        }

        @Test
        @DisplayName("transport exceptions are swallowed to strictly guarantee caller resilience")
        void transportExceptionsDegradeGracefully() {
            AiEngineTransport throwingTransport = new AiEngineTransport() {
                @Override
                public Map<String, Object> post(String path, Object body, Duration timeout) {
                    throw new RuntimeException("socket timeout simulated");
                }

                @Override
                public Map<String, Object> get(String path, Duration timeout) {
                    throw new RuntimeException("connection refused simulated");
                }
            };
            AiEngineClient resilientClient = new AiEngineClient(throwingTransport, settings);

            Map<String, Object> score = resilientClient.riskScore(42, Map.of());
            assertThat(score).containsEntry("project_id", 42).containsEntry("risk_score", 50);
            assertThat(resilientClient.scoreProjectsBatch(List.of(Map.of("id", 1)))).isEmpty();
            assertThat(resilientClient.detectAnomalies(List.of())).isEmpty();
            assertThat(resilientClient.narrative(Map.of(), "executive")).isNull();
        }
    }

    // =========================================================================
    // 3. AI CLIENT CACHING & HOT-PATH OPTIMIZATION
    // =========================================================================

    @Nested
    @DisplayName("AI Client Caching & Optimization")
    class AiClientCachingTests {

        private FakeAiEngineTransport transport;
        private AiEngineClient client;

        @BeforeEach
        void setUp() {
            transport = new FakeAiEngineTransport();
            client = new AiEngineClient(transport, settings);
        }

        @Test
        @DisplayName("the portfolio risk batch is cached, so dashboard reloads avoid redundant engine calls")
        void riskBatchIsCached() {
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
        @DisplayName("different project batches generate distinct cache entries")
        void differentBatchesAreNotCrossCached() {
            List<Map<String, Object>> batchA = List.of(Map.of("id", 1));
            List<Map<String, Object>> batchB = List.of(Map.of("id", 2));

            client.scoreProjectsBatch(batchA);
            client.scoreProjectsBatch(batchB);

            long scoreCalls = transport.calls().stream()
                    .filter("/api/risk/score-batch"::equals).count();
            assertThat(scoreCalls).isEqualTo(2);
        }

        @Test
        @DisplayName("the health probe is cached briefly so polling is cheap")
        void healthIsCached() {
            Map<String, Object> first = client.health();
            Map<String, Object> second = client.health();
            Map<String, Object> third = client.health();

            assertThat(first)
                    .containsEntry("online", true)
                    .containsEntry("status", "ok");
            assertThat(second).isSameAs(first);

            long healthCalls = transport.calls().stream().filter("/api/health"::equals).count();
            assertThat(healthCalls).isEqualTo(1);
        }

        @Test
        @DisplayName("clearing cache forces subsequent requests to query the transport")
        void cacheClearInvalidatesEntries() {
            List<Map<String, Object>> payload = List.of(Map.of("id", 1));
            client.scoreProjectsBatch(payload);
            assertThat(transport.totalCalls()).isEqualTo(1);

            client.clearCaches();
            client.scoreProjectsBatch(payload);
            assertThat(transport.totalCalls()).isEqualTo(2);
        }

        @Test
        @DisplayName("an empty or null portfolio is answered locally without calling the engine")
        void emptyOrNullPortfolioSkipsTheEngine() {
            assertThat(client.scoreProjectsBatch(List.of())).isEmpty();
            assertThat(client.scoreProjectsBatch(null)).isEmpty();
            assertThat(transport.totalCalls()).isZero();
        }

        @Test
        @DisplayName("advancing clock beyond TTL causes cache to expire and queries engine again")
        void clockAdvanceCausesCacheExpiration() {
            MutableClock clock = new MutableClock(Instant.now());
            AiEngineClient timeClient = new AiEngineClient(transport, settings, clock);
            List<Map<String, Object>> payload = List.of(Map.of("id", 1));

            // First call -> hits transport
            timeClient.scoreProjectsBatch(payload);
            assertThat(transport.totalCalls()).isEqualTo(1);

            // Second call at +10s -> served from cache
            clock.advance(Duration.ofSeconds(10));
            timeClient.scoreProjectsBatch(payload);
            assertThat(transport.totalCalls()).isEqualTo(1);

            // Third call at +35s (past 30s TTL) -> cache expired, reaches transport again
            clock.advance(Duration.ofSeconds(25));
            timeClient.scoreProjectsBatch(payload);
            assertThat(transport.totalCalls()).isEqualTo(2);
        }

        @Test
        @DisplayName("cached batch scores are defensively immutable to prevent cache pollution")
        void cachedBatchScoresAreDefensivelyImmutable() {
            List<Map<String, Object>> payload = List.of(Map.of("id", 1));
            List<Map<String, Object>> scores = client.scoreProjectsBatch(payload);

            assertThatThrownBy(() -> scores.add(Map.of("project_id", 999)))
                    .isInstanceOf(UnsupportedOperationException.class);
        }
    }

    // =========================================================================
    // 4. AI CLIENT PASSTHROUGH & PAYLOAD MAPPING
    // =========================================================================

    @Nested
    @DisplayName("AI Client Passthrough & Payload Mapping")
    class AiClientPassthroughTests {

        private FakeAiEngineTransport transport;
        private AiEngineClient client;

        @BeforeEach
        void setUp() {
            transport = new FakeAiEngineTransport();
            client = new AiEngineClient(transport, settings);
        }

        @Test
        @DisplayName("online single risk score returns engine factors and weights")
        void singleRiskScorePassThrough() {
            Map<String, Object> response = client.riskScore(1, Map.of("budget", 500_000));
            assertThat(response)
                    .containsEntry("project_id", 1)
                    .containsEntry("risk_score", 82.5);
            assertThat(response.get("factors")).asList().isNotEmpty();
        }

        @Test
        @DisplayName("engine batch responses are passed through unchanged to callers")
        void batchResponsesPassThrough() {
            assertThat(client.scoreProjectsBatch(List.of(Map.of("id", 1), Map.of("id", 2))))
                    .extracting(score -> score.get("project_id"))
                    .containsExactly(1, 2);
            assertThat(client.detectAnomalies(List.of(Map.of("id", 1)))).hasSize(1);
            assertThat(client.assignInspections(List.of(Map.of("id", 1)), List.of(Map.of("id", 3)), 2)).hasSize(2);
            assertThat(client.analyzeAttendance(List.of(Map.of("official_id", 3)))).hasSize(1);
            assertThat(client.detectSuspiciousPatterns(List.of())).isEmpty();
        }

        @Test
        @DisplayName("dashboard stats and narrative payload pass through when online")
        void dashboardStatsAndNarrativePassThrough() {
            Map<String, Object> stats = client.dashboardStats(List.of(Map.of("id", 1)));
            assertThat(stats)
                    .containsEntry("total_projects", 2)
                    .containsEntry("average_risk_score", 55.25);

            Map<String, Object> narrative = client.narrative(Map.of("id", 1), "executive");
            assertThat(narrative)
                    .containsEntry("provider", "groq:openai/gpt-oss-20b")
                    .containsEntry("tone", "executive");

            Map<String, Object> geoVerdict = client.geoVerify(Map.of("id", 1), Map.of("lat", 28.0));
            assertThat(geoVerdict)
                    .containsEntry("verdict", "suspicious")
                    .containsEntry("severity", "high");
        }

        @Test
        @DisplayName("projectForGeo builds a complete payload and safely tolerates nulls")
        void projectForGeoFormatting() {
            Map<String, Object> project = Map.of("id", 42, "name", "Rural Road Construction");
            GeoPoint coords = new GeoPoint(28.8955, 76.6066);

            Map<String, Object> payload = AiEngineClient.projectForGeo(project, coords);
            assertThat(payload)
                    .containsEntry("id", 42)
                    .containsEntry("name", "Rural Road Construction")
                    .containsEntry("lat", 28.8955)
                    .containsEntry("lng", 76.6066)
                    .containsEntry("radius_meters", 250);

            // Null tolerance check
            Map<String, Object> nullPayload = AiEngineClient.projectForGeo(null, null);
            assertThat(nullPayload)
                    .containsEntry("id", null)
                    .containsEntry("name", null)
                    .containsEntry("lat", null)
                    .containsEntry("lng", null)
                    .containsEntry("radius_meters", 250);
        }
    }

    // =========================================================================
    // 5. DIRECT BOUNDED TTL CACHE TESTS
    // =========================================================================

    @Nested
    @DisplayName("Direct Bounded TTL Cache Unit Tests")
    class TtlCacheDirectTests {

        @Test
        @DisplayName("bounded capacity evicts least recently used item when maxEntries exceeded")
        void boundedCapacityEvictsLru() {
            TtlCache<String> cache = new TtlCache<>(2);
            cache.put("a", "alpha", Duration.ofMinutes(1));
            cache.put("b", "beta", Duration.ofMinutes(1));

            // Access "a" so "b" becomes the least recently used
            assertThat(cache.get("a")).isEqualTo("alpha");

            // Put third item "c" -> "b" should be evicted
            cache.put("c", "gamma", Duration.ofMinutes(1));
            assertThat(cache.get("b")).isNull();
            assertThat(cache.get("a")).isEqualTo("alpha");
            assertThat(cache.get("c")).isEqualTo("gamma");
        }

        @Test
        @DisplayName("expired entries are dropped and return null")
        void expiredEntriesAreDropped() {
            MutableClock clock = new MutableClock(Instant.now());
            TtlCache<String> cache = new TtlCache<>(4, clock);
            cache.put("session", "xyz", Duration.ofSeconds(5));

            assertThat(cache.get("session")).isEqualTo("xyz");
            clock.advance(Duration.ofSeconds(6));
            assertThat(cache.get("session")).isNull();
        }

        @Test
        @DisplayName("null keys, values, and durations are tolerated gracefully")
        void nullTolerance() {
            TtlCache<String> cache = new TtlCache<>(4);
            cache.put(null, "val", Duration.ofSeconds(10));
            cache.put("key", null, Duration.ofSeconds(10));
            cache.put("key", "val", null);

            assertThat(cache.get(null)).isNull();
            assertThat(cache.size()).isZero();
        }
    }

    // =========================================================================
    // TEST HELPER: MUTABLE CLOCK
    // =========================================================================

    static class MutableClock extends Clock {
        private final AtomicReference<Instant> now;
        private final ZoneId zone = ZoneId.of("UTC");

        MutableClock(Instant start) {
            this.now = new AtomicReference<>(start);
        }

        void advance(Duration duration) {
            now.updateAndGet(i -> i.plus(duration));
        }

        @Override
        public ZoneId getZone() {
            return zone;
        }

        @Override
        public Clock withZone(ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return now.get();
        }
    }
}
