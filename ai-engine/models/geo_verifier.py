"""Geo verification - the anti proxy-reporting signal.

An inspection report is only credible if it was filed from the site. The distance
between the registered project coordinates and the reported coordinates decides
the verdict.
"""
from __future__ import annotations

import math

EARTH_RADIUS_M = 6371000
DEFAULT_RADIUS_M = 250

def _to_float(value):
    try:
        if value is None or value == "":
            return None
        result = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(result) or math.isinf(result):
        return None
    return result

def _coords(lat, lng):
    lat_value = _to_float(lat)
    lng_value = _to_float(lng)
    if lat_value is None or lng_value is None:
        return None
    if not (-90 <= lat_value <= 90) or not (-180 <= lng_value <= 180):
        return None
    return lat_value, lng_value


def distance_meters(lat1, lng1, lat2, lng2) -> float | None:
    """Great-circle distance in metres, or None when a coordinate is unusable."""
    a = _coords(lat1, lng1)
    b = _coords(lat2, lng2)
    if a is None or b is None:
        return None

    phi1 = math.radians(a[0])
    phi2 = math.radians(b[0])
    delta_phi = math.radians(b[0] - a[0])
    delta_lambda = math.radians(b[1] - a[1])

    h = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    return round(2 * EARTH_RADIUS_M * math.asin(min(1.0, math.sqrt(h))), 2)


def verify(project: dict, observation: dict) -> dict:
    """Verdict for one report: verified / mismatch / suspicious / unknown.

    project      : {id, name, lat, lng, radius_meters?}
    observation  : {inspection_id, lat, lng, captured_at}
    """
    project = project or {}
    observation = observation or {}
    radius = _to_float(project.get("radius_meters")) or DEFAULT_RADIUS_M
    project_coords = _coords(project.get("lat"), project.get("lng"))
    observed_coords = _coords(observation.get("lat"), observation.get("lng"))

    if project_coords is None:
        return {
            "distance_meters": None,
            "within_radius": False,
            "verdict": "unknown",
            "severity": "low",
            "explanation": "No registered coordinates for this project, so the location could not be verified.",
            "radius_meters": radius,
        }

    if observed_coords is None:
        return {
            "distance_meters": None,
            "within_radius": False,
            "verdict": "unknown",
            "severity": "low",
            "explanation": "No GPS coordinates were submitted, so location verification was skipped.",
            "radius_meters": radius,
        }

    distance = distance_meters(*project_coords, *observed_coords)

    if distance <= radius:
        return {
            "distance_meters": distance,
            "within_radius": True,
            "verdict": "verified",
            "severity": "low",
            "explanation": f"Reported within {distance:.0f} m of the registered site (allowed radius {radius:.0f} m).",
            "radius_meters": radius,
        }

    if distance <= radius * 3:
        return {
            "distance_meters": distance,
            "within_radius": False,
            "verdict": "mismatch",
            "severity": "medium",
            "explanation": (
                f"Reported {distance / 1000:.2f} km from the registered site - just outside the "
                f"{radius:.0f} m radius. Needs a supervisor check."
            ),
            "radius_meters": radius,
        }

    return {
        "distance_meters": distance,
        "within_radius": False,
        "verdict": "suspicious",
        "severity": "high",
        "explanation": (
            f"Reported {distance / 1000:.2f} km away from the registered site - "
            "possible proxy or fake reporting."
        ),
        "radius_meters": radius,
    }
