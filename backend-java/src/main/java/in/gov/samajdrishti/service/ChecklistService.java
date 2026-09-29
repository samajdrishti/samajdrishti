package in.gov.samajdrishti.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import in.gov.samajdrishti.domain.ChecklistItem;
import in.gov.samajdrishti.domain.Inspection;
import in.gov.samajdrishti.domain.InspectionChecklist;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.repository.ChecklistItemRepository;
import in.gov.samajdrishti.repository.InspectionChecklistRepository;
import in.gov.samajdrishti.repository.InspectionRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.web.ApiException;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * The per-item checklist of LLD §8.
 *
 * <p>The previous model kept one row per inspection holding a {@code {itemId: boolean}} JSON
 * blob. That cannot record why an item failed, which is the only part of a checklist a
 * supervisor reads, and it cannot carry per-item evidence or a verification timestamp.
 * This service writes one {@link ChecklistItem} row per item while keeping the old aggregate
 * row in step, so both the existing dashboards and the LLD's shape are served from one save.
 *
 * <p>Per-item writes are idempotent on {@code clientId} and on the (inspection, item)
 * unique index, because the offline queue replays submissions until acked.
 */
@Service
public class ChecklistService {

    /** Items a template defines, with the weight each contributes to the compliance score. */
    public record TemplateItem(String section, String code, String title, int weight) {
    }

    private static final List<String> ITEM_STATUSES =
            List.of("pending", "verified", "failed", "not_applicable");

    /**
     * Scheme-specific regulatory checklists, per DoSJE inspection guidelines.
     *
     * <p>Unchanged from the previous controller-level map, which is the point: moving the
     * templates into the service must not alter the questions an officer is asked.
     */
    private static final Map<String, List<TemplateItem>> SCHEME_CHECKLISTS = Map.of(
            "avyay", List.of(
                    item("infrastructure", "resident_headcount",
                            "Resident Headcount Match: Physical count matches approved quota", 25),
                    item("nutrition", "dietary_nutrition",
                            "Nutrition Standard: Clean kitchen, weekly approved menu displayed", 15),
                    item("medical", "medical_log",
                            "Medical Attendance: Registered doctor visit verified in logbook", 20),
                    item("living_quarters", "hygiene_bedding",
                            "Living Quarters: Sanitized rooms, clean bedding, hot water", 15),
                    item("medicines", "emergency_medicines",
                            "Medicine Stock: First aid kit & essential chronic illness drugs stocked", 15),
                    item("wellbeing", "recreational_counseling",
                            "Recreation & Well-being: TV room, reading materials, counseling logs", 10)),
            "napddr", List.of(
                    item("medical_staff", "doctor_duty",
                            "Medical Staff: MBBS Doctor / Psychiatrist verified on active duty", 25),
                    item("security", "detox_ward_safety",
                            "Detox Ward Security: 24/7 nursing and secure patient observation", 20),
                    item("medication", "medicine_register",
                            "Schedule-H Register: Controlled medication entries reconciled without gap", 20),
                    item("counselling", "psychosocial_counseling",
                            "Counseling Protocols: Individual and group therapy session records", 15),
                    item("follow_up", "relapse_tracking",
                            "Post-Discharge Registry: Relapse follow-up documented for alumni", 10),
                    item("hygiene", "nutrition_hygiene",
                            "Sanitation & Diet: Clean kitchen, balanced food, hygienic washrooms", 10)),
            "sipda", List.of(
                    item("accessibility", "barrier_free_ramp",
                            "Accessibility Ramps: CPWD standard 1:12 gradient with dual handrails", 25),
                    item("accessibility", "accessible_toilets",
                            "Barrier-Free Restrooms: Grab bars, wide doorways, wheel-chair turning radius", 20),
                    item("accessibility", "assistive_devices",
                            "Assistive Tech Kits: Screen readers, Braille aids, hearing loop functional", 20),
                    item("staffing", "trainer_ratio",
                            "Certified Special Educators: Recognized RCI trainer ratio maintained", 15),
                    item("attendance", "biometric_attendance",
                            "AEBAS Verification: Biometric logs match live classroom headcount", 15),
                    item("placement", "placement_records",
                            "Vocational Placement: Job link documentation and certificates current", 5)));

    private static final String DEFAULT_SCHEME = "avyay";

    private final ChecklistItemRepository items;
    private final InspectionChecklistRepository checklists;
    private final InspectionRepository inspections;
    private final ProjectRepository projects;
    private final AuditService audit;

