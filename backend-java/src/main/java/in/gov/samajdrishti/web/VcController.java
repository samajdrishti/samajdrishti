package in.gov.samajdrishti.web;

import in.gov.samajdrishti.config.AppProperties;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.domain.VcJoinLog;
import in.gov.samajdrishti.domain.VcSession;
import in.gov.samajdrishti.realtime.RealtimeHub;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.repository.VcJoinLogRepository;
import in.gov.samajdrishti.repository.VcSessionRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.AuditService;
import in.gov.samajdrishti.service.NotificationService;
import in.gov.samajdrishti.web.dto.Requests;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.concurrent.ThreadLocalRandom;
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
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Random video-conference connectivity.
 *
 * <p>A project and an official are drawn at random so the pairing cannot be arranged in
 * advance, mirroring the random inspection policy. The room is a Jitsi Meet URL: free,
 * no API key, and embeddable in a browser.
 */
@RestController
@RequestMapping("/api/vc")
public class VcController {

    private final VcSessionRepository sessions;
    private final VcJoinLogRepository joinLogs;
    private final ProjectRepository projects;
    private final UserRepository users;
    private final AuditService audit;
    private final NotificationService notifications;
    private final RealtimeHub hub;
    private final AppProperties.Vc settings;
    private final SecureRandom random = new SecureRandom();

    public VcController(VcSessionRepository sessions,
                        VcJoinLogRepository joinLogs,
                        ProjectRepository projects,
                        UserRepository users,
                        AuditService audit,
                        NotificationService notifications,
                        RealtimeHub hub,
                        AppProperties properties) {
        this.sessions = sessions;
        this.joinLogs = joinLogs;
        this.projects = projects;
        this.users = users;
        this.audit = audit;
        this.notifications = notifications;
        this.hub = hub;
        this.settings = properties.vc();
    }

    @PostMapping("/sessions")
    @Transactional
    public ResponseEntity<Map<String, Object>> create(@RequestBody(required = false) Requests.CreateVcSession body,
                                                      @AuthenticationPrincipal AuthPrincipal current) {
        List<Project> allProjects = projects.findAll();
        List<User> officials = users.findByRoleOrderByIdAsc("official");
        if (allProjects.isEmpty() || officials.isEmpty()) {
            throw ApiException.badRequest("Projects and officials are required to open a session");
        }

        Integer requestedProject = body == null ? null : body.projectId();
        Integer requestedOfficial = body == null ? null : body.officialId();

        Project project = requestedProject == null
                ? allProjects.get(ThreadLocalRandom.current().nextInt(allProjects.size()))
                : allProjects.stream().filter(p -> p.getId().equals(requestedProject)).findFirst().orElse(null);
        User official = requestedOfficial == null
                ? officials.get(ThreadLocalRandom.current().nextInt(officials.size()))
                : officials.stream().filter(u -> u.getId().equals(requestedOfficial)).findFirst().orElse(null);

        if (project == null || official == null) {
            throw ApiException.badRequest("Unknown project or official");
        }

        String roomId = "SamajDrishti-%s".formatted(hex(3));
        VcSession session = new VcSession();
        session.setRoomId(roomId);
        session.setProjectId(project.getId());
        session.setOfficialId(official.getId());
        session.setMode(body != null && "direct".equals(body.mode()) ? "direct" : "random");
        session.setStatus("live");
        session.setScheduledAt(Instant.now());
        session.setJoinUrl(settings.baseUrl() + "/" + roomId);
        session.setCreatedAt(Instant.now());
        VcSession saved = sessions.save(session);

        Map<String, Object> decorated = decorate(saved, project, official);
        audit.record(current, "vc.session_opened", "vc_session", saved.getId(),
                Map.of("room", roomId, "project", project.getName(), "official", official.getName()));
        notifications.create(official.getId(),
                "You have been randomly connected to \"%s\" for a live review. Join from the Meet tab."
                        .formatted(project.getName()),
                "alert");

        hub.emitToUser(official.getId(), "vc:invite", Map.of("session", decorated));
        hub.emit("alert", Map.of(
                "severity", "info",
                "message", "Random VC opened: %s <-> %s".formatted(project.getName(), official.getName()),
                "meta", Map.of("session_id", saved.getId())));

        return ResponseEntity.status(201).body(Map.of("session", decorated));
    }

