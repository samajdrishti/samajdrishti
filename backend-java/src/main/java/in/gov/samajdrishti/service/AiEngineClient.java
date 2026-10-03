package in.gov.samajdrishti.service;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import org.springframework.stereotype.Service;

import in.gov.samajdrishti.config.AppProperties;
import in.gov.samajdrishti.domain.GeoPoint;

/**
 * Client for the Python AI engine (FastAPI on port 5001).
 *
 * <p>Hard rule: no AI failure may take the API down. Every method here catches its own
 * error and returns a deterministic local fallback - a flat risk score, an empty
 * anomaly list, a {@code local-fallback} narrative - so the dashboards degrade instead
 * of breaking when the engine is offline.
 *
 * <p>Two calls are cached briefly because they sit on the hot path of every dashboard
 * load: the health probe and the portfolio risk-score batch. The old implementation hit
 * the engine on every single request.
 */
@Service
public class AiEngineClient {

    private static final Duration HEALTH_CACHE = Duration.ofSeconds(5);
    private static final Duration RISK_CACHE = Duration.ofSeconds(30);

    private final AiEngineTransport transport;
    private final AppProperties.AiEngine settings;
    private final TtlCache<Map<String, Object>> healthCache;
    private final TtlCache<List<Map<String, Object>>> riskCache;

    public AiEngineClient(AiEngineTransport transport, AppProperties.AiEngine settings) {
        this(transport, settings, java.time.Clock.systemUTC());
    }

    public AiEngineClient(AiEngineTransport transport, AppProperties.AiEngine settings, java.time.Clock clock) {
        this.transport = transport;
        this.settings = settings;
        this.healthCache = new TtlCache<>(4, clock);
        this.riskCache = new TtlCache<>(16, clock);
    }