    public ChecklistService(ChecklistItemRepository items,
                            InspectionChecklistRepository checklists,
                            InspectionRepository inspections,
                            ProjectRepository projects,
                            AuditService audit) {
        this.items = items;
        this.checklists = checklists;
        this.inspections = inspections;
        this.projects = projects;
        this.audit = audit;
    }

    private static TemplateItem item(String section, String code, String title, int weight) {
        return new TemplateItem(section, code, title, weight);
    }

    /**
     * The template for an inspection plus whatever the officer has already answered.
     *
     * <p>Both shapes at once: {@code items} is the template, {@code saved_items} the per-item
     * rows, and {@code saved_checks} the legacy boolean map so an older client keeps working
     * unchanged.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> get(Integer inspectionId) {
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        String scheme = schemeFor(inspection);
        List<TemplateItem> template = templateFor(scheme);
        List<ChecklistItem> saved = items.findByInspectionIdOrderByIdAsc(inspectionId);
        InspectionChecklist aggregate = checklists.findByInspectionId(inspectionId).orElse(null);

        List<Map<String, Object>> merged = new java.util.ArrayList<>();
        java.util.Map<String, ChecklistItem> byCode = new java.util.HashMap<>();
        saved.forEach(row -> byCode.put(row.getItemCode(), row));
        for (TemplateItem definition : template) {
            ChecklistItem row = byCode.get(definition.code());
            Map<String, Object> item = new LinkedHashMap<>();
            // `id` stays the template code, not the row's primary key: the field app posts
            // `checks` keyed on whatever `items[].id` it was handed, and `saved_checks` is
            // looked up by the same key. Renaming it would silently score every checklist 0.
            item.put("id", definition.code());
            item.put("item_code", definition.code());
            item.put("row_id", row == null ? null : row.getId());
            item.put("section", definition.section());
            item.put("item", definition.title());
            item.put("title", definition.title());
            item.put("weight", definition.weight());
            item.put("status", row == null ? "pending" : row.getStatus());
            item.put("checked", row != null && "verified".equals(row.getStatus()));
            item.put("remarks", row == null ? null : row.getRemarks());
            item.put("evidence_id", row == null ? null : row.getEvidenceId());
            item.put("verified_at", row == null ? null : row.getVerifiedAt());
            merged.add(item);
        }

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("inspection_id", inspectionId);
        body.put("scheme", scheme.toUpperCase(Locale.ROOT));
        body.put("items", merged);
        body.put("compliance_score", aggregate == null ? null : aggregate.getComplianceScore());
        body.put("voice_remarks", aggregate == null ? null : aggregate.getVoiceRemarks());
        body.put("completed_items", saved.stream().filter(r -> "verified".equals(r.getStatus()) || "failed".equals(r.getStatus())).count());
        body.put("total_items", template.size());
        return body;
    }

    /**
     * Answers one item, the LLD's {@code PUT /checklist/{itemId}}.
     *
     * <p>Upserts on (inspection, item_code) so a replayed offline update overwrites rather
     * than duplicates, and recomputes the aggregate score from the template weights so the
     * legacy {@code compliance_score} never drifts from the per-item rows.
     */
    @Transactional
    public Map<String, Object> updateItem(Integer inspectionId, String itemCode, Requests.ChecklistItemUpdate body,
                                          AuthPrincipal actor) {
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        String scheme = schemeFor(inspection);
        TemplateItem definition = templateFor(scheme).stream()
                .filter(t -> t.code().equalsIgnoreCase(itemCode))
                .findFirst()
                .orElseThrow(() -> ApiException.notFound("No checklist item '" + itemCode + "' for scheme " + scheme));

        String status = body.status() == null || body.status().isBlank()
                ? "verified"
                : body.status().strip().toLowerCase(Locale.ROOT);
        if (!ITEM_STATUSES.contains(status)) {
            throw ApiException.badRequest("status must be one of: " + String.join(", ", ITEM_STATUSES));
        }
        if ("failed".equals(status) && (body.remarks() == null || body.remarks().isBlank())) {
            throw ApiException.badRequest("A failed item needs a remark explaining what was wrong");
        }

        ChecklistItem row = items.findByInspectionIdAndItemCode(inspectionId, definition.code())
                .orElseGet(ChecklistItem::new);
        row.setInspectionId(inspectionId);
        row.setItemCode(definition.code());
        row.setSection(definition.section());
        row.setItem(definition.title());
        row.setWeight(definition.weight());
        row.setStatus(status);
        row.setRemarks(body.remarks());
        if (body.evidenceId() != null) {
            row.setEvidenceId(body.evidenceId());
        }
        if (body.clientId() != null && !body.clientId().isBlank()) {
            row.setClientId(body.clientId().strip());
        }
        if (!"pending".equals(status)) {
            row.setVerifiedAt(Instant.now());
        }
        if (row.getCreatedAt() == null) {
            row.setCreatedAt(Instant.now());
        }
        ChecklistItem saved = items.save(row);

        InspectionChecklist aggregate = syncAggregate(inspectionId, scheme);

        audit.record(actor, "checklist.item_updated", "inspection", inspectionId, Map.of(
                "item_code", saved.getItemCode(),
                "status", saved.getStatus(),
                "compliance_score", String.valueOf(aggregate.getComplianceScore())));

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("message", "Checklist item updated");
        result.put("item", saved);
        result.put("compliance_score", aggregate.getComplianceScore());
        return result;
    }

