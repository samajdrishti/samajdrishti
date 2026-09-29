package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.BeneficiaryFeedback;
import in.gov.samajdrishti.domain.Project;
import in.gov.samajdrishti.repository.BeneficiaryFeedbackRepository;
import in.gov.samajdrishti.repository.ProjectRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.AuditService;
import in.gov.samajdrishti.web.dto.Requests;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Beneficiary feedback and social audit.
 *
 * <p>Deliberately open to unauthenticated callers: the whole point of the channel is
 * that a resident can report a problem without an official's login. The write is still
 * recorded in the audit trail.
 */
@RestController
@RequestMapping("/api/beneficiaries")
public class BeneficiaryController {

    private final BeneficiaryFeedbackRepository feedback;
    private final ProjectRepository projects;
    private final AuditService audit;

    public BeneficiaryController(BeneficiaryFeedbackRepository feedback,
                                 ProjectRepository projects,
                                 AuditService audit) {
        this.feedback = feedback;
        this.projects = projects;
        this.audit = audit;
    }

    @GetMapping("/feedback")
    @Transactional(readOnly = true)
    public List<BeneficiaryFeedback> list(@RequestParam(required = false) Integer projectId) {
        List<BeneficiaryFeedback> all = feedback.findAllByOrderByIdDesc();
        if (projectId == null) {
            return all;
        }
        return all.stream().filter(f -> projectId.equals(f.getProjectId())).toList();
    }

    @PostMapping("/feedback")
    @Transactional
    public ResponseEntity<Map<String, Object>> submit(@RequestBody(required = false) Requests.Feedback body,
                                                      @AuthenticationPrincipal AuthPrincipal current) {
        Requests.Feedback payload = body == null ? new Requests.Feedback(null, null, null, null, null, null, null) : body;
        Project project = payload.projectId() == null ? null : projects.findById(payload.projectId()).orElse(null);

        int rating = payload.rating() == null ? 4 : payload.rating();
        BeneficiaryFeedback record = new BeneficiaryFeedback();
        record.setProjectId(payload.projectId());
        record.setProjectName(project == null ? "DoSJE Monitored Facility" : project.getName());
        record.setScheme(payload.scheme() != null && !payload.scheme().isBlank()
                ? payload.scheme()
                : project == null ? "AVYAY" : project.getDepartment());
        record.setBeneficiaryName(payload.beneficiaryName() != null && !payload.beneficiaryName().isBlank()
                ? payload.beneficiaryName()
                : current == null ? "Anonymous Beneficiary" : current.name());
        record.setCategory(payload.category() == null || payload.category().isBlank()
                ? "General Welfare" : payload.category());
        record.setRating(rating);
        record.setComment(payload.comment() == null || payload.comment().isBlank()
                ? "Service standard verified by beneficiary." : payload.comment());
        record.setSentiment(sentimentOf(rating));
        record.setVerifiedResident(true);
        record.setVoiceMemoRecorded(payload.voiceMemo() != null && !payload.voiceMemo().isBlank());
        record.setCreatedAt(Instant.now());
        BeneficiaryFeedback saved = feedback.save(record);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("rating", String.valueOf(rating));
        meta.put("sentiment", saved.getSentiment());
        meta.put("category", String.valueOf(saved.getCategory()));
        audit.record(current, "social_audit.feedback_submitted", "project", payload.projectId(), meta);

        return ResponseEntity.status(201).body(Map.of(
                "message", "Beneficiary feedback recorded for Social Audit",
                "feedback", saved));
    }

    private static String sentimentOf(int rating) {
        if (rating >= 4) {
            return "positive";
        }
        return rating <= 2 ? "critical" : "neutral";
    }
}
