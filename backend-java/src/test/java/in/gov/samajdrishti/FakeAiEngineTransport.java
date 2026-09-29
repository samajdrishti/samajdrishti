package in.gov.samajdrishti;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import in.gov.samajdrishti.service.AiEngineTransport;

/**
 * A scripted AI engine for the test suite.
 *
 * <p>Records every call so tests can assert the API talks to the engine at all, and
 * answers with realistic payloads so the dashboards exercise their real code paths
 * rather than the "engine offline" fallbacks.
 */
public class FakeAiEngineTransport implements AiEngineTransport {

    private final Map<String, Map<String, Object>> responses = new LinkedHashMap<>();
    private final List<String> calls = new ArrayList<>();
    private final AtomicInteger callCounts = new AtomicInteger();

    /** Set to true to simulate a dead engine. */
    public boolean offline;

    public FakeAiEngineTransport() {
        responses.put("/api/health", health());
        responses.put("/api/risk/score", Map.of("project_id", 1, "risk_score", 82.5,
                "factors", List.of(Map.of("factor", "High budget allocation", "weight", 30))));
        responses.put("/api/risk/score-batch", Map.of("scores", List.of(
                Map.of("project_id", 1, "project_name", "Chaubisee Vikas Sangh", "risk_score", 88.5,
                        "factors", List.of(Map.of("factor", "2 previous flagged inspections", "weight", 50))),
                Map.of("project_id", 2, "project_name", "Vrindavan Vridhashram", "risk_score", 22.0,
                        "factors", List.of())), "count", 2));
        responses.put("/api/anomaly/detect", Map.of("anomalies", List.of(
                Map.of("inspection_id", 4, "type", "pattern_anomaly", "method", "isolation_forest",
                        "confidence", 0.88, "details", "Flagged for review"))));
        responses.put("/api/inspections/random-assign", Map.of("assignments", List.of(
                assignment(1, "Chaubisee Vikas Sangh", 3, "Arun Kumar", "2026-10-02", 88.5),
                assignment(2, "Vrindavan Vridhashram", 4, "Priya Sharma", "2026-10-03", 22.0))));
        responses.put("/api/dashboard/stats", Map.of(
                "total_projects", 2, "high_risk_count", 1, "medium_risk_count", 0, "low_risk_count", 1,
                "average_risk_score", 55.25,
                "recommendations", List.of("Prioritize 1 high-risk projects for immediate inspection")));
        responses.put("/api/attendance/analyze", Map.of("irregularities", List.of(
                Map.of("official_id", 3, "type", "geo_mismatch", "severity", "high")),
                "summary", Map.of("records_analyzed", 12)));
        responses.put("/api/patterns/suspicious", Map.of("suspicious_patterns", List.of()));
        responses.put("/api/geo/verify", Map.of(
                "distance_meters", 1204.5, "within_radius", false, "verdict", "suspicious",
                "severity", "high", "explanation", "Reported 1.2 km from the registered site.",
                "radius_meters", 250));
        responses.put("/api/narrative", Map.of(
                "narrative", "One project carries the majority of the risk and needs immediate attention.",
                "provider", "groq:openai/gpt-oss-20b", "model", "openai/gpt-oss-20b",
                "tone", "executive", "generated_at", "2026-09-28T00:00:00+00:00"));
    }

    private static Map<String, Object> assignment(int projectId, String projectName, int officialId,
                                                  String officialName, String date, double risk) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("project_id", projectId);
        row.put("project_name", projectName);
        row.put("official_id", officialId);
        row.put("official_name", officialName);
        row.put("scheduled_date", date);
        row.put("scheduled_time", "10:30");
        row.put("ai_risk_score", risk);
        row.put("anti_predictability_hash", "NAV-1A2B3C");
        return row;
    }

    private static Map<String, Object> health() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("service", "Samaj Drishti AI Engine");
        body.put("status", "ok");
        body.put("anomaly_backend", "isolation_forest");
        body.put("llm_provider", "groq:openai/gpt-oss-20b");
        body.put("llm_available", true);
        return body;
    }

    @Override
    public Map<String, Object> post(String path, Object body, Duration timeout) {
        calls.add(path);
        callCounts.incrementAndGet();
        if (offline) {
            return null;
        }
        return responses.get(path);
    }

    @Override
    public Map<String, Object> get(String path, Duration timeout) {
        calls.add(path);
        callCounts.incrementAndGet();
        if (offline) {
            throw new IllegalStateException("connection refused");
        }
        return responses.get(path);
    }

    public List<String> calls() {
        return calls;
    }

    public int totalCalls() {
        return callCounts.get();
    }

    public void reset() {
        calls.clear();
        callCounts.set(0);
    }
}
