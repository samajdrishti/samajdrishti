package in.gov.samajdrishti.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import in.gov.samajdrishti.config.AppProperties;

/**
 * HTTP transport for the AI engine.
 *
 * <p>Built on {@link HttpClient} rather than Spring's {@code RestClient} for two
 * reasons: a call such as the narrative legitimately needs a much longer read timeout
 * than the health probe, and the request bodies are lists of maps whose concrete type
 * content negotiation cannot infer.
 *
 * <p>Wired explicitly by {@code AiClientConfig#aiEngineTransport}, not by component
 * scanning: the constructor needs an {@code ObjectMapper} and {@code AppProperties},
 * so there is no no-arg constructor for scanning to use, and annotating it would put a
 * second {@code AiEngineTransport} definition in the context alongside the bean method.
 */
public class HttpAiEngineTransport implements AiEngineTransport {

    private static final Logger log = LoggerFactory.getLogger(HttpAiEngineTransport.class);
    private static final int MAX_ERROR_BODY = 400;

    private final HttpClient http;
    private final ObjectMapper json;
    private final String baseUrl;

    public HttpAiEngineTransport(ObjectMapper json, AppProperties properties) {
        this.json = json;
        this.baseUrl = properties.aiEngine().baseUrl();
        this.http = HttpClient.newBuilder()
                .connectTimeout(properties.aiEngine().healthTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                // Pinned to HTTP/1.1: the default would try an h2c upgrade, which uvicorn
                // answers with "Unsupported upgrade request" and the body never arrives.
                .version(HttpClient.Version.HTTP_1_1)
                .build();
    }

    @Override
    public Map<String, Object> post(String path, Object body, Duration timeout) {
        byte[] payload;
        try {
            payload = json.writeValueAsBytes(body);
        } catch (Exception e) {
            log.warn("[ai] could not serialise the request for {}: {}", path, e.getMessage());
            return null;
        }

        try {
            HttpRequest request = HttpRequest.newBuilder(endpoint(path))
                    .timeout(timeout)
                    .header("Accept", "application/json")
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofByteArray(payload))
                    .build();
            return decode(send(request, path));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("[ai] {} was interrupted", path);
            return null;
        } catch (Exception e) {
            log.warn("[ai] {} failed: {}", path, e.getMessage());
            return null;
        }
    }

    @Override
    public Map<String, Object> get(String path, Duration timeout) {
        try {
            HttpRequest request = HttpRequest.newBuilder(endpoint(path))
                    .timeout(timeout)
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            return decode(send(request, path));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("interrupted while calling the AI engine", e);
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(e.getMessage(), e);
        }
    }

    private URI endpoint(String path) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        return URI.create(base + path);
    }

    private String send(HttpRequest request, String path) throws Exception {
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) {
            String body = response.body() == null ? "" : response.body();
            if (body.length() > MAX_ERROR_BODY) {
                body = body.substring(0, MAX_ERROR_BODY) + "...";
            }
            throw new IllegalStateException("HTTP " + response.statusCode() + " from " + path + ": " + body);
        }
        return response.body();
    }

    private Map<String, Object> decode(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            return json.readValue(body, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception e) {
            throw new IllegalStateException("the AI engine returned malformed JSON", e);
        }
    }
}
