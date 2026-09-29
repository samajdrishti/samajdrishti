package in.gov.samajdrishti.web;

import java.util.List;
import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import in.gov.samajdrishti.security.AuthPrincipal;
import in.gov.samajdrishti.service.GeofenceService;
import in.gov.samajdrishti.web.dto.Requests;

/**
 * Geofence verification, LLD §6 and §17.
 *
 * <p>Thin HTTP layer over {@link GeofenceService}, which owns the persistence and the
 * per-site radius. The route name is the LLD's {@code POST /inspections/{id}/location};
 * {@code /geo-verify} is kept as an alias because the existing field app calls that.
 */
@RestController
@RequestMapping("/api/inspections")
public class GeofenceController {

    private final GeofenceService geofence;

    public GeofenceController(GeofenceService geofence) {
        this.geofence = geofence;
    }

    /**
     * Records where the officer is and whether that passes.
     *
     * <p>Writes the outcome onto the inspection, which is what makes {@code IN_PROGRESS}
     * reachable afterwards. Previously the verdict was returned to the caller and discarded,
     * so nothing could later establish that the officer had ever been on site.
     */
    @PostMapping("/{id}/location")
    public Map<String, Object> location(@PathVariable Integer id,
                                        @RequestBody Requests.GeoRequest body,
                                        @AuthenticationPrincipal AuthPrincipal current) {
        return geofence.verify(id, body, current);
    }

    @PostMapping("/{id}/geo-check")
    public Map<String, Object> geoCheck(@PathVariable Integer id,
                                        @RequestBody Requests.GeoRequest body,
                                        @AuthenticationPrincipal AuthPrincipal current) {
        return geofence.verify(id, body, current);
    }

    /** The standing verdict, for a screen that only needs a badge. */
    @GetMapping("/{id}/location")
    @Transactional(readOnly = true)
    public Map<String, Object> status(@PathVariable Integer id) {
        return geofence.status(id);
    }
}
