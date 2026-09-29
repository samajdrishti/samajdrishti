package in.gov.samajdrishti.seed;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.config.AppProperties;
import in.gov.samajdrishti.domain.Anomaly;
import in.gov.samajdrishti.domain.Attendance;
import in.gov.samajdrishti.domain.AttendanceRecord;
import in.gov.samajdrishti.domain.Atr;
import in.gov.samajdrishti.domain.AuditEntry;
import in.gov.samajdrishti.domain.BeneficiaryFeedback;
import in.gov.samajdrishti.domain.Camera;
import in.gov.samajdrishti.domain.ChecklistItem;
import in.gov.samajdrishti.domain.Evidence;
import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.InspectionAssignment;
import in.gov.samajdrishti.domain.InspectionReport;
import in.gov.samajdrishti.domain.Institution;
import in.gov.samajdrishti.domain.Notification;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.domain.VcJoinLog;
import in.gov.samajdrishti.domain.VcSession;
import in.gov.samajdrishti.repository.AnomalyRepository;
import in.gov.samajdrishti.repository.AttendanceRecordRepository;
import in.gov.samajdrishti.repository.AttendanceRepository;
import in.gov.samajdrishti.repository.AtrRepository;
import in.gov.samajdrishti.repository.AuditRepository;
import in.gov.samajdrishti.repository.BeneficiaryFeedbackRepository;
import in.gov.samajdrishti.repository.CameraRepository;
import in.gov.samajdrishti.repository.ChecklistItemRepository;
import in.gov.samajdrishti.repository.EvidenceRepository;
import in.gov.samajdrishti.repository.InspectionAssignmentRepository;
import in.gov.samajdrishti.repository.InspectionReportRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.InstitutionRepository;
import in.gov.samajdrishti.repository.NotificationRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.service.InspectionAttendanceService;
import in.gov.samajdrishti.repository.UserRepository;
import in.gov.samajdrishti.repository.VcJoinLogRepository;
import in.gov.samajdrishti.repository.VcSessionRepository;

/**
 * Deterministic demo dataset, so the dashboards, the field app and the AI engine all
 * have meaningful content on first boot.
 *
 * <p>Runs once, before the web server accepts traffic, and only when the store is empty -
 * so restarting against PostgreSQL never duplicates rows. Passwords are BCrypt hashed
 * here rather than seeded as literals, which is what the old in-memory driver did too.
 */
