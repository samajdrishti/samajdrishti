package in.gov.samajdrishti.web;

import java.util.List;
import java.util.Map;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import in.gov.samajdrishti.domain.Atr;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.AtrService;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * Action Taken Reports, LLD §12.
 *
 * <p>Thin HTTP layer over {@link AtrService}; the workflow rules live there. The routes that
 * were missing before - {@code POST /api/atr}, {@code PUT /api/atr/{id}} and
 * {@code POST /api/atr/{id}/close} - are the reason this workflow was not demoable: an ATR
 * could be read, answered and adjudicated but never raised.
 */
@RestController
@RequestMapping("/api/atr")
public class AtrController {

    private final AtrService atrs;

    public AtrController(AtrService atrs) {
        this.atrs = atrs;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Atr> list(@org.springframework.web.bind.annotation.RequestParam(required = false) String status,
                          @org.springframework.web.bind.annotation.RequestParam(required = false) Integer projectId,
                          @org.springframework.web.bind.annotation.RequestParam(required = false) Integer assignedTo) {
        return atrs.list(status, projectId, assignedTo);
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Atr byId(@PathVariable Integer id) {
        return atrs.byId(id);
    }

    /** Raises an action against an inspection, an AI finding or a project. */
    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> create(@RequestBody Requests.CreateAtr body,
                                      @AuthenticationPrincipal AuthPrincipal current) {
        return atrs.create(body, current);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> update(@PathVariable Integer id,
                                      @RequestBody(required = false) Requests.UpdateAtr body,
                                      @AuthenticationPrincipal AuthPrincipal current) {
        return atrs.update(id, body == null ? new Requests.UpdateAtr(null, null, null, null, null) : body, current);
    }

    /**
     * Closes an action.
     *
     * <p>Verification is a separate field from status on purpose: an action can be satisfied
     * and still be rejected on inspection, and conflating the two hides the case that matters.
     */
    @PostMapping("/{id}/close")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> close(@PathVariable Integer id,
                                     @RequestBody(required = false) Requests.CloseAtr body,
                                     @AuthenticationPrincipal AuthPrincipal current) {
        return atrs.close(id, body, current);
    }

    @PostMapping("/{id}/respond")
    public Map<String, Object> respond(@PathVariable Integer id,
                                       @RequestBody(required = false) Requests.NgoReply body,
                                       @AuthenticationPrincipal AuthPrincipal current) {
        return atrs.respond(id,
                body == null ? null : body.ngoReply(),
                body == null ? null : body.correctiveEvidenceUrl(),
                current);
    }

    @PostMapping("/{id}/adjudicate")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Map<String, Object> adjudicate(@PathVariable Integer id,
                                          @RequestBody(required = false) Requests.Adjudication body,
                                          @AuthenticationPrincipal AuthPrincipal current) {
        return atrs.adjudicate(id,
                body == null ? null : body.action(),
                body == null ? null : body.pmuAdjudication(),
                current);
    }
}
