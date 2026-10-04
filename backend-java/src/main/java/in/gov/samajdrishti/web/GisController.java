package in.gov.samajdrishti.web;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import in.gov.samajdrishti.domain.Camera;
import in.gov.samajdrishti.domain.Institution;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.repository.CameraRepository;
import in.gov.samajdrishti.repository.InstitutionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.service.GeoService;

/**
 * Real-time compliance GIS feed for the back-office map.
 *
 * <p>The dashboard's GIS page plots every monitored center on a real map (Google Maps
 * when a browser key is configured, OpenStreetMap otherwise), with the center head,
 * sanctioned capacity vs verified headcount and every ground-level camera. Cameras are
 * linked through the institution's project, the same link the monitoring wall uses.
 *
 * <p>The Google Maps browser key is served here, never bundled in the frontend, so it
 * can be rotated without a rebuild. Empty means "no key configured" and the dashboard
 * falls back to OpenStreetMap tiles.
 */
@RestController
@RequestMapping("/api/gis")
public class GisController {

    private final InstitutionRepository institutions;
    private final ProjectRepository projects;
    private final CameraRepository cameras;

    /** Browser key for the Google Maps JS API. Empty = OSM fallback, never logged. */
    @Value("${GOOGLE_MAP_API:}")
    private String googleMapsKey;

    public GisController(InstitutionRepository institutions,
                         ProjectRepository projects,
                         CameraRepository cameras) {
        this.institutions = institutions;
        this.projects = projects;
        this.cameras = cameras;
    }

    @GetMapping("/centers")
    @Transactional(readOnly = true)
    public Map<String, Object> centers() {
        Map<Integer, Project> projectsById = new LinkedHashMap<>();
        projects.findAll().forEach(p -> projectsById.put(p.getId(), p));

        Map<Integer, List<Camera>> camerasByProject = new LinkedHashMap<>();
        for (Camera camera : cameras.findAllByOrderByIdAsc()) {
            if (camera.getProjectId() == null) {
                continue;
            }
            camerasByProject.computeIfAbsent(camera.getProjectId(), k -> new ArrayList<>()).add(camera);
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (Institution institution : institutions.findAllByOrderByNameAsc()) {
            Project project = institution.getProjectId() == null
                    ? null : projectsById.get(institution.getProjectId());
            List<Camera> siteCameras = institution.getProjectId() == null
                    ? List.of()
                    : camerasByProject.getOrDefault(institution.getProjectId(), List.of());
            rows.add(center(institution, project, siteCameras));
        }

        String key = googleMapsKey == null ? "" : googleMapsKey.strip();
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("api_key", key);
        map.put("provider", key.isBlank() ? "osm" : "google");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("centers", rows);
        body.put("count", rows.size());
        body.put("map", map);
        return body;
    }

    /* ------------------------------------------------------------------ helpers */

    private static Map<String, Object> center(Institution institution, Project project,
                                              List<Camera> siteCameras) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", institution.getId());
        row.put("project_id", institution.getProjectId());
        row.put("name", institution.getName());
        row.put("location", locationOf(institution));
        row.put("scheme", institution.getScheme() == null
                ? null : institution.getScheme().toUpperCase(java.util.Locale.ROOT));
        row.put("status", institution.getStatus());
        row.put("geo_coords", GeoService.normalise(institution.getGeoCoords()));

        Map<String, Object> head = new LinkedHashMap<>();
        head.put("name", institution.getInchargeName());
        head.put("designation", designationOf(institution.getType()));
        head.put("phone", institution.getInchargePhone());
        row.put("head", head);

        row.put("budget", project == null ? null : project.getBudget());
        Map<String, Object> metadata = metadataOf(project);
        row.put("sanction_code", metadata.get("sanction_code"));
        row.put("sanctioned_capacity", institution.getSanctionedCapacity());
        row.put("verified_headcount", metadata.get("verified_headcount"));
        row.put("aebas_punch_count", metadata.get("aebas_punch_count"));
        row.put("discrepancy_delta", metadata.get("discrepancy_delta"));

        List<Map<String, Object>> cameraRows = new ArrayList<>();
        for (Camera camera : siteCameras) {
            cameraRows.add(cameraRow(camera));
        }
        row.put("cameras", cameraRows);
        row.put("camera_count", cameraRows.size());
        row.put("cameras_online", cameraRows.stream()
                .filter(c -> Boolean.TRUE.equals(c.get("online"))).count());
        return row;
    }

    private static Map<String, Object> cameraRow(Camera camera) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", camera.getId());
        row.put("name", camera.getName());
        row.put("location", camera.getLocation());
        row.put("status", camera.getStatus());
        row.put("online", "online".equals(camera.getStatus()));
        row.put("geo_coords", GeoService.normalise(camera.getGeoCoords()));
        row.put("tamper_flag", camera.getTamperFlag());
        row.put("anomaly_note", camera.getAnomalyNote());
        row.put("detected_headcount", camera.getDetectedHeadcount());
        row.put("aebas_punch_count", camera.getAebasPunchCount());
        row.put("snapshot_url", "/api/monitoring/cameras/" + camera.getId() + "/snapshot");
        return row;
    }

    private static String locationOf(Institution institution) {
        String address = institution.getAddress() == null ? "" : institution.getAddress();
        String district = institution.getDistrict() == null ? "" : institution.getDistrict();
        if (!address.isBlank() && !district.isBlank() && !address.contains(district)) {
            return address + ", " + district;
        }
        return !address.isBlank() ? address : district;
    }

    private static String designationOf(String type) {
        if (type == null) {
            return "In-charge";
        }
        return switch (type.toLowerCase(java.util.Locale.ROOT)) {
            case "hostel" -> "Warden";
            case "special_school" -> "Principal";
            case "rehab_centre" -> "Centre Director";
            case "shelter" -> "Shelter In-charge";
            default -> "In-charge";
        };
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> metadataOf(Project project) {
        if (project != null && project.getMetadata() instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }
}