@Component
@Order(0)
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    private static final ZoneId ZONE = ZoneId.systemDefault();

    private final AppProperties properties;
    private final PasswordEncoder passwordEncoder;

    private final UserRepository users;
    private final ProjectRepository projects;
    private final InspectionRepository inspections;
    private final EvidenceRepository evidence;
    private final CameraRepository cameras;
    private final AttendanceRepository attendance;
    private final NotificationRepository notifications;
    private final VcSessionRepository vcSessions;
    private final VcJoinLogRepository vcJoinLogs;
    private final AuditRepository audit;
    private final AtrRepository atrs;
    private final BeneficiaryFeedbackRepository feedback;
    private final InstitutionRepository institutions;
    private final InspectionAssignmentRepository assignments;
    private final AttendanceRecordRepository attendanceRecords;
    private final ChecklistItemRepository checklistItems;
    private final AnomalyRepository anomalies;
    private final InspectionReportRepository reports;

    public DemoDataSeeder(AppProperties properties,
                          PasswordEncoder passwordEncoder,
                          UserRepository users,
                          ProjectRepository projects,
                          InspectionRepository inspections,
                          EvidenceRepository evidence,
                          CameraRepository cameras,
                          AttendanceRepository attendance,
                          NotificationRepository notifications,
                          VcSessionRepository vcSessions,
                          VcJoinLogRepository vcJoinLogs,
                          AuditRepository audit,
                           AtrRepository atrs,
                           BeneficiaryFeedbackRepository feedback,
                           InstitutionRepository institutions,
                           InspectionAssignmentRepository assignments,
                           AttendanceRecordRepository attendanceRecords,
                           ChecklistItemRepository checklistItems,
                           AnomalyRepository anomalies,
                           InspectionReportRepository reports) {
        this.properties = properties;
        this.passwordEncoder = passwordEncoder;
        this.users = users;
        this.projects = projects;
        this.inspections = inspections;
        this.evidence = evidence;
        this.cameras = cameras;
        this.attendance = attendance;
        this.notifications = notifications;
        this.vcSessions = vcSessions;
        this.vcJoinLogs = vcJoinLogs;
        this.audit = audit;
        this.atrs = atrs;
        this.feedback = feedback;
        this.institutions = institutions;
        this.assignments = assignments;
        this.attendanceRecords = attendanceRecords;
        this.checklistItems = checklistItems;
        this.anomalies = anomalies;
        this.reports = reports;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.seedEnabled()) {
            log.info("[seed] demo seeding disabled (DB_MODE={})", properties.dataMode());
            return;
        }
        if (users.count() > 0) {
            log.info("[seed] store already populated, skipping demo seed");
            return;
        }
        seed();
        log.info("[seed] demo data loaded: {} projects, {} institutions, {} inspections, "
                        + "{} evidence records, {} anomalies, {} ATRs, {} users.",
                projects.count(), institutions.count(), inspections.count(),
                evidence.count(), anomalies.count(), atrs.count(), users.count());
        log.info("[seed] demo logins -> admin@samajdrishti.gov.in / Admin@123");
    }

    private void seed() {
        seedUsers();
        seedInstitutions();
        seedOperations();
        seedMonitoring();
    }

    /* ------------------------------------------------------------------ users */

    /**
     * Institution types and geofence radii for the seeded sites.
     *
     * <p>The radii are deliberately varied: a 50-bed home in a dense area and a campus spread
     * over several acres need different fences, and seeding them differently is what makes the
     * per-site radius visible in a demo rather than an abstract column.
     */
    private record DemoInstitution(String type, Double geofenceRadius, Integer sanctionedCapacity, String incharge) {
    }

    private static final Map<String, DemoInstitution> INSTITUTION_PROFILES = Map.of(
            "AVYAY", new DemoInstitution("home", 250d, 50, "S. Ramasamy"),
            "NAPDDR", new DemoInstitution("rehab_centre", 600d, 45, "P. Anitha"),
            "SIPDA", new DemoInstitution("special_school", 400d, 60, "K. Venkatesan"));

    private record DemoUser(String name, String email, String role, String department, String phone) {
    }

    /** Gives every official a district so the §16 eligibility filter has something to work on. */
    private void seedInstitutions() {
        for (Project project : projects.findAll()) {
            String scheme = project.getDepartment() == null
                    ? "AVYAY" : project.getDepartment().toUpperCase();
            DemoInstitution profile = INSTITUTION_PROFILES.getOrDefault(scheme,
                    new DemoInstitution("home", 250d, 50, "Institution In-charge"));

            Institution institution = new Institution();
            institution.setProjectId(project.getId());
            institution.setName(institutionNameOf(project));
            institution.setType(profile.type());
            institution.setScheme(scheme.toLowerCase());
            institution.setAddress(project.getLocation());
            institution.setDistrict("Coimbatore");
            institution.setState("Tamil Nadu");
            institution.setGeoCoords(project.getGeoCoords());
            institution.setGeofenceRadius(profile.geofenceRadius());
            // The blacklisted case study is flagged so the dashboard has a live example.
            institution.setStatus("flagged".equals(project.getStatus()) ? "flagged" : "active");
            institution.setSanctionedCapacity(capacityOf(project, profile.sanctionedCapacity()));
            institution.setInchargeName(profile.incharge());
            institution.setInchargePhone("+91 94422 " + (10000 + project.getId() * 7));
            institution.setCreatedAt(project.getCreatedAt());
            institutions.save(institution);
        }

        for (User user : users.findByRoleOrderByIdAsc("official")) {
            // Only field officers carry a district; the other roles are not assignment candidates.
            if (user.getDistrict() == null) {
                user.setDistrict("Coimbatore");
                user.setState("Tamil Nadu");
                user.setUpdatedAt(Instant.now());
                users.save(user);
            }
        }
    }

    private static String institutionNameOf(Project project) {
        String name = project.getName();
        int paren = name.indexOf(" (");
        return paren > 0 ? name.substring(0, paren) : name;
    }

    /**
     * The sanctioned capacity recorded in a project's metadata, if it declared one.
     *
     * <p>Read defensively: metadata is free-form JSON that an older seed row may not have, and
     * a missing key should fall back to the scheme's default rather than fail the boot.
     */
    @SuppressWarnings("unchecked")
    private static Integer capacityOf(Project project, Integer fallback) {
        Object metadata = project.getMetadata();
        if (!(metadata instanceof Map<?, ?> map)) {
            return fallback;
        }
        Object sanctioned = ((Map<String, Object>) map).get("sanctioned_capacity");
        return sanctioned instanceof Number number ? number.intValue() : fallback;
    }

    private static final List<DemoUser> DEMO_USERS = List.of(
            new DemoUser("Dr. S. Meenakshi", "admin@samajdrishti.gov.in", "admin",
                    "State PMU Cell, DoSJE - Coimbatore", "+91 94422 11223"),
            new DemoUser("R. Karthikeyan", "supervisor@samajdrishti.gov.in", "supervisor",
                    "Coimbatore District Social Welfare Office", "+91 94422 44556"),
            new DemoUser("M. Arun Kumar", "official1@samajdrishti.gov.in", "official",
                    "District PMU Field Inspection Wing, CBE", "+91 94422 77881"),
            new DemoUser("B. Divya", "official2@samajdrishti.gov.in", "official",
                    "Social Welfare Audit Unit, Coimbatore", "+91 94422 77882"),
            new DemoUser("S. Karthik", "official3@samajdrishti.gov.in", "official",
                    "NAPDDR Rehab Monitoring Cell, CBE", "+91 94422 77883"),
            new DemoUser("M. Sunitha", "official4@samajdrishti.gov.in", "official",
                    "SIPDA PwD Empowerment Division, CBE", "+91 94422 77884"),
            new DemoUser("Anugraha Senior Home Admin", "ngo@anugrahaseniors.org", "ngo",
                    "Anugraha Senior Home, Kuniyamuthur, Coimbatore", "+91 94422 33445"),
            new DemoUser("S. Ramasamy", "beneficiary@samajdrishti.gov.in", "beneficiary",
                    "Resident Beneficiary (Coimbatore)", "+91 94422 99887"));

    private static final Map<String, String> DEMO_PASSWORDS = Map.of(
            "admin", "Admin@123",
            "supervisor", "Super@123",
            "official", "Official@123",
            "ngo", "Ngo@123",
            "beneficiary", "Beneficiary@123");

    private record DemoProject(String name,
                               String description,
                               String location,
                               String department,
                               BigDecimal budget,
                               String status,
                               GeoPoint coords,
                               Map<String, Object> metadata) {
    }

    private static List<DemoProject> demoProjects() {
        Map<String, Object> anugrahaMetadata = new LinkedHashMap<>();
        anugrahaMetadata.put("scheme", "AVYAY");
        anugrahaMetadata.put("sanction_code", "DoSJE/AVYAY/TN/2020-095");
        anugrahaMetadata.put("sanctioned_capacity", 50);
        anugrahaMetadata.put("verified_headcount", 14);
        anugrahaMetadata.put("aebas_punch_count", 47);
        anugrahaMetadata.put("discrepancy_delta", 33);
        anugrahaMetadata.put("case_timeline", List.of(
                Map.of("date", "2020-08-13",
                        "event", "PMU Inspection: Major infrastructure & attendance deficiencies flagged."),
                Map.of("date", "2020-10-15", "event", "GIA Grant instalment cancelled by DoSJE order."),
                Map.of("date", "2022-12-21", "event", "Conditional revival following NGO compliance affidavit."),
                Map.of("date", "2023-11-17",
                        "event", "Fraudulent surprise inspection attempt detected: geo-spoofing alert raised."),
                Map.of("date", "2024-07-18",
                        "event", "DoSJE Formal Order: Anugraha Senior Home permanently blacklisted.")));

        return List.of(
                new DemoProject(
                        "Anugraha Senior Citizens Home (AVYAY)",
                        "50-Bed Senior Citizen Home funded under AVYAY scheme. Critical audit focus due to historical "
                                + "proxy attendance and unverified headcount records. Case Study: Deficiencies flagged 2020 "
                                + "-> Grant cancelled -> Revived 2022 -> Fraudulent surprise inspection detected Nov 2023 "
                                + "-> Blacklisted.",
                        "Kuniyamuthur, Coimbatore, Tamil Nadu", "AVYAY", new BigDecimal("4200000"), "flagged",
                        new GeoPoint(11.0056, 76.9283), anugrahaMetadata),
                new DemoProject(
                        "Sanjivani Geriatric Sanctuary (AVYAY)",
                        "100-Capacity Geriatric Assisted Living Center providing nutrition, healthcare, physiotherapy "
                                + "and shelter under Atal Vayo Abhyuday Yojana.",
                        "Peelamedu, Coimbatore, Tamil Nadu", "AVYAY", new BigDecimal("6800000"), "active",
                        new GeoPoint(11.0276, 77.0284),
                        schemeMeta("AVYAY", "DoSJE/AVYAY/TN/2023-112", 100, 94, 96, 2)),
                new DemoProject(
                        "Sugam Drug De-Addiction & Rehab Center (NAPDDR)",
                        "30-Bed Inpatient De-addiction & Psychosocial Rehabilitation Facility under the National "
                                + "Action Plan for Drug Demand Reduction.",
                        "Singanallur, Coimbatore, Tamil Nadu", "NAPDDR", new BigDecimal("5400000"), "active",
                        new GeoPoint(10.9969, 77.0336),
                        schemeMeta("NAPDDR", "DoSJE/NAPDDR/TN/2022-041", 30, 27, 28, 1)),
                new DemoProject(
                        "Kavignar Nasha Mukti Kendra (NAPDDR)",
                        "45-Capacity Integrated Rehabilitation Center for Addicts (IRCA) providing medical detox, "
                                + "cognitive therapy and aftercare.",
                        "Kinathukadavu, Coimbatore, Tamil Nadu", "NAPDDR", new BigDecimal("4600000"), "active",
                        new GeoPoint(10.9817, 76.9333),
                        schemeMeta("NAPDDR", "DoSJE/NAPDDR/TN/2023-088", 45, 41, 42, 1)),
                new DemoProject(
                        "Kural Vazhi Divyangjan Skill & Empowerment Center (SIPDA)",
                        "Vocational Training and Assistive Technology Center for Persons with Disabilities under "
                                + "SIPDA scheme, offering barrier-free labs and certified trades.",
                        "Vellakinar, Coimbatore, Tamil Nadu", "SIPDA", new BigDecimal("7200000"), "active",
                        new GeoPoint(11.0219, 77.0039),
                        schemeMeta("SIPDA", "DoSJE/SIPDA/TN/2021-019", 60, 58, 58, 0)),
                new DemoProject(
                        "Niramaya PwD Vocational & Assistive Training Hub (SIPDA)",
                        "Skill development institution specializing in assistive digital tools, speech synthesis "
                                + "workstations and mobility training.",
                        "Thudiyalur, Coimbatore, Tamil Nadu", "SIPDA", new BigDecimal("5900000"), "active",
                        new GeoPoint(11.0722, 77.0339),
                        schemeMeta("SIPDA", "DoSJE/SIPDA/TN/2022-073", 50, 46, 48, 2)),
                new DemoProject(
                        "Nivetha Community De-Addiction & Counseling Sanctuary (NAPDDR)",
                        "Community-based substance use treatment facility offering outpatient opioid substitution "
                                + "therapy and relapse prevention counseling.",
                        "Udumalaipettai, Coimbatore, Tamil Nadu", "NAPDDR", new BigDecimal("5100000"), "active",
                        new GeoPoint(10.9500, 77.0500),
                        schemeMeta("NAPDDR", "DoSJE/NAPDDR/TN/2023-015", 35, 32, 34, 2)),
                new DemoProject(
                        "Thendral Senior Care & Day Living Center (AVYAY)",
                        "Community day living center and palliative elder care facility funded under the regional "
                                + "AVYAY elderly protection mandate.",
                        "R.S. Puram, Coimbatore, Tamil Nadu", "AVYAY", new BigDecimal("3900000"), "completed",
                        new GeoPoint(11.0060, 76.9500),
                        schemeMeta("AVYAY", "DoSJE/AVYAY/TN/2022-064", 40, 38, 38, 0)));
    }

    private static Map<String, Object> schemeMeta(String scheme, String sanctionCode, int sanctioned,
                                                  int verified, int aebas, int delta) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("scheme", scheme);
        meta.put("sanction_code", sanctionCode);
        meta.put("sanctioned_capacity", sanctioned);
        meta.put("verified_headcount", verified);
        meta.put("aebas_punch_count", aebas);
        meta.put("discrepancy_delta", delta);
        return meta;
    }

    private void seedUsers() {
        Map<String, String> hashes = new LinkedHashMap<>();
        DEMO_PASSWORDS.forEach((role, password) -> hashes.put(role, passwordEncoder.encode(password)));

        for (int i = 0; i < DEMO_USERS.size(); i++) {
            DemoUser spec = DEMO_USERS.get(i);
            User user = new User();
            user.setName(spec.name());
            user.setEmail(spec.email());
            user.setPassword(hashes.getOrDefault(spec.role(), hashes.get("official")));
            user.setRole(spec.role());
            user.setDepartment(spec.department());
            user.setPhone(spec.phone());
            user.setCreatedAt(Instant.now().minusSeconds((30L - i) * 86_400L));
            users.save(user);
        }

        List<DemoProject> specs = demoProjects();
        for (int i = 0; i < specs.size(); i++) {
            DemoProject spec = specs.get(i);
            Project project = new Project();
            project.setName(spec.name());
            project.setDescription(spec.description());
            project.setLocation(spec.location());
            project.setDepartment(spec.department());
            project.setGeoCoords(spec.coords());
            project.setStartDate(LocalDate.now(ZONE).minusDays(200L - i * 12L));
            project.setEndDate(LocalDate.now(ZONE).plusDays(120L + i * 10L));
            project.setBudget(spec.budget());
            project.setStatus(spec.status());
            project.setMetadata(spec.metadata());
            project.setCreatedAt(Instant.now().minusSeconds((40L - i) * 86_400L));
            projects.save(project);
        }
    }

    /* ------------------------------------------------------------- operations */

    private void seedOperations() {
        List<Integer> officialIds = users.findByRoleOrderByIdAsc("official").stream().map(User::getId).toList();
        Integer supervisorId = users.findByRoleOrderByIdAsc("supervisor").stream()
                .findFirst().map(User::getId).orElse(null);
        List<Project> projectList = projects.findAll();
        Lcg rand = new Lcg(20260601L);
        List<String> statuses = List.of("completed", "completed", "completed", "in_progress", "pending", "flagged");

        for (int pIdx = 0; pIdx < projectList.size(); pIdx++) {
            Project project = projectList.get(pIdx);
            int perProject = 2 + (pIdx % 3);
            for (int k = 0; k < perProject; k++) {
                String status = statuses.get(rand.nextInt(statuses.size()));
                if (pIdx == 0 && k == 0) {
                    status = "flagged";
                }
                boolean upcoming = "pending".equals(status) || "in_progress".equals(status);
                LocalDate scheduled = upcoming
                        ? LocalDate.now(ZONE).plusDays(1 + rand.nextInt(6))
                        : LocalDate.now(ZONE).minusDays(2 + rand.nextInt(28));
                boolean done = "completed".equals(status) || "flagged".equals(status);

                BigDecimal risk = pIdx == 0
                        ? new BigDecimal("88.50")
                        : new BigDecimal(String.format("%.2f", 18 + rand.next() * 65));
                String note = null;
                if (pIdx == 0) {
                    note = "CRITICAL DEFICIENCY: Surprise inspection detected only 14 elderly residents physically "
                            + "present against 47 marked in AEBAS attendance. Doctor visit logbook missing since 3 weeks.";
                } else if ("flagged".equals(status)) {
                    note = "Discrepancy observed between the reported beneficiary count and physical site headcount.";
                }

                int officerId = officialIds.get((pIdx + k) % officialIds.size());
                Institution institution = institutions.findFirstByProjectId(project.getId()).orElse(null);

                Inspection inspection = new Inspection();
                inspection.setProjectId(project.getId());
                inspection.setInstitutionId(institution == null ? null : institution.getId());
                inspection.setAssignedTo(officerId);
                inspection.setSupervisorId(supervisorId);
                inspection.setStatus(status);
                inspection.setInspectionCode("INS-%d".formatted(10000 + pIdx * 10L + k));
                inspection.setInspectionType(risk.doubleValue() > 70 ? "risk_targeted" : "routine");
                inspection.setScheduledDate(scheduled);
                inspection.setCompletedDate(done ? scheduled : null);
                inspection.setAiRiskScore(risk);
                inspection.setNotes(note);
                // A completed or flagged visit is assumed to have been on site; a suspicious geo
                // verdict is exactly what leaves gps_verified false, so that is how the seeded
                // "flagged" inspections got their state.
                if (done && !"flagged".equals(status)) {
                    inspection.setGpsVerified(true);
                    inspection.setGpsVerifiedAt(Instant.now().minusSeconds((pIdx * 2L + k + 1) * 86_400L));
                    inspection.setGpsVerdict("verified");
                } else if ("flagged".equals(status)) {
                    inspection.setGpsVerdict("suspicious");
                    inspection.setGpsDistanceMeters(41_300d);
                }
                if (done) {
                    inspection.setStartTime(Instant.now().minusSeconds((pIdx * 2L + k + 1) * 86_400L));
                    inspection.setEndTime(Instant.now().minusSeconds((pIdx * 2L + k) * 86_400L));
                    inspection.setSubmittedAt(inspection.getEndTime());
                }
                inspections.save(inspection);

                seedAssignment(inspection, officerId, project, done);
                if (done) {
                    seedInspectionDetail(inspection, project, institution, rand, k);
                }
            }
        }

        List<Inspection> finished = finishedInspections();
        seedEvidence(finished);
        seedFiledReports(finished);
        seedAtrs();
        seedFeedback();

        Integer adminId = users.findByRoleOrderByIdAsc("admin").stream()
                .findFirst().map(User::getId).orElse(null);
        seedNotifications(adminId, officialIds);
    }

    private List<Inspection> finishedInspections() {
        return inspections.findAll().stream()
                .filter(i -> "completed".equals(i.getStatus()) || "flagged".equals(i.getStatus()))
                .toList();
    }

    /**
     * The ledger row behind an inspection.
     *
     * <p>Status tracks the inspection rather than being invented, so the history reads
     * coherently: a completed visit was assigned, accepted, started and completed, in that
     * order, with the timestamps spaced accordingly.
     */
    private void seedAssignment(Inspection inspection, Integer officerId, Project project, boolean done) {
        InspectionAssignment assignment = new InspectionAssignment();
        assignment.setInspectionId(inspection.getId());
        assignment.setOfficerId(officerId);
        assignment.setProjectId(project.getId());
        assignment.setAssignmentType("random");
        assignment.setPriority(inspection.getAiRiskScore() != null
                && inspection.getAiRiskScore().doubleValue() > 70 ? "high" : "normal");
        assignment.setScheduledDate(inspection.getScheduledDate());
        assignment.setAiRiskScore(inspection.getAiRiskScore());
        assignment.setCreatedAt(Instant.now().minusSeconds(32L * 86_400L));
        assignment.setAssignedAt(Instant.now().minusSeconds(31L * 86_400L));
        assignment.setStatus("assigned");
        assignments.save(assignment);

        inspection.setAssignmentId(assignment.getId());
        inspections.save(inspection);

        if (done) {
            assignment.setStatus("completed");
            assignment.setAcceptedAt(Instant.now().minusSeconds(30L * 86_400L));
            assignment.setStartedAt(inspection.getStartTime());
            assignment.setCompletedAt(inspection.getEndTime());
            assignments.save(assignment);
        }
    }

    /**
     * Per-inspection evidence, beneficiary headcount, checklist and findings.
     *
     * <p>The Anugraha case study is seeded with the real anomaly it exists to demonstrate: 47
     * beneficiaries marked present, 14 counted on the ground. Every other site gets a
     * plausible headcount so the attendance feature is not uniformly alarming.
     */
    private void seedInspectionDetail(Inspection inspection, Project project, Institution institution,
                                       Lcg rand, int k) {
        boolean isCaseStudy = "flagged".equals(inspection.getStatus());
        int registered = institution == null || institution.getSanctionedCapacity() == null
                ? 50 : institution.getSanctionedCapacity();
        int reported = registered;
        int observed = isCaseStudy ? 14 : Math.max(1, registered - rand.nextInt(Math.max(2, registered / 12)));

        AttendanceRecord attendance = new AttendanceRecord();
        attendance.setInspectionId(inspection.getId());
        attendance.setProjectId(project.getId());
        attendance.setRecordedBy(inspection.getAssignedTo());
        attendance.setRegisteredCount(registered);
        attendance.setReportedCount(reported);
        attendance.setObservedCount(observed);
        attendance.setAttendancePercentage(InspectionAttendanceService.percentage(observed, registered));
        attendance.setNotes(isCaseStudy
                ? "AEBAS marked 47 present; the physical count was 14."
                : "Physical count reconciled against the register.");
        attendance.setCapturedAt(inspection.getEndTime());
        attendance.setCreatedAt(inspection.getCreatedAt());
        attendanceRecords.save(attendance);

        seedChecklistItems(inspection, isCaseStudy);
        seedAnomalies(inspection, observed, reported, registered, isCaseStudy);
    }

    /** Four of the six template items answered, which is enough to score a compliance figure. */
    private void seedChecklistItems(Inspection inspection, boolean isCaseStudy) {
        String[] codes = {"resident_headcount", "dietary_nutrition", "medical_log", "hygiene_bedding"};
        int idx = 0;
        for (String code : codes) {
            boolean passed = isCaseStudy ? idx >= 2 : idx != 1;
            ChecklistItem item = new ChecklistItem();
            item.setInspectionId(inspection.getId());
            item.setItemCode(code);
            item.setSection("av");
            item.setItem("Seeded item: " + code);
            item.setWeight(20);
            item.setStatus(passed ? "verified" : "failed");
            item.setRemarks(passed ? "Verified on site."
                    : "Observed deficiency during the visit; see the evidence for this inspection.");
            item.setVerifiedAt(inspection.getEndTime());
            item.setCreatedAt(inspection.getCreatedAt());
            checklistItems.save(item);
            idx++;
        }
    }

    private void seedAnomalies(Inspection inspection, int observed, int reported, int registered,
                               boolean isCaseStudy) {
        if (observed < reported) {
            int missing = reported - observed;
            double ratio = registered == 0 ? 1d : missing / (double) registered;
            anomalies.save(anomaly(inspection, "ATTENDANCE_MISMATCH",
                    "Institution reported %d present but the officer counted %d on site "
                            .formatted(reported, observed)
                            + "(%d of %d on the roll unaccounted for, %.1f%%)."
                                    .formatted(missing, registered, ratio * 100),
                    ratio, ratio > 0.15 ? "high" : "medium", "attendance_discrepancy", isCaseStudy));
        }

        if (isCaseStudy) {
            anomalies.save(anomaly(inspection, "INSPECTION_DEVIATION",
                    "Report filed 41.3 km from the registered site - possible proxy or fake reporting.",
                    0.92, "high", "haversine_geo", false));
            anomalies.save(anomaly(inspection, "CCTV_UNAVAILABLE",
                    "All 2 cameras at this institution were offline during the inspection.",
                    0.85, "high", "camera_heartbeat", true));
        }
    }

    private Anomaly anomaly(Inspection inspection, String type, String description, double confidence,
                            String severity, String detector, boolean reviewed) {
        Anomaly anomaly = new Anomaly();
        anomaly.setInspectionId(inspection.getId());
        anomaly.setProjectId(inspection.getProjectId());
        anomaly.setType(type);
        anomaly.setDescription(description);
        anomaly.setConfidence(BigDecimal.valueOf(confidence).setScale(3, RoundingMode.HALF_UP));
        anomaly.setSeverity(severity);
        anomaly.setStatus(reviewed ? "confirmed" : "open");
        anomaly.setSource("rule");
        anomaly.setDetector(detector);
        anomaly.setCreatedAt(inspection.getEndTime() == null ? Instant.now() : inspection.getEndTime());
        // High-severity findings are deliberately left unreviewed so the dashboard's review
        // queue is populated on first load rather than being empty on a fresh install.
        anomaly.setHumanVerified(reviewed);
        anomaly.setRequiresHumanReview(!reviewed);
        if (reviewed) {
            anomaly.setVerifiedBy(users.findByRoleOrderByIdAsc("supervisor").stream()
                    .findFirst().map(User::getId).orElse(null));
            anomaly.setVerifiedAt(anomaly.getCreatedAt().plusSeconds(3600));
            anomaly.setVerifiedRemarks("Reconciled against the AEBAS register by the district office.");
        }
        return anomaly;
    }

    /**
     * Filed reports for the finished inspections.
     *
     * <p>Seeded in every state a review can be in, so the supervisor's queue is not empty and
     * the audit trail of a report decision is visible without having to drive the workflow.
     */
    private void seedFiledReports(List<Inspection> finished) {
        String[] statuses = {"submitted", "submitted", "under_review", "approved", "rejected"};
        for (int idx = 0; idx < finished.size(); idx++) {
            Inspection inspection = finished.get(idx);
            List<Anomaly> findings = anomalies.findByInspectionIdOrderByIdDesc(inspection.getId());
            long evidenceCount = evidence.countByInspectionId(inspection.getId());
            String status = statuses[idx % statuses.length];

            InspectionReport report = new InspectionReport();
            report.setInspectionId(inspection.getId());
            report.setProjectId(inspection.getProjectId());
            report.setOfficerId(inspection.getAssignedTo());
            report.setSummary("Filed report for inspection %s. %d evidence item(s), %d finding(s), geo check %s."
                    .formatted(inspection.getInspectionCode(), evidenceCount, findings.size(),
                            inspection.getGpsVerdict() == null ? "not recorded" : inspection.getGpsVerdict()));
            report.setFindings(findings.isEmpty() ? "none"
                    : findings.stream().map(Anomaly::getType).distinct().toList().toString());
            report.setRiskLevel(findings.stream().anyMatch(a -> "high".equals(a.getSeverity()))
                    ? "high" : findings.isEmpty() ? "low" : "medium");
            report.setReportStatus(status);
            report.setSubmittedBy(inspection.getAssignedTo());
            report.setSubmittedAt(inspection.getSubmittedAt() == null
                    ? inspection.getCreatedAt() : inspection.getSubmittedAt());
            report.setGeoVerdict(inspection.getGpsVerdict());
            report.setDistanceMeters(inspection.getGpsDistanceMeters());
            report.setEvidenceCount((int) evidenceCount);
            report.setAnomalyCount(findings.size());
            report.setComplianceScore(60);
            report.setCreatedAt(report.getSubmittedAt());
            if (!"submitted".equals(status) && !"under_review".equals(status)) {
                report.setReviewedBy(users.findByRoleOrderByIdAsc("supervisor").stream()
                        .findFirst().map(User::getId).orElse(null));
                report.setReviewedAt(report.getSubmittedAt().plusSeconds(86_400L));
                report.setReviewRemarks("approved".equals(status)
                        ? "Findings accepted; corrective action tracked through the ATR."
                        : "Corrective evidence did not demonstrate the fix.");
            }
            reports.save(report);

            // Attach the report to the inspection where the state machine expects it.
            if ("approved".equals(status)) {
                inspection.setStatus("under_review");
                inspections.save(inspection);
            } else if ("rejected".equals(status)) {
                inspection.setStatus("action_in_progress");
                inspections.save(inspection);
            }
        }
    }

    /** Photo and video captures on the finished inspections. */
    private void seedEvidence(List<Inspection> finished) {
        for (int idx = 0; idx < Math.min(10, finished.size()); idx++) {
            Inspection inspection = finished.get(idx);
            GeoPoint base = projectById(inspection.getProjectId()).getGeoCoords();
            boolean video = idx % 3 == 2;
            Evidence record = new Evidence();
            record.setInspectionId(inspection.getId());
            record.setType(video ? "video" : "photo");
            record.setFilePath("/uploads/evidence/demo-%d.%s".formatted(inspection.getId(), video ? "mp4" : "jpg"));
            record.setUploadedBy(inspection.getAssignedTo());
            record.setFileName("demo-%d.%s".formatted(inspection.getId(), video ? "mp4" : "jpg"));
            record.setContentType(video ? "video/mp4" : "image/jpeg");
            record.setGeoCoords(new GeoPoint(base.getLat() + 0.0003, base.getLng() + 0.0003));
            record.setAccuracy(8.0);
            record.setTimestamp(Instant.now().minusSeconds((idx + 1L) * 86_400L));
            record.setVerified(!"flagged".equals(inspection.getStatus()));
            record.setSyncStatus("synced");
            // Distinct per row: a shared hash would read as a duplicate upload to the
            // evidence-integrity checks, which is the opposite of what the seed intends.
            record.setFileHash(sha256("demo-evidence-%d-%d".formatted(inspection.getId(), idx)));
            record.setClientId("seed-evidence-%d-%d".formatted(inspection.getId(), idx));
            record.setCreatedAt(Instant.now().minusSeconds((idx + 1L) * 86_400L));
            evidence.save(record);
        }
    }

    private void seedAtrs() {
        record AtrSpec(int projectId, String projectName, int inspectionId, String scheme,
                       String title, String details, String deadline, String status,
                       String ngoReply, String evidenceUrl, String adjudication,
                       String official, long createdDaysAgo, long updatedDaysAgo) {
        }
        List<AtrSpec> specs = List.of(
                new AtrSpec(1, "Anugraha Senior Citizens Home (AVYAY)", 1, "AVYAY",
                        "Severe Ghost Beneficiaries & Proxy Biometric Attendance (47 punched vs 14 present)",
                        "Surprise inspection on site revealed only 14 residents physically present against 47 marked "
                                + "in AEBAS biometric system. Doctor visit logbook missing for 21 days.",
                        "2024-07-25", "escalated",
                        "Doctor was called for urgent family duty. Several senior residents had gone to native "
                                + "village for local fair.",
                        "/uploads/evidence/atr-anugraha-reply.pdf",
                        "REJECTED - Forensic audit confirmed automated proxy punching cards used by warden. "
                                + "DoSJE issued formal Blacklist Notice Order #2024/DoSJE/119.",
                        "Dr. S. Meenakshi", 60, 30),
                new AtrSpec(3, "Sugam Drug De-Addiction & Rehab Center (NAPDDR)", 3, "NAPDDR",
                        "Controlled Sedative Medicine Stock Discrepancy & CCTV blindspot",
                        "Psychotropic medication register showed 12 tablets of clonazepam unaccounted for; female "
                                + "counseling corner CCTV tilted toward wall.",
                        "2026-10-10", "under_review",
                        "Dispensing log signed by Dr. Rajagopalan was pending entry into online register. CCTV bracket "
                                + "realigned and sealed with tamper-evident tape.",
                        "/uploads/evidence/atr-sugam-proof.jpg",
                        "PENDING_OFFICIAL_VERIFICATION - Inspector M. Arun Kumar scheduled for spot confirmation.",
                        "R. Karthikeyan", 5, 1),
                new AtrSpec(5, "Kural Vazhi Divyangjan Skill & Empowerment Center (SIPDA)", 5, "SIPDA",
                        "Tactile Paving Discontinuity & Ramp Gradient Adjustment",
                        "Wheelchair access ramp to 1st Floor lab slightly exceeded 1:12 slope ratio; tactile guide "
                                + "strips missing at library threshold.",
                        "2026-10-15", "approved_closed",
                        "Replaced ramp with CPWD-compliant aluminium modular ramp (1:14 slope) and installed yellow "
                                + "tactile paving dots throughout.",
                        "/uploads/evidence/atr-kuralvazhi-ramp.jpg",
                        "APPROVED_AND_CLOSED - Geo-tagged photos verified compliant with RPwD Act 2016 guidelines.",
                        "Dr. S. Meenakshi", 12, 2));

        for (AtrSpec spec : specs) {
            Atr atr = new Atr();
            atr.setProjectId(spec.projectId());
            atr.setProjectName(spec.projectName());
            atr.setInspectionId(spec.inspectionId());
            atr.setScheme(spec.scheme());
            atr.setDeficiencyTitle(spec.title());
            atr.setDeficiencyDetails(spec.details());
            atr.setDeadline(LocalDate.parse(spec.deadline()));
            atr.setStatus(spec.status());
            atr.setNgoReply(spec.ngoReply());
            atr.setCorrectiveEvidenceUrl(spec.evidenceUrl());
            atr.setPmuAdjudication(spec.adjudication());
            atr.setOfficialName(spec.official());
            atr.setCreatedAt(Instant.now().minusSeconds(spec.createdDaysAgo() * 86_400L));
            atr.setUpdatedAt(Instant.now().minusSeconds(spec.updatedDaysAgo() * 86_400L));
            atrs.save(atr);
        }
    }

    private void seedFeedback() {
        record FeedbackSpec(int projectId, String projectName, String beneficiary, String scheme,
                            String category, int rating, String comment, boolean voiceMemo, long daysAgo) {
        }
        List<FeedbackSpec> specs = List.of(
                new FeedbackSpec(2, "Sanjivani Geriatric Sanctuary (AVYAY)",
                        "K. Balasubramanian (Age 74)", "AVYAY", "Nutrition & Meals", 5,
                        "Warm khichdi, seasonal fruits, and clean drinking water provided twice daily. Doctor visits "
                                + "every Tuesday morning without fail.", true, 2),
                new FeedbackSpec(1, "Anugraha Senior Citizens Home (AVYAY)",
                        "S. Ramasamy (Age 69)", "AVYAY", "Resident Amenities & Living Conditions", 1,
                        "Most of the listed 50 residents are never here. The warden only brings people when "
                                + "government officers arrive. No doctor has visited for a month.", true, 40),
                new FeedbackSpec(5, "Kural Vazhi Divyangjan Skill Center (SIPDA)",
                        "M. Meena (PwD Trainee, Orthopedic)", "SIPDA", "Accessibility & Skill Equipment", 5,
                        "Screen reader software and specialized mouse equipment allowed me to complete the data entry "
                                + "certification. Ramp is now very smooth.", false, 3),
                new FeedbackSpec(3, "Sugam Rehab Center (NAPDDR)", "R. Palani (Inpatient)", "NAPDDR",
                        "Medical Care & Counseling", 4,
                        "Counseling sessions are held daily at 10 AM. Medicine schedule is strictly maintained by "
                                + "nursing staff.", true, 1));

        for (FeedbackSpec spec : specs) {
            BeneficiaryFeedback record = new BeneficiaryFeedback();
            record.setProjectId(spec.projectId());
            record.setProjectName(spec.projectName());
            record.setBeneficiaryName(spec.beneficiary());
            record.setScheme(spec.scheme());
            record.setCategory(spec.category());
            record.setRating(spec.rating());
            record.setComment(spec.comment());
            record.setSentiment(sentimentOf(spec.rating()));
            record.setVerifiedResident(true);
            record.setVoiceMemoRecorded(spec.voiceMemo());
            record.setCreatedAt(Instant.now().minusSeconds(spec.daysAgo() * 86_400L));
            feedback.save(record);
        }
    }

    private void seedNotifications(Integer adminId, List<Integer> officialIds) {
        record Notice(int userId, String message, String type) {
        }
        List<Notice> notices = new ArrayList<>();
        if (adminId != null) {
            notices.add(new Notice(adminId,
                    "Anugraha Senior Citizens Home (Kuniyamuthur) flagged: 84.5% CCTV obstruction & attendance "
                            + "discrepancy.", "alert"));
            notices.add(new Notice(adminId,
                    "AI Transparent Random Assigner generated balanced schedule with Zero-Conflict scoring.", "info"));
            notices.add(new Notice(adminId,
                    "Action Taken Report (ATR) received from Sugam Rehab Center awaiting adjudication.", "warning"));
        }
        if (officialIds.size() > 0) {
            notices.add(new Notice(officialIds.get(0),
                    "Assigned surprise inspection: Sanjivani Geriatric Sanctuary under AVYAY scheme.", "info"));
        }
        if (officialIds.size() > 1) {
            notices.add(new Notice(officialIds.get(1),
                    "Reminder: Verify NavIC dual-constellation lock when reporting at site.", "warning"));
        }

        for (int i = 0; i < notices.size(); i++) {
            Notice notice = notices.get(i);
            Notification notification = new Notification();
            notification.setUserId(notice.userId());
            notification.setMessage(notice.message());
            notification.setType(notice.type());
            notification.setRead(i > 3);
            notification.setCreatedAt(Instant.now().minusSeconds(i * 3600L));
            notifications.save(notification);
        }
    }

    /* ------------------------------------------------------------- monitoring */

    private void seedMonitoring() {
        List<Integer> officialIds = users.findByRoleOrderByIdAsc("official").stream().map(User::getId).toList();
        Lcg rand = new Lcg(776611L);

        record CameraSpec(String name, int projectId, String location, String streamType, String streamUrl,
                          String tamperFlag, double occlusion, Integer headcount, Integer punches, String note) {
        }
        List<CameraSpec> specs = List.of(
                new CameraSpec("Anugraha Main Hall CCTV", 1, "Main Resident Hall, Kuniyamuthur", "simulated", null,
                        "obstruction_detected", 84.5, 14, 47,
                        "AI Alert: 84.5% lens obstruction detected (cardboard/cloth placed over lens to conceal "
                                + "low occupancy)"),
                new CameraSpec("Anugraha Dormitory CCTV", 1, "Senior Dormitory A, Kuniyamuthur", "simulated", null,
                        "headcount_discrepancy", 0, 4, 25,
                        "AI Alert: Severe occupancy mismatch (4 physical vs 25 biometric punches logged)"),
                new CameraSpec("Sanjivani Medical Room CCTV", 2, "Doctor Examination Clinic, Peelamedu", "simulated", null,
                        "normal", 0, 6, 6, "Normal: Doctor on-duty verified by facial geometry"),
                new CameraSpec("Sugam Detox Ward CCTV", 3, "Inpatient Detox Room, Singanallur", "simulated", null,
                        "normal", 0, 26, 28, "Normal: 26 active patients under supervision"),
                new CameraSpec("Kural Vazhi Assistive Lab CCTV", 5, "Assistive Tech Lab 1, Vellakinar", "hls",
                        "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                        "normal", 0, 32, 32, "Normal: Trainer and trainees present with wheelchair accessibility"),
                new CameraSpec("Kavignar Entrance Gate CCTV", 4, "Front Gate & Biometric Kiosk, Kinathukadavu",
                        "simulated", null,
                        "offline", 100, 0, 0,
                        "Camera Offline: Power cable disconnected / Tamper suspected"));

        for (int i = 0; i < specs.size(); i++) {
            CameraSpec spec = specs.get(i);
            Project project = projects.findById(spec.projectId()).orElse(null);
            GeoPoint base = project == null ? new GeoPoint(11.0168, 76.9558) : project.getGeoCoords();

            Camera camera = new Camera();
            camera.setName(spec.name());
            camera.setProjectId(spec.projectId());
            camera.setLocation(spec.location());
            camera.setStreamType(spec.streamType());
            camera.setStreamUrl(spec.streamUrl());
            camera.setGeoCoords(new GeoPoint(base.getLat() + 0.0004, base.getLng() + 0.0004));
            camera.setStatus("offline".equals(spec.tamperFlag()) ? "offline" : "online");
            camera.setTamperFlag(spec.tamperFlag());
            camera.setOcclusionPct(spec.occlusion());
            camera.setDetectedHeadcount(spec.headcount());
            camera.setAebasPunchCount(spec.punches());
            camera.setAnomalyNote(spec.note());
            camera.setLastSeen(Instant.now().minusSeconds(
                    "offline".equals(spec.tamperFlag()) ? 3 * 3600L : i * 60L));
            camera.setCreatedAt(Instant.now().minusSeconds(20 * 86_400L));
            cameras.save(camera);
        }

        seedAttendance(officialIds, rand);
        seedVcSessions(officialIds);
        seedGeoCheckEvidence();
        seedAudit();
    }

    private void seedAttendance(List<Integer> officialIds, Lcg rand) {
        List<Project> projectList = projects.findAll();
        for (int oIdx = 0; oIdx < officialIds.size(); oIdx++) {
            for (int d = 13; d >= 0; d--) {
                ZonedDateTime day = ZonedDateTime.now(ZONE).minusDays(d);
                if (day.getDayOfWeek().getValue() == 7 && oIdx != 2) {
                    continue; // most officials take Sunday off
                }
                Project project = projectList.get((oIdx + d) % projectList.size());
                GeoPoint coords = project.getGeoCoords();

                // Official #4 is habitually late; official #3 occasionally checks in far away.
                int lateMinutes = oIdx == 3 ? 35 + rand.nextInt(40) : rand.nextInt(22);
                // 9:00 plus the delay, so a 70 minute delay rolls into 10:10 as it would
                // with the previous `setHours(9, lateMinutes, ...)` seeder.
                ZonedDateTime checkIn = day.withHour(9).withMinute(0).withSecond(0).withNano(0)
                        .plusMinutes(lateMinutes);
                ZonedDateTime checkOut = day.withHour(17).withMinute(0).withSecond(0).withNano(0)
                        .plusMinutes(rand.nextInt(50));

                boolean missingPunch = (oIdx == 1 && d == 5) || (oIdx == 0 && d == 3);
                // ~9 km away twice, which is what surfaces as a geo mismatch.
                double geoOffset = oIdx == 2 && d % 6 == 0 ? 0.09 : 0.0006;

                Attendance record = new Attendance();
                record.setOfficialId(officialIds.get(oIdx));
                record.setProjectId(project.getId());
                record.setCheckIn(missingPunch ? null : checkIn.toInstant());
                record.setCheckOut(missingPunch ? null : checkOut.toInstant());
                record.setGeoCoords(new GeoPoint(coords.getLat() + geoOffset, coords.getLng() + geoOffset));
                record.setDevice("Android/" + (oIdx + 10));
                record.setMode("gps");
                record.setDate(day.toLocalDate());
                record.setCreatedAt(checkIn.toInstant());
                attendance.save(record);
            }
        }
    }

    private void seedVcSessions(List<Integer> officialIds) {
        String baseUrl = properties.vc().baseUrl();
        record Room(String name, int projectId, int officialIndex, String status, int daysAgo) {
        }
        List<Room> rooms = List.of(
                new Room("Review Board Samaj Drishti", 1, 0, "ended", 2),
                new Room("Beneficiary Grievance Review", 4, 3, "ended", 1),
                new Room("Live Site Verification Peelamedu", 5, 2, "scheduled", 0));

        for (int i = 0; i < rooms.size(); i++) {
            Room room = rooms.get(i);
            if (room.officialIndex() >= officialIds.size()) {
                continue;
            }
            String roomId = room.name().replaceAll("[^a-zA-Z0-9]", "") + "-" + (1001 + i);
            Instant scheduledAt = Instant.now().minusSeconds(room.daysAgo() * 86_400L);

            VcSession session = new VcSession();
            session.setRoomId(roomId);
            session.setProjectId(room.projectId());
            session.setOfficialId(officialIds.get(room.officialIndex()));
            session.setMode("random");
            session.setStatus(room.status());
            session.setScheduledAt(scheduledAt);
            session.setStartedAt("ended".equals(room.status()) ? scheduledAt.plusSeconds(300) : null);
            session.setEndedAt("ended".equals(room.status()) ? scheduledAt.plusSeconds(2700) : null);
            session.setJoinUrl(baseUrl + "/" + roomId);
            session.setCreatedAt(scheduledAt.minusSeconds(600));
            VcSession saved = vcSessions.save(session);

            VcJoinLog log = new VcJoinLog();
            log.setSessionId(saved.getId());
            log.setUserId(saved.getOfficialId());
            log.setAction("join");
            log.setCreatedAt(scheduledAt.plusSeconds(320));
            vcJoinLogs.save(log);
        }
    }

    /**
     * Deliberately mismatched geo-tags: these are what surface as
     * "possible proxy reporting" in the reports screen and the alert feed.
     */
    private void seedGeoCheckEvidence() {
        List<Inspection> completed = inspections.findAll().stream()
                .filter(i -> "completed".equals(i.getStatus()))
                .toList();
        double[] offsets = {0.6, 0.01, 0.0005, 0.35};
        for (int i = 8; i < Math.min(12, completed.size()); i++) {
            Inspection inspection = completed.get(i);
            GeoPoint base = projectById(inspection.getProjectId()).getGeoCoords();
            double offset = offsets[i % offsets.length];

            Evidence record = new Evidence();
            record.setInspectionId(inspection.getId());
            record.setType("photo");
            record.setFilePath("/uploads/evidence/geo-check-%d.jpg".formatted(inspection.getId()));
            record.setGeoCoords(new GeoPoint(base.getLat() + offset, base.getLng() + offset));
            record.setTimestamp(Instant.now().minusSeconds((i - 7L) * 5_400L));
            record.setVerified(offset < 0.001);
            record.setCreatedAt(Instant.now().minusSeconds((i - 7L) * 5_400L));
            evidence.save(record);
        }
    }

    private void seedAudit() {
        User admin = users.findByRoleOrderByIdAsc("admin").stream().findFirst().orElse(null);
        if (admin == null) {
            return;
        }
        List<Integer> officialIds = users.findByRoleOrderByIdAsc("official").stream().map(User::getId).toList();
        Integer firstOfficial = officialIds.isEmpty() ? null : officialIds.get(0);
        String firstOfficialName = firstOfficial == null
                ? "Field Official"
                : users.findById(firstOfficial).map(User::getName).orElse("Field Official");

        record AuditSpec(Integer actorId, String actorName, String action, String entity, Integer entityId,
                         Map<String, Object> meta) {
        }
        List<AuditSpec> specs = List.of(
                new AuditSpec(admin.getId(), admin.getName(), "inspection.assigned", "inspection", 1,
                        Map.of("note", "Initial random allocation")),
                new AuditSpec(admin.getId(), admin.getName(), "project.created", "project", 1,
                        Map.of("note", "Anugraha Senior Citizens Home - Kuniyamuthur Block")),
                new AuditSpec(firstOfficial, firstOfficialName, "inspection.status_changed", "inspection", 1,
                        Map.of("from", "pending", "to", "completed")),
                new AuditSpec(firstOfficial, firstOfficialName, "evidence.uploaded", "evidence", 1,
                        Map.of("type", "photo", "verified", true)),
                new AuditSpec(admin.getId(), admin.getName(), "vc.session_ended", "vc_session", 1,
                        Map.of("room", "ReviewBoardSamajDrishti-1001")));

        for (int i = 0; i < specs.size(); i++) {
            AuditSpec spec = specs.get(i);
            AuditEntry entry = new AuditEntry();
            entry.setActorId(spec.actorId());
            entry.setActorName(spec.actorName());
            entry.setAction(spec.action());
            entry.setEntity(spec.entity());
            entry.setEntityId(spec.entityId());
            entry.setMeta(spec.meta());
            entry.setCreatedAt(Instant.now().minusSeconds((i + 1L) * 3600L));
            audit.save(entry);
        }
    }

    /* ---------------------------------------------------------------- helpers */

    private static String sentimentOf(int rating) {
        if (rating >= 4) {
            return "positive";
        }
        return rating <= 2 ? "critical" : "neutral";
    }

    private Project projectById(Integer id) {
        return projects.findById(id).orElseThrow(
                () -> new IllegalStateException("Demo project " + id + " is missing"));
    }

    /**
     * A stable stand-in for a real file hash on seeded evidence.
     *
     * <p>Not a hash of any file, because there is no file: the seeded rows point at
     * {@code /uploads/evidence/demo-N.jpg}, which does not exist on disk. What matters is that
     * each value is distinct and the right length, so the duplicate-evidence check sees a
     * normal set of unique uploads rather than N copies of one hash.
     */
    private static String sha256(String seed) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(seed.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is required by the JLS but unavailable", e);
        }
    }

    /** Same linear congruential generator the previous seeder used, so the demo looks identical. */
    private static final class Lcg {
        private long state;

        Lcg(long seed) {
            this.state = seed;
        }

        double next() {
            state = (state * 1103515245L + 12345L) % 2147483648L;
            return (double) state / 2147483648d;
        }

        int nextInt(int bound) {
            return (int) (next() * bound);
        }
    }
}