    /**
     * The legacy whole-checklist submit, kept because {@code mobile-web/} posts this shape.
     *
     * <p>Fans the boolean map out into per-item rows so the LLD's model is populated either
     * way, and stores the remarks as before.
     */
    @Transactional
    public Map<String, Object> saveAll(Integer inspectionId, Requests.Checklist body, AuthPrincipal actor) {
        Inspection inspection = inspections.findById(inspectionId)
                .orElseThrow(() -> ApiException.notFound("Inspection not found"));
        String scheme = schemeFor(inspection);
        Map<String, Boolean> checks = body.checks() == null ? Map.of() : body.checks();

        for (TemplateItem definition : templateFor(scheme)) {
            Boolean answer = checks.get(definition.code());
            if (answer == null) {
                continue;
            }
            ChecklistItem row = items.findByInspectionIdAndItemCode(inspectionId, definition.code())
                    .orElseGet(ChecklistItem::new);
            row.setInspectionId(inspectionId);
            row.setItemCode(definition.code());
            row.setSection(definition.section());
            row.setItem(definition.title());
            row.setWeight(definition.weight());
            row.setStatus(Boolean.TRUE.equals(answer) ? "verified" : "failed");
            if (row.getRemarks() == null && !Boolean.TRUE.equals(answer)) {
                row.setRemarks("Marked failed by the officer.");
            }
            row.setVerifiedAt(Instant.now());
            if (row.getCreatedAt() == null) {
                row.setCreatedAt(Instant.now());
            }
            items.save(row);
        }

        InspectionChecklist aggregate = syncAggregate(inspectionId, scheme);
        aggregate.setChecks(checks);
        aggregate.setVoiceRemarks(body.voiceRemarks());
        checklists.save(aggregate);

        audit.record(actor, "checklist.submitted", "inspection", inspectionId, Map.of(
                "scheme", scheme,
                "compliance_score", String.valueOf(aggregate.getComplianceScore())));
        return Map.of("message", "Scheme checklist saved", "record", aggregate,
                "compliance_score", aggregate.getComplianceScore());
    }

    /* ----------------------------------------------------------------- helpers */

    /**
     * Recomputes the aggregate from the per-item rows and stores it.
     *
     * <p>Scored from {@code verified} items only. {@code not_applicable} is excluded rather
     * than counted as a pass, so a scheme with many N/A items cannot inflate its score.
     */
    private InspectionChecklist syncAggregate(Integer inspectionId, String scheme) {
        List<ChecklistItem> rows = items.findByInspectionIdOrderByIdAsc(inspectionId);
        int score = rows.stream()
                .filter(r -> "verified".equals(r.getStatus()))
                .mapToInt(r -> r.getWeight() == null ? 0 : r.getWeight())
                .sum();

        InspectionChecklist aggregate = checklists.findByInspectionId(inspectionId)
                .orElseGet(InspectionChecklist::new);
        aggregate.setInspectionId(inspectionId);
        aggregate.setScheme(scheme.toUpperCase(Locale.ROOT));
        aggregate.setComplianceScore(score);
        aggregate.setUpdatedAt(Instant.now());
        return checklists.save(aggregate);
    }

    private String schemeFor(Inspection inspection) {
        Project project = projects.findById(inspection.getProjectId()).orElse(null);
        String department = project == null ? null : project.getDepartment();
        String scheme = (department == null ? DEFAULT_SCHEME : department).toLowerCase(Locale.ROOT);
        return SCHEME_CHECKLISTS.containsKey(scheme) ? scheme : DEFAULT_SCHEME;
    }

    private static List<TemplateItem> templateFor(String scheme) {
        return SCHEME_CHECKLISTS.getOrDefault(scheme, SCHEME_CHECKLISTS.get(DEFAULT_SCHEME));
    }
}
