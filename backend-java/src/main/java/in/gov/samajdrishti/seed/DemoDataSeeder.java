package in.gov.samajdrishti.seed;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
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
import in.gov.samajdrishti.domain.Attendance;
import in.gov.samajdrishti.domain.Atr;
import in.gov.samajdrishti.domain.AuditEntry;
import in.gov.samajdrishti.domain.BeneficiaryFeedback;
import in.gov.samajdrishti.domain.Camera;
import in.gov.samajdrishti.domain.Evidence;
import in.gov.samajdrishti.domain.GeoPoint;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.Notification;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.domain.User;
import in.gov.samajdrishti.domain.VcJoinLog;
import in.gov.samajdrishti.domain.VcSession;
import in.gov.samajdrishti.repository.AttendanceRepository;
import in.gov.samajdrishti.repository.AtrRepository;
import in.gov.samajdrishti.repository.AuditRepository;
import in.gov.samajdrishti.repository.BeneficiaryFeedbackRepository;
import in.gov.samajdrishti.repository.CameraRepository;
import in.gov.samajdrishti.repository.EvidenceRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.NotificationRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
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
                          BeneficiaryFeedbackRepository feedback) {
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
        log.info("[seed] demo data loaded: {} projects, {} inspections, {} evidence records, {} users.",
                projects.count(), inspections.count(), evidence.count(), users.count());
        log.info("[seed] demo logins -> admin@samajdrishti.gov.in / Admin@123");
    }

    private void seed() {
        seedUsers();
        seedOperations();
        seedMonitoring();
    }

    /* ------------------------------------------------------------------ users */

    private record DemoUser(String name, String email, String role, String department, String phone) {
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

                Inspection inspection = new Inspection();
                inspection.setProjectId(project.getId());
                inspection.setAssignedTo(officialIds.get((pIdx + k) % officialIds.size()));
                inspection.setSupervisorId(supervisorId);
                inspection.setStatus(status);
                inspection.setScheduledDate(scheduled);
                inspection.setCompletedDate(done ? scheduled : null);
                inspection.setAiRiskScore(risk);
                inspection.setNotes(note);
                inspection.setCreatedAt(Instant.now().minusSeconds((25L - (pIdx * 2L + k)) * 86_400L));
                inspections.save(inspection);
            }
        }

        List<Inspection> finished = inspections.findAll().stream()
                .filter(i -> "completed".equals(i.getStatus()) || "flagged".equals(i.getStatus()))
                .toList();
        for (int idx = 0; idx < Math.min(10, finished.size()); idx++) {
            Inspection inspection = finished.get(idx);
            GeoPoint base = projectById(inspection.getProjectId()).getGeoCoords();
            boolean video = idx % 3 == 2;
            Evidence record = new Evidence();
            record.setInspectionId(inspection.getId());
            record.setType(video ? "video" : "photo");
            record.setFilePath("/uploads/evidence/demo-%d.%s".formatted(inspection.getId(), video ? "mp4" : "jpg"));
            record.setGeoCoords(new GeoPoint(base.getLat() + 0.0003, base.getLng() + 0.0003));
            record.setTimestamp(Instant.now().minusSeconds((idx + 1L) * 86_400L));
            record.setVerified(!"flagged".equals(inspection.getStatus()));
            record.setCreatedAt(Instant.now().minusSeconds((idx + 1L) * 86_400L));
            evidence.save(record);
        }

        seedAtrs();
        seedFeedback();

        Integer adminId = users.findByRoleOrderByIdAsc("admin").stream()
                .findFirst().map(User::getId).orElse(null);
        seedNotifications(adminId, officialIds);
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
