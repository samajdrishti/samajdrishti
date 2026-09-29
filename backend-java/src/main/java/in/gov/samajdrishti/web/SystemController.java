package in.gov.samajdrishti.web;

import in.gov.samajdrishti.config.AppProperties;
import in.gov.samajdrishti.service.AiEngineClient;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Service banner and the liveness probe both dashboards poll. */
@RestController
public class SystemController {

    private final AppProperties properties;
    private final AiEngineClient ai;

    public SystemController(AppProperties properties, AiEngineClient ai) {
        this.properties = properties;
        this.ai = ai;
    }

    @GetMapping("/")
    public Map<String, Object> root() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", "Samaj Drishti API Server");
        body.put("status", "running");
        body.put("dataMode", properties.dataMode());
        body.put("version", "2.0.0");
        return body;
    }

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        Map<String, Object> aiHealth = ai.health();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "ok");
        body.put("dataMode", properties.dataMode());
        body.put("aiEngineOnline", Boolean.TRUE.equals(aiHealth.get("online")));
        body.put("aiEngineUrl", aiHealth.get("url"));
        body.put("anomalyBackend", aiHealth.get("anomaly_backend"));
        body.put("llmProvider", aiHealth.get("llm_provider"));
        body.put("timestamp", Instant.now().toString());
        return body;
    }
}