    public Map<String, Object> riskScore(Integer projectId, Map<String, Object> projectData) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("project_id", projectId);
        if (projectData != null) {
            body.putAll(projectData);
        }
        try {
            Map<String, Object> response = transport.post("/api/risk/score", body, settings.defaultTimeout());
            if (response == null) {
                return Map.of("project_id", projectId, "risk_score", 50, "factors", List.of());
            }
            return response;
        } catch (Exception e) {
            return Map.of("project_id", projectId, "risk_score", 50, "factors", List.of());
        }
    }

    /** Risk scores a whole portfolio in one round-trip; used by the dashboard and the assigner. */
    public List<Map<String, Object>> scoreProjectsBatch(List<Map<String, Object>> projects) {
        if (projects == null || projects.isEmpty()) {
            return List.of();
        }
        String key = buildBatchKey(projects);
        List<Map<String, Object>> cached = riskCache.get(key);
        if (cached != null) {
            return cached;
        }

        try {
            Map<String, Object> response = transport.post("/api/risk/score-batch", Map.of("projects", projects),
                    settings.defaultTimeout());
            if (response == null) {
                return List.of();
            }
            List<Map<String, Object>> scores = asList(response.get("scores"));
            riskCache.put(key, scores, RISK_CACHE);
            return scores;
        } catch (Exception e) {
            return List.of();
        }
    }

    private static String buildBatchKey(List<Map<String, Object>> projects) {
        StringBuilder sb = new StringBuilder(projects.size() * 16);
        sb.append(projects.size()).append(':');
        for (Map<String, Object> p : projects) {
            if (p != null) {
                sb.append(p.get("id")).append(':').append(p.get("budget")).append(';');
            }
        }
        sb.append(projects.hashCode());
        return sb.toString();
    }

    public Map<String, Object> health() {
        Map<String, Object> cached = healthCache.get("health");
        if (cached != null) {
            return cached;
        }
        Map<String, Object> body;
        try {
            Map<String, Object> response = transport.get("/api/health", settings.healthTimeout());
            if (response == null) {
                throw new IllegalStateException("the engine returned an empty body");
            }
            body = new LinkedHashMap<>();
            body.put("online", true);
            body.put("url", settings.baseUrl());
            body.putAll(response);
        } catch (RuntimeException e) {
            body = new LinkedHashMap<>();
            body.put("online", false);
            body.put("url", settings.baseUrl());
            body.put("error", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        }
        healthCache.put("health", body, HEALTH_CACHE);
        return body;
    }

    public List<Map<String, Object>> detectAnomalies(List<Map<String, Object>> inspections) {
        try {
            Map<String, Object> response = transport.post("/api/anomaly/detect", Map.of("inspections", inspections),
                    settings.defaultTimeout());
            return response == null ? List.of() : asList(response.get("anomalies"));
        } catch (Exception e) {
            return List.of();
        }
    }

    public List<Map<String, Object>> assignInspections(List<Map<String, Object>> projects,
                                                       List<Map<String, Object>> officials,
                                                       int numInspections) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("projects", projects);
        body.put("officials", officials);
        body.put("num_inspections", numInspections);
        try {
            Map<String, Object> response = transport.post("/api/inspections/random-assign", body,
                    settings.defaultTimeout());
            return response == null ? List.of() : asList(response.get("assignments"));
        } catch (Exception e) {
            return List.of();
        }
    }

    public Map<String, Object> dashboardStats(List<Map<String, Object>> projects) {
        try {
            return transport.post("/api/dashboard/stats", Map.of("projects", projects), settings.defaultTimeout());
        } catch (Exception e) {
            return null;
        }
    }

    public List<Map<String, Object>> analyzeAttendance(List<Map<String, Object>> records) {
        try {
            Map<String, Object> response = transport.post("/api/attendance/analyze", Map.of("records", records),
                    settings.defaultTimeout());
            return response == null ? List.of() : asList(response.get("irregularities"));
        } catch (Exception e) {
            return List.of();
        }
    }

    public List<Map<String, Object>> detectSuspiciousPatterns(List<Map<String, Object>> patterns) {
        try {
            Map<String, Object> response = transport.post("/api/patterns/suspicious", Map.of("patterns", patterns),
                    settings.defaultTimeout());
            return response == null ? List.of() : asList(response.get("suspicious_patterns"));
        } catch (Exception e) {
            return List.of();
        }
    }

    /**
     * AI-assisted wording for a geo verdict. The deterministic verdict always comes from
     * {@link GeoService}; this only enriches the explanation, so a failure is non-fatal.
     */
    public Map<String, Object> geoVerify(Map<String, Object> project, Map<String, Object> observation) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("project", project);
        body.put("observation", observation);
        try {
            return transport.post("/api/geo/verify", body, settings.defaultTimeout());
        } catch (Exception e) {
            return null;
        }
    }

    /** LLM narrative (Groq when a key is configured, deterministic local text otherwise). */
    public Map<String, Object> narrative(Map<String, Object> context, String tone) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("context", context);
        body.put("tone", tone);
        // A reasoning model needs far longer than a normal call, so this one gets its own
        // budget; the caller-facing route is a dashboard read that may legitimately take
        // a few seconds.
        try {
            return transport.post("/api/narrative", body, Duration.ofSeconds(45));
        } catch (Exception e) {
            return null;
        }
    }

    public static Map<String, Object> projectForGeo(Map<String, Object> project, GeoPoint coords) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", project == null ? null : project.get("id"));
        payload.put("name", project == null ? null : project.get("name"));
        payload.put("lat", coords == null ? null : coords.getLat());
        payload.put("lng", coords == null ? null : coords.getLng());
        payload.put("radius_meters", (int) GeoService.DEFAULT_RADIUS_M);
        return payload;
    }

    public void clearCaches() {
        healthCache.clear();
        riskCache.clear();
    }

    /* ------------------------------------------------------------- transport */

    private static List<Map<String, Object>> asList(Object value) {
        if (value instanceof List<?> list) {
            List<Map<String, Object>> typed = new ArrayList<>(list.size());
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    typed.add(castMap(map));
                }
            }
            return java.util.Collections.unmodifiableList(typed);
        }
        return List.of();
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> castMap(Map<?, ?> map) {
        Map<String, Object> typed = new LinkedHashMap<>(map.size());
        map.forEach((key, value) -> typed.put(Objects.toString(key), value));
        return typed;
    }
}