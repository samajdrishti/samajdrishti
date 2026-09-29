package in.gov.samajdrishti.web;

import in.gov.samajdrishti.config.AppProperties;
import in.gov.samajdrishti.domain.Evidence;
import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.repository.EvidenceRepository;
import java.io.InputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.format.DateTimeParseException;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/evidence")
public class EvidenceController {

    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of(".jpg", ".jpeg", ".png", ".mp4", ".mov", ".pdf");

    private final EvidenceRepository evidence;
    private final AppProperties properties;

    public EvidenceController(EvidenceRepository evidence, AppProperties properties) {
        this.evidence = evidence;
        this.properties = properties;
    }

    /**
     * {@code multipart/form-data} upload.
     *
     * <p>Geo coordinates arrive either as a JSON {@code geo_coords} object (JSON clients)
     * or as individual {@code lat}/{@code lng} fields (React Native {@code FormData}).
     * The captured file is streamed straight to disk, so a 10 MB upload never sits in
     * the heap.
     */
    @PostMapping(consumes = "multipart/form-data")
    @Transactional
    public ResponseEntity<Evidence> upload(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "inspection_id", required = false) String inspectionId,
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "timestamp", required = false) String timestamp,
            @RequestParam(value = "lat", required = false) String lat,
            @RequestParam(value = "lng", required = false) String lng,
            @RequestParam(value = "geo_coords", required = false) String geoCoords,
            @RequestParam(value = "file_path", required = false) String filePath) throws IOException {

        if (inspectionId == null || inspectionId.isBlank()) {
            throw ApiException.badRequest("inspection_id is required");
        }

        String storedPath = file != null && !file.isEmpty() ? store(file) : blankToNull(filePath);

        Evidence record = new Evidence();
        record.setInspectionId(Integer.valueOf(inspectionId.strip()));
        record.setType(normaliseType(type));
        record.setFilePath(storedPath);
        record.setGeoCoords(GeoPoint.of(
                coordinate(trimToNull(lat), jsonCoordinate(geoCoords, "lat")),
                coordinate(trimToNull(lng), jsonCoordinate(geoCoords, "lng"))));
        record.setTimestamp(parseTimestamp(timestamp));
        record.setCreatedAt(Instant.now());
        return ResponseEntity.status(201).body(evidence.save(record));
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Evidence> list(@RequestParam(required = false) Integer inspectionId) {
        if (inspectionId != null) {
            return evidence.findByInspectionIdOrderByCreatedAtDesc(inspectionId);
        }
        return evidence.findAllByOrderByCreatedAtDesc();
    }

    @PutMapping("/{id}/verify")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Transactional
    public Evidence verify(@PathVariable Integer id) {
        Evidence record = evidence.findById(id)
                .orElseThrow(() -> ApiException.notFound("Evidence not found"));
        record.setVerified(true);
        return evidence.save(record);
    }

    /* ---------------------------------------------------------------- helpers */

    private String store(MultipartFile file) throws IOException {
        String original = file.getOriginalFilename() == null ? "evidence" : file.getOriginalFilename();
        String extension = extensionOf(original);
        if (!extension.isEmpty() && !ALLOWED_EXTENSIONS.contains(extension)) {
            throw ApiException.badRequest("Invalid file type");
        }
        Path directory = Path.of(properties.uploads().evidenceDir());
        Files.createDirectories(directory);
        String filename = "%d-%s".formatted(System.currentTimeMillis(), sanitize(original));
        Path target = directory.resolve(filename);
        try (InputStream input = file.getInputStream()) {
            Files.copy(input, target, StandardCopyOption.REPLACE_EXISTING);
        }
        return "/uploads/evidence/" + filename;
    }

    private static String sanitize(String filename) {
        String cleaned = filename.replaceAll("[^A-Za-z0-9._-]", "_");
        return cleaned.isBlank() ? "evidence" : cleaned;
    }

    private static String extensionOf(String filename) {
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot).toLowerCase(Locale.ROOT);
    }

    private static String normaliseType(String type) {
        if (type == null || type.isBlank()) {
            return "photo";
        }
        return switch (type.strip().toLowerCase(Locale.ROOT)) {
            case "photo", "video", "audio", "document" -> type.strip().toLowerCase(Locale.ROOT);
            default -> "photo";
        };
    }

    private static String trimToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    /** {@code lat} may arrive as a plain field or inside a {@code geo_coords} JSON object. */
    private static Double coordinate(String plain, Double fromJson) {
        if (plain != null) {
            try {
                return Double.valueOf(plain);
            } catch (NumberFormatException e) {
                return fromJson;
            }
        }
        return fromJson;
    }

    private static Double jsonCoordinate(String geoCoordsJson, String key) {
        if (geoCoordsJson == null || geoCoordsJson.isBlank()) {
            return null;
        }
        try {
            Map<?, ?> parsed = new com.fasterxml.jackson.databind.ObjectMapper()
                    .readValue(geoCoordsJson, Map.class);
            Object value = parsed.get(key);
            return value instanceof Number number ? number.doubleValue() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static Instant parseTimestamp(String value) {
        if (value == null) {
            return Instant.now();
        }
        try {
            return Instant.parse(value);
        } catch (DateTimeParseException e) {
            try {
                return java.time.LocalDateTime.parse(value).toInstant(java.time.ZoneOffset.UTC);
            } catch (DateTimeParseException ignored) {
                return Instant.now();
            }
        }
    }
}
