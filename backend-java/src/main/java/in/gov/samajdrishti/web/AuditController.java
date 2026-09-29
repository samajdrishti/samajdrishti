package in.gov.samajdrishti.web;

import in.gov.samajdrishti.domain.AuditEntry;
import in.gov.samajdrishti.service.AuditService;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Read-only view of the append-only audit trail. */
@RestController
@RequestMapping("/api/audit")
@PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
public class AuditController {

    private final AuditService audit;

    public AuditController(AuditService audit) {
        this.audit = audit;
    }

    @GetMapping
    public List<AuditEntry> list(@RequestParam(required = false) String entity,
                                 @RequestParam(required = false) Integer entityId,
                                 @RequestParam(required = false) Integer limit) {
        return audit.list(entity, entityId, limit);
    }

    @GetMapping("/{entity}/{id}")
    public List<AuditEntry> byEntity(@PathVariable String entity,
                                     @PathVariable Integer id,
                                     @RequestParam(required = false) Integer limit) {
        return audit.list(entity, id, limit);
    }
}
