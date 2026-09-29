package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.AuditEntry;
import in.gov.samajdrishti.domain.Camera;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.repository.AuditRepository;
import in.gov.samajdrishti.repository.CameraRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.AuditService;
import in.gov.samajdrishti.service.CctvFrameService;
import in.gov.samajdrishti.service.GeoService;
import in.gov.samajdrishti.web.dto.Requests;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/monitoring")
public class MonitoringController {

    private static final List<String> STREAM_TYPES = List.of("simulated", "mjpeg", "hls");

    private final CameraRepository cameras;
    private final ProjectRepository projects;
    private final InspectionRepository inspections;
    private final AuditRepository audit;
    private final CctvFrameService cctv;
    private final AuditService auditService;

    public MonitoringController(CameraRepository cameras,
                                ProjectRepository projects,
                                InspectionRepository inspections,
                                AuditRepository audit,
                                CctvFrameService cctv,
                                AuditService auditService) {
        this.cameras = cameras;
        this.projects = projects;
        this.inspections = inspections;
        this.audit = audit;
        this.cctv = cctv;
        this.auditService = auditService;
    }

    @GetMapping("/cameras")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> listCameras(@RequestParam(required = false) Integer projectId,
                                                  @RequestParam(required = false) String status) {
        Map<Integer, Project> projectsById = projectsById();
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Camera camera : cameras.findAllByOrderByIdAsc()) {
            if (projectId != null && !projectId.equals(camera.getProjectId())) {
                continue;
            }
            if (status != null && !status.equals(camera.getStatus())) {
                continue;
            }
            rows.add(decorate(camera, projectsById.get(camera.getProjectId())));
        }
        return rows;
    }

    @PostMapping("/cameras")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Transactional
    public ResponseEntity<Camera> createCamera(@Valid @RequestBody Requests.CreateCamera body,
                                               @AuthenticationPrincipal AuthPrincipal current) {
        String type = STREAM_TYPES.contains(body.streamType()) ? body.streamType() : "simulated";
        if (!"simulated".equals(type) && (body.streamUrl() == null || body.streamUrl().isBlank())) {
            throw ApiException.badRequest("stream_url is required for " + type + " cameras");
        }

        Camera camera = new Camera();
        camera.setName(body.name());
        camera.setProjectId(body.projectId());
        camera.setLocation(body.location());
        camera.setStreamType(type);
        camera.setStreamUrl(body.streamUrl());
        camera.setGeoCoords(in.gov.samajdrishti.domain.GeoPoint.of(body.lat(), body.lng()));
        camera.setStatus("online");
        camera.setLastSeen(Instant.now());
        camera.setCreatedAt(Instant.now());
        Camera saved = cameras.save(camera);

        auditService.record(current, "camera.created", "camera", saved.getId(),
                Map.of("name", saved.getName(), "stream_type", saved.getStreamType()));
        return ResponseEntity.status(201).body(saved);
    }

    @PatchMapping("/cameras/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Transactional
    public Camera updateCamera(@PathVariable Integer id, @RequestBody Requests.UpdateCamera body,
                               @AuthenticationPrincipal AuthPrincipal current) {
        Camera camera = cameras.findById(id).orElseThrow(() -> ApiException.notFound("Camera not found"));
        camera.setStatus("offline".equals(body.status()) ? "offline" : "online");
        camera.setLastSeen(Instant.now());
        Camera saved = cameras.save(camera);

        auditService.record(current, "camera.status_changed", "camera", saved.getId(),
                Map.of("status", saved.getStatus()));
        return saved;
    }

    /**
     * Live frame. Simulated cameras are rendered here as a moving PNG; real cameras are
     * proxied so the browser never talks to a third-party origin directly.
     */
    @GetMapping(value = "/cameras/{id}/snapshot", produces = MediaType.IMAGE_PNG_VALUE)
    @Transactional(readOnly = true)
    public ResponseEntity<byte[]> snapshot(@PathVariable Integer id) {
        Camera camera = cameras.findById(id).orElseThrow(() -> ApiException.notFound("Camera not found"));

        if (!"simulated".equals(camera.getStreamType()) && camera.getStreamUrl() != null) {
            Optional<CctvFrameService.ProxiedFrame> proxied = cctv.proxySnapshot(camera.getStreamUrl());
            if (proxied.isPresent()) {
                return ResponseEntity.ok()
                        .cacheControl(CacheControl.noStore())
                        .header("Pragma", "no-cache")
                        .header("X-Stream-Source", "proxied")
                        .contentType(MediaType.parseMediaType(proxied.get().contentType()))
                        .body(proxied.get().bytes());
            }
            return simulated(camera, "fallback-simulated");
        }
        return simulated(camera, "simulated");
    }

    private ResponseEntity<byte[]> simulated(Camera camera, String source) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .header("Pragma", "no-cache")
                .header("X-Stream-Source", source)
                .contentType(MediaType.IMAGE_PNG)
                .body(cctv.renderFrame(camera, Instant.now().toEpochMilli()));
    }

    @GetMapping("/overview")
    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        Map<Integer, Project> projectsById = projectsById();
        List<Map<String, Object>> decorated = new ArrayList<>();
        for (Camera camera : cameras.findAllByOrderByIdAsc()) {
            decorated.add(decorate(camera, projectsById.get(camera.getProjectId())));
        }
        List<Map<String, Object>> offline = decorated.stream()
                .filter(c -> !Boolean.TRUE.equals(c.get("online")))
                .toList();
        List<Inspection> allInspections = inspections.findAll();

        List<Inspection> flagged = allInspections.stream()
                .filter(i -> "flagged".equals(i.getStatus()))
                .toList();
        List<AuditEntry> geoFailures = audit.findAllByOrderByIdDesc().stream()
                .filter(a -> "geo_verification.failed".equals(a.getAction())
                        || "geo_verification.suspicious".equals(a.getAction()))
                .toList();

        List<Map<String, Object>> alerts = new ArrayList<>();
        offline.forEach(c -> {
            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("camera_id", c.get("id"));
            meta.put("last_seen", c.get("last_seen"));
            alerts.add(alert("medium", "camera_offline",
                    "%s (%s) stopped reporting"
                            .formatted(c.get("name"),
                                    c.get("project_name") == null ? "unassigned project" : c.get("project_name")),
                    meta));
        });
        flagged.forEach(i -> alerts.add(alert("high", "inspection_flagged",
                "Inspection #%d is flagged for review (risk %s)"
                        .formatted(i.getId(), i.getAiRiskScore() == null ? "n/a" : i.getAiRiskScore()),
                Map.of("inspection_id", i.getId(),
                        "project_id", i.getProjectId() == null ? 0 : i.getProjectId()))));
        geoFailures.forEach(a -> alerts.add(alert(
                "geo_verification.suspicious".equals(a.getAction()) ? "high" : "medium",
                a.getAction().replace('.', '_'),
                a.getMeta() instanceof String text && !text.isBlank()
                        ? text
                        : "Geo verification issue on " + a.getEntity() + " #" + a.getEntityId(),
                Map.of("audit_id", a.getId(), "entity_id", a.getEntityId() == null ? 0 : a.getEntityId()))));

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("cameras", decorated);
        body.put("total_cameras", decorated.size());
        body.put("online", decorated.size() - offline.size());
        body.put("offline", offline.size());
        body.put("active_inspections", allInspections.stream()
                .filter(i -> "in_progress".equals(i.getStatus())).count());
        body.put("pending_inspections", allInspections.stream()
                .filter(i -> "pending".equals(i.getStatus())).count());
        body.put("alerts", alerts.size() > 25 ? alerts.subList(0, 25) : alerts);
        body.put("last_updated", Instant.now().toString());
        return body;
    }

    /* ---------------------------------------------------------------- helpers */

    private static Map<String, Object> alert(String severity, String type, String message, Map<String, Object> meta) {
        Map<String, Object> alert = new LinkedHashMap<>();
        alert.put("severity", severity);
        alert.put("type", type);
        alert.put("message", message);
        alert.put("meta", meta);
        return alert;
    }

    private Map<Integer, Project> projectsById() {
        Map<Integer, Project> byId = new LinkedHashMap<>();
        projects.findAll().forEach(p -> byId.put(p.getId(), p));
        return byId;
    }

    private static Map<String, Object> decorate(Camera camera, Project project) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", camera.getId());
        row.put("name", camera.getName());
        row.put("project_id", camera.getProjectId());
        row.put("project_name", project == null ? null : project.getName());
        row.put("project_location", project == null ? null : project.getLocation());
        row.put("location", camera.getLocation());
        row.put("stream_type", camera.getStreamType());
        row.put("stream_url", camera.getStreamUrl());
        row.put("status", camera.getStatus());
        row.put("online", "online".equals(camera.getStatus()));
        row.put("geo_coords", GeoService.normalise(camera.getGeoCoords()));
        row.put("tamper_flag", camera.getTamperFlag());
        row.put("occlusion_pct", camera.getOcclusionPct());
        row.put("detected_headcount", camera.getDetectedHeadcount());
        row.put("aebas_punch_count", camera.getAebasPunchCount());
        row.put("anomaly_note", camera.getAnomalyNote());
        row.put("last_seen", camera.getLastSeen());
        row.put("created_at", camera.getCreatedAt());
        row.put("snapshot_url", "/api/monitoring/cameras/" + camera.getId() + "/snapshot");
        return row;
    }
}
