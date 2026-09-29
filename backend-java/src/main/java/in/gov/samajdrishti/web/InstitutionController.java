package in.gov.samajdrishti.web;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import in.gov.samajdrishti.domain.Institution;
import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.InstitutionService;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * The institution registry, the LLD's {@code institutions} table.
 *
 * <p>Kept alongside {@code /api/projects} rather than replacing it. The project is the funded
 * work, the institution is the monitored site, and both shipped dashboards read projects.
 */
@RestController
@RequestMapping("/api/institutions")
public class InstitutionController {

    private final InstitutionService institutions;

    public InstitutionController(InstitutionService institutions) {
        this.institutions = institutions;
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<Map<String, Object>> list(@RequestParam(required = false) String district,
                                           @RequestParam(required = false) String status,
                                           @RequestParam(required = false) String scheme) {
        return institutions.list(district, status, scheme);
    }

    /** The estate view: how many sites, how many need a visit, how many are flagged. */
    @GetMapping("/overview")
    @Transactional(readOnly = true)
    public Map<String, Object> overview() {
        return institutions.overview();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Institution byId(@PathVariable Integer id) {
        return institutions.byId(id);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public ResponseEntity<Institution> create(@RequestBody Requests.UpsertInstitution body,
                                              @AuthenticationPrincipal AuthPrincipal current) {
        return ResponseEntity.status(201).body(institutions.create(body, current));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public Institution update(@PathVariable Integer id,
                              @RequestBody Requests.UpsertInstitution body,
                              @AuthenticationPrincipal AuthPrincipal current) {
        return institutions.update(id, body, current);
    }
}
