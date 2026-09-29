package in.gov.samajdrishti.web;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Turns every failure into the {@code {message}} body the web clients expect, and
 * keeps stack traces out of responses while still logging them.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiException e) {
        return ResponseEntity.status(e.getStatus()).body(e.getBody());
    }

    /**
     * Bean-validation failures keep the {@code {errors: [...]}} shape that
     * {@code express-validator} produced, so the existing login and register
     * screens render validation messages unchanged.
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        List<Map<String, Object>> errors = e.getBindingResult().getFieldErrors().stream()
                .map(GlobalExceptionHandler::describe)
                .toList();
        return ResponseEntity.badRequest().body(Map.of("errors", errors));
    }

    private static Map<String, Object> describe(FieldError error) {
        Map<String, Object> described = new LinkedHashMap<>();
        described.put("value", error.getRejectedValue());
        described.put("msg", error.getDefaultMessage());
        described.put("param", error.getField());
        described.put("location", "body");
        return described;
    }

    @ExceptionHandler({HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class,
            MissingServletRequestParameterException.class,
            IllegalArgumentException.class})
    public ResponseEntity<Map<String, Object>> handleBadRequest(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("message", readableMessage(e)));
    }

    private static String readableMessage(Exception e) {
        if (e instanceof HttpMessageNotReadableException) {
            return "Malformed JSON request body";
        }
        if (e instanceof MethodArgumentTypeMismatchException mismatch) {
            return "'%s' is not a valid %s".formatted(mismatch.getName(),
                    mismatch.getRequiredType() == null ? "value" : mismatch.getRequiredType().getSimpleName());
        }
        if (e instanceof MissingServletRequestParameterException missing) {
            return "'%s' is a required parameter".formatted(missing.getParameterName());
        }
        String message = e.getMessage();
        return message == null || message.isBlank() ? "Invalid request" : message;
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", "Insufficient permissions"));
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> handleMethodNotAllowed(HttpRequestMethodNotSupportedException e) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .body(Map.of("message", "%s is not supported on this route".formatted(e.getMethod())));
    }

    @ExceptionHandler({NoHandlerFoundException.class, NoResourceFoundException.class})
    public ResponseEntity<Map<String, Object>> handleUnknownRoute(Exception e) {
        String path = e instanceof NoHandlerFoundException notFound
                ? notFound.getRequestURL()
                : ((NoResourceFoundException) e).getResourcePath();
        String method = e instanceof NoHandlerFoundException notFound ? notFound.getHttpMethod() : "";
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Map.of("message", "Route not found: %s %s".formatted(method, path)));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(Exception e) {
        log.error("Unhandled request error", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("message", "Server error"));
    }
}
