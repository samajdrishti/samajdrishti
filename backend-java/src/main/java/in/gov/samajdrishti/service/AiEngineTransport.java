package in.gov.samajdrishti.service;

import java.time.Duration;
import java.util.Map;

/**
 * The wire to the Python AI engine.
 *
 * <p>Extracted from {@link AiEngineClient} so the client - which holds all the fallback
 * and caching logic - can be tested without a live engine, and so the transport can be
 * swapped without touching that logic.
 */
public interface AiEngineTransport {

    /**
     * @return the decoded response, or {@code null} when the engine could not be reached
     *         or answered with a non-2xx status. Callers are expected to fall back.
     */
    Map<String, Object> post(String path, Object body, Duration timeout);

    /** POST with the caller's default read timeout. */
    default Map<String, Object> post(String path, Object body) {
        return post(path, body, Duration.ofSeconds(15));
    }

    /** @throws RuntimeException when the engine is unreachable; used only by the health probe. */
    Map<String, Object> get(String path, Duration timeout);
}
