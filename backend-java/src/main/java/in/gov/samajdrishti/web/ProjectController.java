package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.Attendance;
import in.gov.samajdrishti.domain.Camera;
import in.gov.samajdrishti.domain.Evidence;
import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.repository.AttendanceRepository;
import in.gov.samajdrishti.repository.CameraRepository;
import in.gov.samajdrishti.repository.EvidenceRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.GeoService;
import in.gov.samajdrishti.web.dto.Requests;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectRepository projects;
    private final InspectionRepository inspections;
    private final EvidenceRepository evidence;
    private final CameraRepository cameras;
    private final AttendanceRepository attendance;

    public ProjectController(ProjectRepository projects,
                             InspectionRepository inspections,
                             EvidenceRepository evidence,
                             CameraRepository cameras,
                             AttendanceRepository attendance) {
        this.projects = projects;
        this.inspections = inspections;
        this.evidence = evidence;
        this.cameras = cameras;
        this.attendance = attendance;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Project> list() {
        return projects.findAllByOrderByCreatedAtDesc();
    }

    /**
     * Project detail with everything a supervisor needs in one call: the project, its
     * inspections, the evidence behind them, the installed cameras and the attendance.
     */
    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> detail(@PathVariable Integer id) {
        Project project = projects.findById(id).orElseThrow(() -> ApiException.notFound("Project not found"));

        List<Inspection> projectInspections = inspections.findByProjectId(id);
        List<Integer> inspectionIds = projectInspections.stream().map(Inspection::getId).toList();
        List<Evidence> projectEvidence = inspectionIds.isEmpty()
                ? List.of()
                : evidence.findByInspectionIdInOrderByCreatedAtDesc(inspectionIds);

        return Map.of(
                "project", project,
                "inspections", projectInspections,
                "evidence", projectEvidence,
                "cameras", cameras.findAllByOrderByIdAsc().stream()
                        .filter(c -> Objects.equals(c.getProjectId(), id))
                        .toList(),
                "attendance", attendance.findAllByOrderByIdDesc().stream()
                        .filter(a -> Objects.equals(a.getProjectId(), id))
                        .toList());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Transactional
    public ResponseEntity<Project> create(@Valid @RequestBody Requests.CreateProject body) {
        Project project = new Project();
        project.setName(body.name());
        project.setDescription(body.description());
        project.setLocation(body.location());
        project.setDepartment(body.department());
        project.setGeoCoords(GeoPoint.of(
                body.geoCoords() == null ? null : body.geoCoords().lat(),
                body.geoCoords() == null ? null : body.geoCoords().lng()));
        project.setStartDate(body.startDate());
        project.setEndDate(body.endDate());
        project.setBudget(body.budget());
        project.setStatus("pending");
        project.setCreatedAt(Instant.now());
        return ResponseEntity.status(201).body(projects.save(project));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public Project update(@PathVariable Integer id, @RequestBody Requests.UpdateProject body) {
        Project project = projects.findById(id).orElseThrow(() -> ApiException.notFound("Project not found"));
        if (body.name() != null) {
            project.setName(body.name());
        }
        if (body.description() != null) {
            project.setDescription(body.description());
        }
        if (body.status() != null) {
            project.setStatus(body.status());
        }
        if (body.budget() != null) {
            project.setBudget(body.budget());
        }
        return projects.save(project);
    }

    static GeoPoint coordsOf(Project project) {
        return project == null ? null : GeoService.normalise(project.getGeoCoords());
    }

    static GeoPoint coordsOf(Camera camera) {
        return camera == null ? null : GeoService.normalise(camera.getGeoCoords());
    }
}
