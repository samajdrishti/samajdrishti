package in.gov.samajdrishti.service;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import in.gov.samajdrishti.config.AppProperties;
import in.gov.samajdrishti.domain.Evidence;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.realtime.RealtimeHub;
import in.gov.samajdrishti.repository.EvidenceRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.GeoService;
import in.gov.samajdrishti.web.ApiException;

/**
 * Evidence capture and storage, including the offline-sync guarantees of LLD §18.
 *
 * <p>The offline field app writes each capture to a local queue with a client-generated
 * UUID and replays it when coverage returns, retrying until it gets an ack. That makes two
 * failure modes unavoidable, and both are handled here:
 *
 * <ul>
 *   <li><b>The ack is lost.</b> The phone resends a capture the server already stored. The
 *       {@code clientId} lookup returns the original row, so the retry is a no-op instead of
 *       a duplicate piece of evidence.</li>
 *   <li><b>The same photo arrives twice legitimately</b> - a resync, or an officer who
 *       re-captured it. The SHA-256 catches the case where a *different* clientId carries
 *       identical bytes.</li>
 * </ul>
 *
 * <p>Uploads are also geo-verified here, which they previously were not. Evidence is the
 * proof of visit, so storing coordinates without ever checking them against the site radius
 * left the anti-proxy control opt-in per client.
 */
@Service
public class EvidenceService {

    private static final Set<String> ALLOWED_EXTENSIONS =
            Set.of(".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".m4a", ".pdf");

    /**
     * Extensions are allow-listed; content types are checked to match. A content type alone
     * is trivially forged, so it is a guard against accidents and the extension allow-list
     * is the actual control.
     */
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime",
            "audio/mp4", "audio/m4a", "audio/mpeg", "application/pdf");

    private static final long MAX_BYTES = 10L * 1024 * 1024;

    private final EvidenceRepository evidence;
    private final InspectionRepository inspections;
    private final ProjectRepository projects;
    private final AppProperties properties;
    private final GeoService geo;
    private final AuditService audit;
    private final NotificationService notifications;
    private final RealtimeHub hub;

    public EvidenceService(EvidenceRepository evidence,
                           InspectionRepository inspections,
                           ProjectRepository projects,
                           AppProperties properties,
                           GeoService geo,
                           AuditService audit,
                           NotificationService notifications,
                           RealtimeHub hub) {
        this.evidence = evidence;
        this.inspections = inspections;
        this.projects = projects;
        this.properties = properties;
        this.geo = geo;
        this.audit = audit;
        this.notifications = notifications;
        this.hub = hub;
    }

