package in.gov.samajdrishti.realtime;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.config.AppProperties;
import in.gov.samajdrishti.repository.CameraRepository;

/**
 * Live monitoring heartbeat.
 *
 * <p>Emits {@code monitoring:tick} every few seconds so dashboards can show camera
 * health without polling. Best-effort by design: a failed tick is logged and skipped,
 * never propagated.
 */
@Component
public class MonitoringHeartbeat {

    private static final Logger log = LoggerFactory.getLogger(MonitoringHeartbeat.class);

    private final RealtimeHub hub;
    private final CameraRepository cameras;
    private final AppProperties properties;

    public MonitoringHeartbeat(RealtimeHub hub, CameraRepository cameras, AppProperties properties) {
        this.hub = hub;
        this.cameras = cameras;
        this.properties = properties;
    }

    @Scheduled(fixedDelayString = "${app.monitoring.heartbeat-ms:5000}", initialDelay = 2_000)
    @Transactional(readOnly = true)
    public void tick() {
        if (!properties.realtimeEnabled() || hub.connectedCount() == 0) {
            return;
        }
        try {
            long online = cameras.countByStatus("online");
            long total = cameras.count();

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("online", online);
            payload.put("offline", total - online);
            payload.put("total", total);
            payload.put("alerts", 0);
            payload.put("timestamp", java.time.Instant.now().toString());
            hub.emit("monitoring:tick", payload);
        } catch (RuntimeException e) {
            log.debug("[realtime] monitoring tick skipped: {}", e.getMessage());
        }
    }
}