    @GetMapping("/sessions")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(@RequestParam(required = false) String status,
                                          @RequestParam(required = false) Integer limit) {
        List<Project> allProjects = projects.findAll();
        List<User> officials = users.findByRoleOrderByIdAsc("official");
        int cap = limit == null ? 50 : Math.min(limit, 200);

        List<Map<String, Object>> rows = new ArrayList<>();
        for (VcSession session : sessions.findAllByOrderByIdDesc()) {
            if (status != null && !status.equals(session.getStatus())) {
                continue;
            }
            rows.add(decorate(session, findProject(allProjects, session.getProjectId()),
                    findUser(officials, session.getOfficialId())));
            if (rows.size() >= cap) {
                break;
            }
        }
        return rows;
    }

    @GetMapping("/sessions/{id}")
    @Transactional(readOnly = true)
    public Map<String, Object> byId(@PathVariable Integer id) {
        VcSession session = sessions.findById(id)
                .orElseThrow(() -> ApiException.notFound("Session not found"));
        List<User> officials = users.findByRoleOrderByIdAsc("official");
        List<Project> allProjects = projects.findAll();

        List<Map<String, Object>> presence = new ArrayList<>();
        for (VcJoinLog log : joinLogs.findBySessionIdOrderByIdDesc(id)) {
            User joiner = findUser(officials, log.getUserId());
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", log.getId());
            row.put("session_id", log.getSessionId());
            row.put("user_id", log.getUserId());
            row.put("user_name", joiner == null ? null : joiner.getName());
            row.put("action", log.getAction());
            row.put("created_at", log.getCreatedAt());
            presence.add(row);
        }
        return Map.of("session",
                decorate(session, findProject(allProjects, session.getProjectId()), findUser(officials, session.getOfficialId())),
                "presence", presence);
    }

    @PostMapping("/sessions/{id}/end")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Transactional
    public VcSession end(@PathVariable Integer id, @AuthenticationPrincipal AuthPrincipal current) {
        VcSession session = sessions.findById(id)
                .orElseThrow(() -> ApiException.notFound("Session not found"));
        session.setStatus("ended");
        session.setEndedAt(Instant.now());
        VcSession saved = sessions.save(session);
        audit.record(current, "vc.session_ended", "vc_session", saved.getId(),
                Map.of("room", saved.getRoomId()));
        return saved;
    }

    @PostMapping("/sessions/{id}/join-log")
    @Transactional
    public ResponseEntity<VcJoinLog> logJoin(@PathVariable Integer id,
                                             @RequestBody(required = false) Requests.JoinLog body,
                                             @AuthenticationPrincipal AuthPrincipal current) {
        Integer userId = body != null && body.userId() != null ? body.userId() : current.id();
        String action = body != null && "leave".equals(body.action()) ? "leave" : "join";

        VcJoinLog log = new VcJoinLog();
        log.setSessionId(id);
        log.setUserId(userId);
        log.setAction(action);
        log.setCreatedAt(Instant.now());
        return ResponseEntity.status(201).body(joinLogs.save(log));
    }

    /* ---------------------------------------------------------------- helpers */

    private String hex(int bytes) {
        byte[] buffer = new byte[bytes];
        random.nextBytes(buffer);
        StringBuilder out = new StringBuilder();
        for (byte b : buffer) {
            out.append(String.format("%02X", b));
        }
        return out.toString();
    }

    private static Project findProject(List<Project> rows, Integer id) {
        if (id == null) {
            return null;
        }
        return rows.stream().filter(p -> id.equals(p.getId())).findFirst().orElse(null);
    }

    private static User findUser(List<User> rows, Integer id) {
        if (id == null) {
            return null;
        }
        return rows.stream().filter(u -> id.equals(u.getId())).findFirst().orElse(null);
    }

    private static Map<String, Object> decorate(VcSession session, Project project, User official) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", session.getId());
        row.put("room_id", session.getRoomId());
        row.put("project_id", session.getProjectId());
        row.put("official_id", session.getOfficialId());
        row.put("mode", session.getMode());
        row.put("status", session.getStatus());
        row.put("scheduled_at", session.getScheduledAt());
        row.put("started_at", session.getStartedAt());
        row.put("ended_at", session.getEndedAt());
        row.put("join_url", session.getJoinUrl());
        row.put("created_at", session.getCreatedAt());
        row.put("project_name", project == null ? null : project.getName());
        row.put("project_location", project == null ? null : project.getLocation());
        row.put("official_name", official == null ? null : official.getName());
        row.put("live", "live".equals(session.getStatus()));
        return row;
    }
}
