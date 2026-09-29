package in.gov.samajdrishti.config;

import java.time.Duration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Everything the service can tune without a rebuild. */
@ConfigurationProperties(prefix = "app")
public record AppProperties(
        @DefaultValue("postgres") String dataMode,
        @DefaultValue("true") boolean seedEnabled,
        @DefaultValue Jwt jwt,
        @DefaultValue AiEngine aiEngine,
        @DefaultValue Vc vc,
        @DefaultValue Uploads uploads,
        @DefaultValue Monitoring monitoring,
        @DefaultValue("true") boolean realtimeEnabled) {

    public record Jwt(@DefaultValue("samajdrishti_secret") String secret,
                      @DefaultValue("7") int ttlDays) {
        public Duration ttl() {
            return Duration.ofDays(ttlDays);
        }
    }

    public record AiEngine(@DefaultValue("http://localhost:5001") String baseUrl,
                           @DefaultValue("3000") int healthTimeoutMs,
                           @DefaultValue("15000") int defaultTimeoutMs) {
        public Duration healthTimeout() {
            return Duration.ofMillis(healthTimeoutMs);
        }

        public Duration defaultTimeout() {
            return Duration.ofMillis(defaultTimeoutMs);
        }
    }

    public record Vc(@DefaultValue("https://meet.jit.si") String baseUrl) {
    }

    public record Uploads(@DefaultValue("uploads/evidence") String evidenceDir) {
    }

    public record Monitoring(@DefaultValue("5000") long heartbeatMs) {
    }
}
