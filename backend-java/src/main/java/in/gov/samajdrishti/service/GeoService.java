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

    public static final String VERDICT_VERIFIED = "verified";
    public static final String VERDICT_MISMATCH = "mismatch";
    public static final String VERDICT_SUSPICIOUS = "suspicious";
    public static final String VERDICT_UNKNOWN = "unknown";

    public static final String SEVERITY_LOW = "low";
    public static final String SEVERITY_MEDIUM = "medium";
    public static final String SEVERITY_HIGH = "high";

    private static double toRad(double degrees) {
        return Math.toRadians(degrees);
    }

    /**
     * Validates that both latitude and longitude are within standard geographical bounds
     * and are valid non-infinite, non-NaN numbers.
     */
    public static boolean isValidCoordinate(Double lat, Double lng) {
        return lat != null && lng != null
                && !lat.isNaN() && !lat.isInfinite()
                && !lng.isNaN() && !lng.isInfinite()
                && lat >= -90.0 && lat <= 90.0
                && lng >= -180.0 && lng <= 180.0;
    }

    /** Great-circle distance between two points in metres, rounded to centimetres. */
    public Double distanceMeters(GeoPoint a, GeoPoint b) {
        GeoPoint normA = normalise(a);
        GeoPoint normB = normalise(b);
        if (normA == null || normB == null) {
            return null;
        }
        double lat1 = normA.getLat();
        double lng1 = normA.getLng();
        double lat2 = normB.getLat();
        double lng2 = normB.getLng();

        double dLat = toRad(lat2 - lat1);
        double diffLng = Math.IEEEremainder(lng2 - lng1, 360.0);
        double dLng = toRad(diffLng);
        double sinLat = Math.sin(dLat / 2);
        double sinLng = Math.sin(dLng / 2);
        double h = sinLat * sinLat + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinLng * sinLng;
        // Clamp h to [0, 1] to guard against floating-point inaccuracies yielding NaN
        double clampedH = Math.min(1.0, Math.max(0.0, h));
        double distance = 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(clampedH));
        return Math.round(distance * 100d) / 100d;
    }

    /**
     * Calculates the initial bearing (forward azimuth) from {@code from} to {@code to} in degrees [0, 360).
     * Returns null if either coordinate is invalid or missing.
     */
    public static Double initialBearing(GeoPoint from, GeoPoint to) {
        GeoPoint normA = normalise(from);
        GeoPoint normB = normalise(to);
        if (normA == null || normB == null) {
            return null;
        }
        double lat1 = toRad(normA.getLat());
        double lat2 = toRad(normB.getLat());
        double diffLng = Math.IEEEremainder(normB.getLng() - normA.getLng(), 360.0);
        double dLng = toRad(diffLng);

        double y = Math.sin(dLng) * Math.cos(lat2);
        double x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
        if (Math.abs(y) < 1e-12 && Math.abs(x) < 1e-12) {
            return 0.0;
        }
        double bearing = Math.toDegrees(Math.atan2(y, x));
        return Math.round(((bearing + 360.0) % 360.0) * 100d) / 100d;
    }

    /**
     * Converts a bearing in degrees [0, 360) to a standard 16-point compass direction (e.g. N, NE, ENE).
     */
    public static String compassDirection(Double bearingDegrees) {
        if (bearingDegrees == null) {
            return null;
        }
        String[] directions = {"N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
                               "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"};
        int index = (int) Math.round(((bearingDegrees % 360.0) / 22.5)) % 16;
        return directions[index];
    }

    public static GeoPoint normalise(Double lat, Double lng) {
        if (!isValidCoordinate(lat, lng)) {
            return null;
        }
        return GeoPoint.of(lat, lng);
    }

    public static GeoPoint normalise(GeoPoint coords) {
        if (coords == null || !coords.isPresent() || !isValidCoordinate(coords.getLat(), coords.getLng())) {
            return null;
        }
        return coords;
    }

    /**
     * Strongly typed domain record representing a geo-verification verdict.
     */
    public record GeoVerdict(
            Double distanceMeters,
            boolean withinRadius,
            String verdict,
            String severity,
            String explanation,
            long radiusMeters,
            Double bearingDegrees,
            String bearingDirection
    ) {
        public Map<String, Object> toMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("distance_meters", distanceMeters);
            map.put("within_radius", withinRadius);
            map.put("verdict", verdict);
            map.put("severity", severity);
            map.put("explanation", explanation);
            map.put("radius_meters", radiusMeters);
            if (bearingDegrees != null) {
                map.put("bearing_degrees", bearingDegrees);
                map.put("bearing_direction", bearingDirection);
            }
            return map;
        }
    }

    /**
     * @return {@code distance_meters, within_radius, verdict, severity, explanation, radius_meters, bearing_degrees, bearing_direction}.
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
            return verdict(null, false, VERDICT_UNKNOWN, SEVERITY_LOW,
                    "No registered coordinates for this project, so the location could not be verified.",
                    radius, null, null);
        }
        if (observed == null) {
            return verdict(null, false, VERDICT_UNKNOWN, SEVERITY_LOW,
                    "No GPS coordinates were submitted with this submission, so location verification was skipped.",
                    radius, null, null);
        }

        Double distance = distanceMeters(project, observed);
        Double bearing = initialBearing(observed, project);
        String direction = compassDirection(bearing);

        if (distance <= radius) {
            return verdict(distance, true, VERDICT_VERIFIED, SEVERITY_LOW,
                    "Reported within %d m of the registered site (allowed radius %d m)."
                            .formatted(Math.round(distance), Math.round(radius)),
                    radius, bearing, direction);
        }
        if (distance <= radius * 3) {
            return verdict(distance, false, VERDICT_MISMATCH, SEVERITY_MEDIUM,
                    "Reported %.2f km from the registered site - just outside the %d m radius. "
                            .formatted(distance / 1000d, Math.round(radius))
                            + "Needs a supervisor check.",
                    radius, bearing, direction);
        }
        return verdict(distance, false, VERDICT_SUSPICIOUS, SEVERITY_HIGH,
                "Reported %.2f km away from the registered site - possible proxy or fake reporting."
                        .formatted(distance / 1000d),
                radius, bearing, direction);
    }

    public GeoVerdict verifyVerdict(GeoPoint projectCoords, GeoPoint observedCoords) {
        return verifyVerdict(projectCoords, observedCoords, DEFAULT_RADIUS_M);
    }

    public GeoVerdict verifyVerdict(GeoPoint projectCoords, GeoPoint observedCoords, double radiusMeters) {
        Map<String, Object> v = verify(projectCoords, observedCoords, radiusMeters);
        return new GeoVerdict(
                (Double) v.get("distance_meters"),
                Boolean.TRUE.equals(v.get("within_radius")),
                (String) v.get("verdict"),
                (String) v.get("severity"),
                (String) v.get("explanation"),
                (Long) v.get("radius_meters"),
                (Double) v.get("bearing_degrees"),
                (String) v.get("bearing_direction")
        );
    }

    private static Map<String, Object> verdict(Double distance,
                                               boolean withinRadius,
                                               String verdict,
                                               String severity,
                                               String explanation,
                                               double radius,
                                               Double bearingDegrees,
                                               String bearingDirection) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("distance_meters", distance);
        result.put("within_radius", withinRadius);
        result.put("verdict", verdict);
        result.put("severity", severity);
        result.put("explanation", explanation);
        result.put("radius_meters", Math.round(radius));
        if (bearingDegrees != null) {
            result.put("bearing_degrees", bearingDegrees);
            result.put("bearing_direction", bearingDirection);
        }
        return result;
    }
}
