package in.gov.samajdrishti.web;

import java.io.IOException;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.gov.samajdrishti.domain.Evidence;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.EvidenceService;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * Evidence capture, LLD §7.
 *
 * <p>Upload, validation, hashing, storage and the offline idempotency all live in
 * {@link EvidenceService}. The route keeps accepting the shapes both shipped clients send:
 * coordinates as plain {@code lat}/{@code lng} fields (React Native {@code FormData}) or
 * inside a {@code geo_coords} JSON object.
 */
@RestController
@RequestMapping("/api/evidence")
public class EvidenceController {

    private final EvidenceService evidence;

    public EvidenceController(EvidenceService evidence) {
        this.evidence = evidence;
    }

    /**
     * {@code multipart/form-data} upload.
     *
     * <p>{@code client_id} makes a replayed offline upload a no-op rather than a duplicate
     * piece of evidence, which is the LLD's §18 sync guarantee.
     */
    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "inspection_id", required = false) String inspectionId,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "timestamp", required = false) String timestamp,
            @RequestParam(value = "lat", required = false) String lat,
            @RequestParam(value = "lng", required = false) String lng,
            @RequestParam(value = "accuracy", required = false) String accuracy,
            @RequestParam(value = "geo_coords", required = false) String geoCoords,
            @RequestParam(value = "file_path", required = false) String filePath,
            @RequestParam(value = "client_id", required = false) String clientId,
            @RequestParam(value = "sync_status", required = false) String syncStatus,
            @AuthenticationPrincipal AuthPrincipal current) throws IOException {

        if (inspectionId == null || inspectionId.isBlank()) {
            throw ApiException.badRequest("inspection_id is required");
        }
        Map<String, Object> result = evidence.upload(
                file,
                parseInspectionId(inspectionId),
                type,
                coordinate(trimToNull(lat), jsonCoordinate(geoCoords, "lat")),
                coordinate(trimToNull(lng), jsonCoordinate(geoCoords, "lng")),
                number(trimToNull(accuracy)),
                timestamp,
                clientId,
                syncStatus,
                filePath,
                current);

        // 200 rather than 201 on a replay: nothing was created.
        boolean duplicate = Boolean.TRUE.equals(result.get("duplicate"));
        return ResponseEntity.status(duplicate ? 200 : 201).body(result);
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Evidence> list(
            @RequestParam(value = "inspection_id", required = false) Integer inspectionIdParam,
            @RequestParam(value = "inspectionId", required = false) Integer inspectionIdAlt) {
        Integer id = inspectionIdParam != null ? inspectionIdParam : inspectionIdAlt;
        return evidence.list(id);
    }

    @GetMapping("/{id}/integrity")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> integrity(@PathVariable Integer id) {
        return evidence.checkIntegrity(id);
    }

    @PutMapping("/{id}/verify")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> verify(@PathVariable Integer id, @AuthenticationPrincipal AuthPrincipal current) {
        return evidence.verify(id, current);
    }

    /**
     * Re-runs the geofence over an inspection's evidence.
     *
     * <p>For sites registered with coordinates after the fact, or a corrected radius: earlier
     * captures then get a verdict they never had, and verified ones are marked as such.
     */
    @PostMapping("/inspections/{inspectionId}/reverify")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> reverify(@PathVariable Integer inspectionId) {
        return evidence.reverify(inspectionId);
    }

    /* ----------------------------------------------------------------- helpers */

    private static Integer parseInspectionId(String value) {
        try {
            return Integer.valueOf(value.strip());
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("inspection_id must be a number");
        }
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    /** {@code lat} may arrive as a plain field or inside a {@code geo_coords} JSON object. */
    private static Double coordinate(String plain, Double fromJson) {
        return plain == null ? fromJson : number(plain);
    }

    private static Double number(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Double.valueOf(value);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Double jsonCoordinate(String geoCoordsJson, String key) {
        if (geoCoordsJson == null || geoCoordsJson.isBlank()) {
            return null;
        }
        try {
            Map<?, ?> parsed = new ObjectMapper().readValue(geoCoordsJson, Map.class);
            Object value = parsed.get(key);
            return value instanceof Number number ? number.doubleValue() : null;
        } catch (Exception e) {
            return null;
        }
    }
}
