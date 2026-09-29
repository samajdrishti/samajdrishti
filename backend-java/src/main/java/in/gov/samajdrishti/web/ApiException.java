package in.gov.samajdrishti.web;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Carries an HTTP status and the {@code {message}} body the API contract requires,
 * plus any extra fields a specific failure needs to explain itself (for example the
 * geo verdict that caused a check-in to be refused).
 */
public class ApiException extends RuntimeException {

    private final int status;
    private final transient Map<String, Object> extra;

    public ApiException(int status, String message) {
        this(status, message, Map.of());
    }

    public ApiException(int status, String message, Map<String, Object> extra) {
        super(message);
        this.status = status;
        this.extra = extra == null ? Map.of() : extra;
    }

    public int getStatus() {
        return status;
    }

    public Map<String, Object> getBody() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("message", getMessage());
        body.putAll(extra);
        return body;
    }

    public static ApiException badRequest(String message) {
        return new ApiException(400, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(404, message);
    }

    public static ApiException badGateway(String message) {
        return new ApiException(502, message);
    }
}
