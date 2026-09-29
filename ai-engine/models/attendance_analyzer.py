"""Attendance analytics.

Turns raw check-in / check-out punches into actionable irregularities:
low attendance, late logins, missing punches, overlong sessions, geo mismatches
against the assigned project, and the same-day teleport pattern that indicates
proxy sign-ins.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from .geo_verifier import distance_meters

LATE_AFTER_MINUTES = 9 * 60 + 30
LATE_RATIO_THRESHOLD = 0.3
MIN_DAYS_FOR_PATTERN = 5
OVERLONG_HOURS = 14
PROJECT_GEO_TOLERANCE_M = 500
PROXY_DISTANCE_M = 5000
PROXY_MIN_HITS = 3


def _time_of(row, key):
    """Minutes since midnight from 'HH:MM[:SS]' or an ISO timestamp.

    ISO timestamps are converted to the machine's local time first: a punch stored
    as 09:47 local is stored in UTC, and judging it in UTC would silently hide
    every late login.
    """
    value = row.get(key)
    if not value:
        return None
    text = str(value).strip()
    if ':' in text and 'T' not in text:
        parts = text.split(':')
        try:
            hours, minutes = int(parts[0]), int(parts[1]) if len(parts) > 1 else 0
        except (ValueError, IndexError):
            return None
        if 0 <= hours <= 47 and 0 <= minutes <= 59:
            return hours * 60 + minutes
        return None
    try:
        stamp = datetime.fromisoformat(text.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return None
    if stamp.tzinfo is not None:
        stamp = stamp.astimezone().replace(tzinfo=None)
    return stamp.hour * 60 + stamp.minute


def _irregularity(official_id, kind, severity, details, confidence):
    return {
        "official_id": official_id,
        "type": kind,
        "severity": severity,
        "details": details,
        "confidence": round(float(confidence), 2),
    }


def _daily_rows(records):
    by_official = defaultdict(lambda: defaultdict(list))
    for row in records or []:
        if isinstance(row, dict) and row.get("official_id") is not None:
            by_official[row["official_id"]][row.get("date")].append(row)
    return by_official


def _day_findings(official_id, date, day_rows):
    """Irregularities detected inside a single day."""
    found = []
    check_ins = [r for r in day_rows if r.get("check_in")]
    check_outs = [r for r in day_rows if r.get("check_out")]

    if check_ins and not check_outs:
        found.append(
            _irregularity(official_id, "missing_punch", "low", f"No check-out recorded on {date}.", 0.8)
        )
    if check_outs and not check_ins:
        found.append(
            _irregularity(official_id, "missing_punch", "low", f"No check-in recorded on {date}.", 0.8)
        )

    for row in check_ins:
        start = _time_of(row, "check_in")
        end = _time_of(row, "check_out")
        if start is not None and end is not None and (end - start) / 60 > OVERLONG_HOURS:
            found.append(
                _irregularity(
                    official_id,
                    "overlong_session",
                    "medium",
                    f"Worked ~{(end - start) / 60:.1f} h on {date}.",
                    0.7,
                )
            )

        distance = distance_meters(
            row.get("lat"), row.get("lng"), row.get("project_lat"), row.get("project_lng")
        )
        if distance is not None and distance > PROJECT_GEO_TOLERANCE_M:
            found.append(
                _irregularity(
                    official_id,
                    "geo_mismatch",
                    "high" if distance > 3 * PROJECT_GEO_TOLERANCE_M else "medium",
                    f"Check-in on {date} was {distance / 1000:.1f} km from the assigned project.",
                    0.9,
                )
            )
    return found
def analyze(records) -> dict:
    """@returns {irregularities: [...], summary: {...}}"""
    rows = [r for r in (records or []) if isinstance(r, dict)]
    irregularities = []
    by_official = _daily_rows(rows)

    for official_id, by_date in by_official.items():
        present_days = 0
        late_days = 0
        missing_punch_days = 0
        proxy_points = 0

        for date, day_rows in by_date.items():
            check_ins = [r for r in day_rows if r.get("check_in")]
            check_outs = [r for r in day_rows if r.get("check_out")]

            if check_ins:
                present_days += 1
                times = [t for t in (_time_of(r, "check_in") for r in check_ins) if t is not None]
                if times and min(times) > LATE_AFTER_MINUTES:
                    late_days += 1
            if bool(check_ins) != bool(check_outs):
                missing_punch_days += 1

            irregularities.extend(_day_findings(official_id, date, day_rows))

            for row in check_ins:
                distance = distance_meters(
                    row.get("lat"), row.get("lng"), row.get("project_lat"), row.get("project_lng")
                )
                if distance is not None and distance > PROXY_DISTANCE_M:
                    proxy_points += 1

        if present_days < MIN_DAYS_FOR_PATTERN:
            irregularities.append(
                _irregularity(
                    official_id,
                    "low_attendance",
                    "medium",
                    f"Only {present_days} day(s) of attendance on record.",
                    0.75,
                )
            )

        if present_days and late_days / present_days > LATE_RATIO_THRESHOLD:
            irregularities.append(
                _irregularity(
                    official_id,
                    "late_login",
                    "medium",
                    f"Late after 09:30 on {late_days} of {present_days} days.",
                    min(0.95, 0.6 + (late_days / present_days) * 0.3),
                )
            )

        if missing_punch_days and not any(
            i["type"] == "missing_punch" for i in irregularities if i["official_id"] == official_id
        ):
            irregularities.append(
                _irregularity(
                    official_id,
                    "missing_punch",
                    "low",
                    f"{missing_punch_days} day(s) with an incomplete check-in/check-out pair.",
                    0.8,
                )
            )

        if proxy_points >= PROXY_MIN_HITS:
            irregularities.append(
                _irregularity(
                    official_id,
                    "proxy_sign_in",
                    "high",
                    f"{proxy_points} check-in(s) more than 5 km from the assigned project.",
                    0.85,
                )
            )

    by_type: dict = defaultdict(int)
    for item in irregularities:
        by_type[item["type"]] += 1

    return {
        "irregularities": irregularities,
        "summary": {
            "officials_analyzed": len(by_official),
            "records_analyzed": len(rows),
            "total_irregularities": len(irregularities),
            "by_type": dict(by_type),
        },
    }

