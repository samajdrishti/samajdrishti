package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.Atr;
import in.gov.samajdrishti.repository.AtrRepository;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.AuditService;
import in.gov.samajdrishti.web.dto.Requests;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Action Taken Report (ATR) adjudication.
 *
 * <p>Implements the DoSJE compliance workflow: monitor -> record deficiency -> issue ATR
 * deadline -> NGO responds with proof -> PMU adjudication -> escalate or close.
 */
@RestController
@RequestMapping("/api/atr")
public class AtrController {

    private static final Map<String, String> VERDICTS = Map.of(
            "approve", "approved_closed",
            "escalate", "escalated",
            "reject", "rejected_reinspection");

    private final AtrRepository atrs;
    private final AuditService audit;

    public AtrController(AtrRepository atrs, AuditService audit) {
        this.atrs = atrs;
        this.audit = audit;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Atr> list() {
        return atrs.findAllByOrderByIdDesc();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Atr byId(@PathVariable Integer id) {
        return atrs.findById(id)
                .orElseThrow(() -> ApiException.notFound("Action Taken Report not found"));
    }

    @PostMapping("/{id}/respond")
    @Transactional
    public Map<String, Object> respond(@PathVariable Integer id,
                                       @RequestBody(required = false) Requests.NgoReply body,
                                       @AuthenticationPrincipal AuthPrincipal current) {
        Atr item = atrs.findById(id)
                .orElseThrow(() -> ApiException.notFound("ATR record not found"));

        if (body != null) {
            if (body.ngoReply() != null && !body.ngoReply().isBlank()) {
                item.setNgoReply(body.ngoReply());
            }
            if (body.correctiveEvidenceUrl() != null && !body.correctiveEvidenceUrl().isBlank()) {
                item.setCorrectiveEvidenceUrl(body.correctiveEvidenceUrl());
            }
        }
        item.setStatus("under_review");
        item.setUpdatedAt(Instant.now());
        Atr saved = atrs.save(item);

        audit.record(current, "atr.ngo_reply_submitted", "atr", saved.getId(),
                Map.of("project_id", String.valueOf(saved.getProjectId()),
                        "status", saved.getStatus()));

        return Map.of(
                "message", "Corrective action taken report submitted successfully",
                "atr", saved);
    }

    @PostMapping("/{id}/adjudicate")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    @Transactional
    public Map<String, Object> adjudicate(@PathVariable Integer id,
                                          @RequestBody(required = false) Requests.Adjudication body,
                                          @AuthenticationPrincipal AuthPrincipal current) {
        Atr item = atrs.findById(id)
                .orElseThrow(() -> ApiException.notFound("ATR record not found"));

        String action = body == null ? null : body.action();
        String verdict = action == null ? null : VERDICTS.get(action);
        if (verdict != null) {
            item.setStatus(verdict);
        }
        if (body != null && body.pmuAdjudication() != null && !body.pmuAdjudication().isBlank()) {
            item.setPmuAdjudication(body.pmuAdjudication());
        }
        item.setOfficialName(current.name());
        item.setUpdatedAt(Instant.now());
        Atr saved = atrs.save(item);

        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("action", action == null ? "" : action);
        meta.put("verdict", saved.getStatus() == null ? "" : saved.getStatus());
        audit.record(current, "atr.adjudicated." + (action == null ? "none" : action), "atr", saved.getId(), meta);

        return Map.of("message", "ATR adjudicated: " + saved.getStatus(), "atr", saved);
    }
}
