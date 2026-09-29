package in.gov.samajdrishti.service;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Service;

import in.gov.samajdrishti.domain.GeoPoint;

/**
 * Geo-verification.
 *
 * <p>Problem statement 26095 asks for geo-tagged inspection reports and for a
 * reduction in fake reporting and proxy functioning. The enforcement is the distance
 * between the registered project coordinates and where the evidence or check-in
 * actually happened.
 *
 * <p>This is deliberately self-contained - no AI round-trip - so a report can never be
 * blocked by an upstream failure. The AI engine can enrich the wording, but the verdict
 * itself is always deterministic.
 */
@Service
public class GeoService {

    public static final double EARTH_RADIUS_M = 6_371_000d;
    public static final double DEFAULT_RADIUS_M = 250d;

    private static final double toRad(double degrees) {
        return Math.toRadians(degrees);
    }

    /** Great-circle distance between two points in metres, rounded to centimetres. */
    public Double distanceMeters(GeoPoint a, GeoPoint b) {
        if (a == null || b == null || !a.isPresent() || !b.isPresent()) {
            return null;
        }
        double lat1 = a.getLat();
        double lng1 = a.getLng();
        double lat2 = b.getLat();
        double lng2 = b.getLng();

        double dLat = toRad(lat2 - lat1);
        double dLng = toRad(lng2 - lng1);
        double sinLat = Math.sin(dLat / 2);
        double sinLng = Math.sin(dLng / 2);
        double h = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
        double distance = 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
        return Math.round(distance * 100d) / 100d;
    }

    public static GeoPoint normalise(Double lat, Double lng) {
        return GeoPoint.of(lat, lng);
    }

    public static GeoPoint normalise(GeoPoint coords) {
        return coords != null && coords.isPresent() ? coords : null;
    }

    /**
     * @return {@code distance_meters, within_radius, verdict, severity, explanation, radius_meters}.
     *         {@code verdict} is {@code verified}, {@code mismatch}, {@code suspicious}
     *         or {@code unknown}.
     */
    public Map<String, Object> verify(GeoPoint projectCoords, GeoPoint observedCoords) {
        return verify(projectCoords, observedCoords, DEFAULT_RADIUS_M);
    }

    public Map<String, Object> verify(GeoPoint projectCoords, GeoPoint observedCoords, double radiusMeters) {
        double radius = radiusMeters > 0 ? radiusMeters : DEFAULT_RADIUS_M;
        GeoPoint project = normalise(projectCoords);
        GeoPoint observed = normalise(observedCoords);

        if (project == null) {
            return verdict(null, false, "unknown", "low",
                    "No registered coordinates for this project, so the location could not be verified.", radius);
        }
        if (observed == null) {
            return verdict(null, false, "unknown", "low",
                    "No GPS coordinates were submitted with this submission, so location verification was skipped.",
                    radius);
        }

        Double distance = distanceMeters(project, observed);
        if (distance <= radius) {
            return verdict(distance, true, "verified", "low",
                    "Reported within %d m of the registered site (allowed radius %d m)."
                            .formatted(Math.round(distance), Math.round(radius)), radius);
        }
        if (distance <= radius * 3) {
            return verdict(distance, false, "mismatch", "medium",
                    "Reported %.2f km from the registered site - just outside the %d m radius. "
                            .formatted(distance / 1000d, Math.round(radius))
                            + "Needs a supervisor check.", radius);
        }
        return verdict(distance, false, "suspicious", "high",
                "Reported %.2f km away from the registered site - possible proxy or fake reporting."
                        .formatted(distance / 1000d), radius);
    }

    private static Map<String, Object> verdict(Double distance,
                                               boolean withinRadius,
                                               String verdict,
                                               String severity,
                                               String explanation,
                                               double radius) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("distance_meters", distance);
        result.put("within_radius", withinRadius);
        result.put("verdict", verdict);
        result.put("severity", severity);
        result.put("explanation", explanation);
        result.put("radius_meters", Math.round(radius));
        return result;
    }
}