    /**
     * Stores one capture.
     *
     * @return the evidence row, plus {@code duplicate} when an idempotent replay was detected
     *         and {@code geo_verification} so the client learns the verdict immediately
     */
    @Transactional
    public Map<String, Object> upload(MultipartFile file,
                                      Integer inspectionId,
                                      String type,
                                      Double lat,
                                      Double lng,
                                      Double accuracy,
                                      String timestamp,
                                      String clientId,
                                      String syncStatus,
                                      String filePath,
                                      AuthPrincipal actor) throws IOException {
        if (inspectionId == null) {
            throw ApiException.badRequest("inspection_id is required");
        }
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));

        // Idempotency first: a replayed offline upload must not consume disk or create a row.
        String normalisedClientId = trimToNull(clientId);
        if (normalisedClientId != null) {
            var existing = evidence.findByClientId(normalisedClientId);
            if (existing.isPresent()) {
                Map<String, Object> replay = flatten(existing.get());
                replay.put("duplicate", true);
                return replay;
            }
        }

        Stored stored = file != null && !file.isEmpty() ? store(file) : metadataOnly(filePath);
        String hash = stored.hash();

        // Same bytes under a different clientId: a resync or a re-capture of one photo.
        if (hash != null) {
            var sameBytes = evidence.findFirstByFileHashAndInspectionIdOrderByIdDesc(hash, inspectionId);
            if (sameBytes.isPresent()) {
                Evidence original = sameBytes.get();
                Map<String, Object> replay = flatten(original);
                replay.put("duplicate", true);
                replay.put("duplicate_hash", true);
                audit.record(actor, "evidence.duplicate_upload", "evidence", original.getId(),
                        Map.of("file_hash", hash, "inspection_id", String.valueOf(inspectionId)));
                return replay;
            }
        }

        Map<String, Object> verification = verifyAgainstSite(inspection, lat, lng);

        // Integrity chain: link this capture to the previous hash for this inspection
        String previousHash = evidence.findByInspectionIdOrderByIdAsc(inspectionId)
                .stream()
                .filter(e -> e.getFileHash() != null && !e.getFileHash().isBlank())
                .reduce((firstItem, secondItem) -> secondItem)
                .map(Evidence::getFileHash)
                .orElse(null);

        Evidence record = new Evidence();
        record.setInspectionId(inspectionId);
        record.setUploadedBy(actor == null ? null : actor.id());
        record.setType(normaliseType(type));
        record.setFilePath(stored.path());
        record.setFileName(stored.name());
        record.setContentType(stored.contentType());
        record.setFileSize(stored.size());
        record.setGeoCoords(in.gov.samajdrishti.domain.GeoPoint.of(lat, lng));
        record.setAccuracy(accuracy);
        record.setTimestamp(parseTimestamp(timestamp));
        record.setFileHash(hash);
        record.setPreviousHash(previousHash);
        record.setIntegrityStatus(hash != null ? "hashed" : "unverified");
        record.setClientId(normalisedClientId);
        record.setSyncStatus(syncStatus == null || syncStatus.isBlank() ? "synced" : syncStatus);
        record.setCreatedAt(Instant.now());
        Evidence saved = evidence.save(record);

        // Evidence captured far from the site is the strongest single signal of proxy
        // reporting, so it alerts the back office immediately rather than waiting for a
        // supervisor to open the report.
        if (verification != null && "suspicious".equals(String.valueOf(verification.get("verdict")))) {
            hub.emit("alert", Map.of(
                    "severity", "high",
                    "message", "Evidence for inspection #" + inspectionId + " was captured "
                            + verification.get("explanation"),
                    "meta", Map.of("inspection_id", inspectionId, "evidence_id", saved.getId())));
            notifications.create(inspection.getAssignedTo(), "Evidence geo-check failed",
                    "Photo/video captured for inspection #" + inspectionId + " is outside the site radius.",
                    "alert", "inspection", inspectionId);
        }

        // geo_verification is null when the capture carried no coordinates, and Map.of
        // rejects nulls - so the payload is built by hand rather than with Map.of.
        Map<String, Object> capturedEvent = new LinkedHashMap<>();
        capturedEvent.put("inspection_id", inspectionId);
        capturedEvent.put("evidence_id", saved.getId());
        capturedEvent.put("type", saved.getType());
        capturedEvent.put("geo_verification", verification);
        hub.emit("evidence:captured", capturedEvent);
        audit.record(actor, "evidence.uploaded", "evidence", saved.getId(), Map.of(
                "inspection_id", String.valueOf(inspectionId),
                "type", String.valueOf(saved.getType()),
                "file_hash", hash == null ? "" : hash,
                "geo_verdict", verification == null ? "not_checked" : String.valueOf(verification.get("verdict"))));

        Map<String, Object> result = flatten(saved);
        result.put("file_url", saved.getFilePath());
        result.put("evidence_id", saved.getId());
        result.put("geo_verification", verification);
        result.put("duplicate", false);

        Map<String, Object> integrityMap = new LinkedHashMap<>();
        integrityMap.put("status", hash != null ? "hashed" : "unverified");
        integrityMap.put("sha256", hash != null ? hash : "");
        integrityMap.put("previous_hash", previousHash != null ? previousHash : "");
        integrityMap.put("chain_length", evidence.countByInspectionId(inspectionId));
        result.put("integrity", integrityMap);
        result.put("previous_hash", previousHash);
        result.put("sha256_hash", hash);
        result.put("mime_type", saved.getContentType());
        return result;
    }

    /**
     * The evidence row spread across the top level of the response.
     *
     * <p>The upload response has always been the bare entity - {@code inspection_id},
     * {@code type}, {@code geo_coords} and {@code file_path} at the top level - and both
     * shipped clients read it that way. Nesting it under an {@code evidence} key would be
     * tidier and would break them, so the LLD's {@code file_url}/{@code syncStatus} are added
     * alongside instead.
     */
    private static Map<String, Object> flatten(Evidence record) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("id", record.getId());
        body.put("inspection_id", record.getInspectionId());
        body.put("uploaded_by", record.getUploadedBy());
        body.put("type", record.getType());
        body.put("file_path", record.getFilePath());
        body.put("file_name", record.getFileName());
        body.put("content_type", record.getContentType());
        body.put("mime_type", record.getContentType());
        body.put("file_size", record.getFileSize());
        body.put("geo_coords", record.getGeoCoords());
        body.put("accuracy", record.getAccuracy());
        body.put("timestamp", record.getTimestamp());
        body.put("file_hash", record.getFileHash());
        body.put("sha256_hash", record.getFileHash());
        body.put("previous_hash", record.getPreviousHash());
        body.put("integrity_status", record.getIntegrityStatus());
        body.put("hash_verified", record.getHashVerified());
        body.put("client_id", record.getClientId());
        body.put("sync_status", record.getSyncStatus());
        body.put("verified", record.isVerified());
        body.put("verified_by", record.getVerifiedBy());
        body.put("verified_at", record.getVerifiedAt());
        body.put("created_at", record.getCreatedAt());
        return body;
    }

    @Transactional(readOnly = true)
    public List<Evidence> list(Integer inspectionId) {
        return inspectionId == null
                ? evidence.findAllByOrderByCreatedAtDesc()
                : evidence.findByInspectionIdOrderByCreatedAtDesc(inspectionId);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> checkIntegrity(Integer id) {
        Evidence record = evidence.findById(id)
                .orElseThrow(() -> ApiException.notFound("Evidence not found"));
        return checkIntegrity(record);
    }

    public Map<String, Object> checkIntegrity(Evidence record) {
        Map<String, Object> result = flatten(record);
        Map<String, Object> integrity = new LinkedHashMap<>();

        if (record.getFileHash() == null || record.getFileHash().isBlank()) {
            integrity.put("status", "unverified");
            integrity.put("file_match", false);
            integrity.put("chain_ok", true);
            integrity.put("explanation", "No integrity hash was recorded for this item (it predates the chain).");
            result.put("integrity", integrity);
            return result;
        }

        Path file = resolveFilePath(record.getFilePath());
        String actualHash = null;
        if (file != null && Files.exists(file)) {
            try {
                byte[] bytes = Files.readAllBytes(file);
                MessageDigest digest = sha256();
                actualHash = hex(digest.digest(bytes));
            } catch (Exception e) {
                // file read error
            }
        }

        if (actualHash == null) {
            integrity.put("status", "missing_file");
            integrity.put("file_match", false);
            integrity.put("chain_ok", true);
            integrity.put("expected_hash", record.getFileHash());
            integrity.put("actual_hash", null);
            integrity.put("explanation", "The stored file could not be read - it was moved or deleted after upload.");
            result.put("integrity", integrity);
            return result;
        }

        boolean fileMatch = actualHash.equalsIgnoreCase(record.getFileHash());

        List<Evidence> chain = evidence.findByInspectionIdOrderByIdAsc(record.getInspectionId());
        boolean chainOk = true;
        String lastSeenHash = null;
        for (Evidence curr : chain) {
            if (curr.getFileHash() == null || curr.getFileHash().isBlank()) {
                continue;
            }
            String actualPrevious = curr.getPreviousHash();
            if (lastSeenHash == null) {
                if (actualPrevious != null && !actualPrevious.isBlank()) {
                    chainOk = false;
                    break;
                }
            } else {
                if (!lastSeenHash.equalsIgnoreCase(actualPrevious)) {
                    chainOk = false;
                    break;
                }
            }
            lastSeenHash = curr.getFileHash();
        }

        boolean ok = fileMatch && chainOk;
        integrity.put("status", ok ? "verified" : "tampered");
        integrity.put("file_match", fileMatch);
        integrity.put("chain_ok", chainOk);
        integrity.put("expected_hash", record.getFileHash());
        integrity.put("actual_hash", actualHash);
        integrity.put("chain_length", chain.size());
        integrity.put("checked_at", Instant.now().toString());
        integrity.put("explanation", !fileMatch
                ? "The stored file no longer matches the hash taken at upload - the artefact was altered after submission."
                : (chainOk
                        ? "File hash matches the hash taken at upload and every chain link is intact."
                        : "The file is unchanged but a chain link is broken - evidence may have been added or removed."));

        result.put("integrity", integrity);
        return result;
    }

    @Transactional
    public Map<String, Object> verify(Integer id, AuthPrincipal actor) {
        Evidence record = evidence.findById(id)
                .orElseThrow(() -> ApiException.notFound("Evidence not found"));

        Map<String, Object> check = checkIntegrity(record);
        @SuppressWarnings("unchecked")
        Map<String, Object> integrity = (Map<String, Object>) check.get("integrity");
        String status = String.valueOf(integrity.get("status"));
        boolean ok = "verified".equals(status);

        record.setVerified(ok);
        record.setIntegrityStatus(status);
        record.setHashVerified(Boolean.TRUE.equals(integrity.get("file_match")));
        if (ok) {
            record.setVerifiedBy(actor == null ? null : actor.id());
            record.setVerifiedAt(Instant.now());
            audit.record(actor, "evidence.verified", "evidence", id,
                    Map.of("inspection_id", String.valueOf(record.getInspectionId())));
        } else {
            record.setVerifiedBy(null);
            record.setVerifiedAt(null);
            audit.record(actor, "evidence.integrity_failed", "evidence", id,
                    Map.of("inspection_id", String.valueOf(record.getInspectionId()),
                            "status", status,
                            "expected_hash", String.valueOf(integrity.get("expected_hash")),
                            "actual_hash", String.valueOf(integrity.get("actual_hash"))));
            hub.emit("alert", Map.of(
                    "severity", "high",
                    "message", "Evidence #" + id + " failed integrity check (" + status.replace('_', ' ') + ")",
                    "meta", Map.of("evidence_id", id, "status", status)
            ));
        }
        Evidence saved = evidence.save(record);
        Map<String, Object> result = flatten(saved);
        result.put("integrity", integrity);
        return result;
    }

    public Path resolveFilePath(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            return null;
        }
        String clean = filePath.replace('\\', '/').replaceAll("^/+", "");
        if (clean.startsWith("uploads/evidence/")) {
            clean = clean.substring("uploads/evidence/".length());
        } else if (clean.startsWith("uploads/")) {
            clean = clean.substring("uploads/".length());
        }

        List<Path> candidates = List.of(
                Path.of(properties.uploads().evidenceDir()).toAbsolutePath().normalize().resolve(clean),
                Path.of("uploads/evidence").toAbsolutePath().normalize().resolve(clean),
                Path.of("backend-java/uploads/evidence").toAbsolutePath().normalize().resolve(clean),
                Path.of("../backend-java/uploads/evidence").toAbsolutePath().normalize().resolve(clean),
                Path.of(filePath).toAbsolutePath().normalize()
        );
        for (Path p : candidates) {
            if (Files.exists(p)) {
                return p;
            }
        }
        return candidates.get(0);
    }

    /**
     * Re-runs the geofence for an inspection's evidence.
     *
     * <p>Used when a site is registered with coordinates after the fact, or a radius is
     * corrected - previously captured evidence then gets a verdict it never had.
     */
    @Transactional
    public Map<String, Object> reverify(Integer inspectionId) {
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        Project project = projects.findById(inspection.getProjectId()).orElse(null);

        List<Map<String, Object>> verdicts = new java.util.ArrayList<>();
        for (Evidence record : evidence.findByInspectionIdOrderByCreatedAtDesc(inspectionId)) {
            Map<String, Object> verdict = new LinkedHashMap<>(geo.verify(
                    GeoService.normalise(project == null ? null : project.getGeoCoords()),
                    record.getGeoCoords()));
            verdict.put("evidence_id", record.getId());
            verdicts.add(verdict);
            if ("verified".equals(String.valueOf(verdict.get("verdict"))) && !record.isVerified()) {
                record.setVerified(true);
                record.setVerifiedAt(Instant.now());
                evidence.save(record);
            }
        }
        return Map.of("inspection_id", inspectionId, "verdicts", verdicts, "count", verdicts.size());
    }

    /* ----------------------------------------------------------------- helpers */

    /**
     * The geofence verdict for a capture, or null when there is nothing to check against.
     *
     * <p>Deliberately uses the inspection's registered project coordinates rather than
     * trusting the client to have done the check - that is the whole point.
     */
    private Map<String, Object> verifyAgainstSite(Inspection inspection, Double lat, Double lng) {
        if (lat == null || lng == null) {
            return null;
        }
        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        return geo.verify(GeoService.normalise(project == null ? null : project.getGeoCoords()),
                in.gov.samajdrishti.domain.GeoPoint.of(lat, lng));
    }

    private record Stored(String path, String name, String contentType, Long size, String hash) {
    }

    /**
     * Streams the upload to disk, hashing as it goes.
     *
     * <p>Validation happens before a single byte is written: an over-sized or
     * disallowed-type upload is rejected outright rather than stored and then judged, so
     * the storage directory never holds something the service will not serve.
     */
    private Stored store(MultipartFile file) throws IOException {
        String original = file.getOriginalFilename() == null ? "evidence" : file.getOriginalFilename();
        String extension = extensionOf(original);
        if (extension.isEmpty() || !ALLOWED_EXTENSIONS.contains(extension)) {
            throw ApiException.badRequest("Invalid file type. Allowed: " + String.join(", ", ALLOWED_EXTENSIONS));
        }
        if (file.getSize() > MAX_BYTES) {
            throw ApiException.badRequest("File exceeds the 10 MB limit");
        }
        String contentType = file.getContentType();
        if (contentType != null && !ALLOWED_CONTENT_TYPES.contains(contentType.toLowerCase(Locale.ROOT))) {
            throw ApiException.badRequest("Unsupported content type: " + contentType);
        }

        Path directory = Path.of(properties.uploads().evidenceDir()).toAbsolutePath().normalize();
        Files.createDirectories(directory);
        String filename = "%d-%s".formatted(System.currentTimeMillis(), sanitize(original));
        Path target = directory.resolve(filename).normalize();
        // Belt and braces against a crafted filename escaping the evidence directory.
        if (!target.startsWith(directory)) {
            throw ApiException.badRequest("Invalid file name");
        }

        MessageDigest digest = sha256();
        try (InputStream input = file.getInputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            try (var out = Files.newOutputStream(target)) {
                while ((read = input.read(buffer)) != -1) {
                    digest.update(buffer, 0, read);
                    out.write(buffer, 0, read);
                }
            }
        }
        return new Stored("/uploads/evidence/" + filename, sanitize(original), contentType, file.getSize(), hex(digest));
    }

    /** A record with no bytes: the client already uploaded to object storage and sent the key. */
    private Stored metadataOnly(String filePath) {
        if (filePath == null || filePath.isBlank()) {
            throw ApiException.badRequest("A file or a file_path is required");
        }
        String trimmed = filePath.strip();
        if (!trimmed.startsWith("/uploads/")) {
            throw ApiException.badRequest("file_path must point inside /uploads/");
        }
        return new Stored(trimmed, trimmed.substring(trimmed.lastIndexOf('/') + 1), null, null, null);
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by the JLS but unavailable", e);
        }
    }

    private static String hex(MessageDigest digest) {
        return hex(digest.digest());
    }

    private static String hex(byte[] bytes) {
        StringBuilder out = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            out.append(Character.forDigit((b >> 4) & 0xF, 16));
            out.append(Character.forDigit(b & 0xF, 16));
        }
        return out.toString();
    }

    private static String sanitize(String filename) {
        String cleaned = filename.replaceAll("[^A-Za-z0-9._-]", "_").replaceAll("^[.\\-]+", "");
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

    private static Instant parseTimestamp(String value) {
        if (value == null || value.isBlank()) {
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
