"""Test suite for the Samaj Drishti AI engine.

Runs the ASGI app in-process through FastAPI's TestClient - no server, no network.
Covers the contract the Java API depends on, the two risk/assign endpoints the
dashboard uses, and - most importantly - that every endpoint still answers when the
LLM provider is unavailable.
"""

from __future__ import annotations

import random

import pytest
from fastapi.testclient import TestClient

import main

PROJECT = {
    "id": 1,
    "name": "Chaubisee Vikas Sangh - Senior Citizen Home (AVYAY)",
    "budget": 4_200_000,
    "location": "Meham, Rohtak, Haryana",
    "department": "AVYAY",
    "inspection_history": [
        {"status": "flagged", "date": "2024-07-18"},
        {"status": "completed", "date": "2024-08-01"},
    ],
}

INSPECTION_BATCH = [
    {
        "id": index,
        "project_id": 1,
        "assigned_to": (index % 3) + 1,
        "status": "flagged" if index == 4 else "completed",
        "scheduled_date": f"2026-09-{index + 1:02d}",
        "completed_date": f"2026-09-{index + 2:02d}",
        "ai_risk_score": 88.0 if index == 4 else 30.0 + index,
    }
    for index in range(1, 12)
]


@pytest.fixture(scope="module")
def client() -> TestClient:
    return TestClient(main.app)


# ---------------------------------------------------------------------- service


def test_root_reports_the_service(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"service": "Samaj Drishti AI Engine", "status": "running"}


def test_health_advertises_every_capability(client: TestClient) -> None:
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert body["anomaly_backend"] in {"isolation_forest", "robust_zscore"}
    assert "risk_scoring" in body["capabilities"]
    assert "vision_anti_spoofing" in body["capabilities"]
    assert isinstance(body["llm_available"], bool)


def test_openapi_schema_is_served(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    assert "/api/risk/score" in schema["paths"]
    assert "/api/narrative" in schema["paths"]


# ------------------------------------------------------------------ risk score


def test_risk_score_is_bounded_and_explained(client: TestClient) -> None:
    # The single-project endpoint keys off `project_id`; the batch endpoint keys off `id`.
    response = client.post("/api/risk/score", json={**PROJECT, "project_id": 1})
    assert response.status_code == 200
    body = response.json()
    assert 0 <= body["risk_score"] <= 100
    assert body["project_id"] == 1
    assert body["factors"], "a high-budget flagged project must report its drivers"


def test_risk_score_of_an_empty_project_is_low(client: TestClient) -> None:
    body = client.post("/api/risk/score", json={}).json()
    assert body["risk_score"] == 0
    assert body["factors"] == []


def test_risk_batch_scores_every_project(client: TestClient) -> None:
    projects = [PROJECT, {**PROJECT, "id": 2, "budget": 50_000, "department": "health"}]
    body = client.post("/api/risk/score-batch", json={"projects": projects}).json()
    assert body["count"] == 2
    assert [score["project_id"] for score in body["scores"]] == [1, 2]
    assert body["scores"][0]["risk_score"] > body["scores"][1]["risk_score"]


def test_risk_batch_accepts_an_empty_portfolio(client: TestClient) -> None:
    assert client.post("/api/risk/score-batch", json={"projects": []}).json() == {"scores": [], "count": 0}


# --------------------------------------------------------------------- anomaly


def test_anomaly_detection_flags_the_known_bad_row(client: TestClient) -> None:
    body = client.post("/api/anomaly/detect", json={"inspections": INSPECTION_BATCH}).json()
    flagged = [a["inspection_id"] for a in body["anomalies"]]
    assert 4 in flagged
    assert all("confidence" in a and "method" in a for a in body["anomalies"])


def test_anomaly_detection_accepts_an_empty_batch(client: TestClient) -> None:
    assert client.post("/api/anomaly/detect", json={"inspections": []}).json()["anomalies"] == []
    assert client.post("/api/anomaly/detect", json={}).json()["anomalies"] == []


def test_anomaly_detection_survives_a_malformed_batch(client: TestClient) -> None:
    response = client.post("/api/anomaly/detect", json={"inspections": "not-a-list"})
    assert response.status_code == 422


def test_anomaly_detector_is_stable_across_repeated_calls() -> None:
    """Refitting per call must stay deterministic - the same batch always
    yields the same verdicts, whatever backend is active."""
    import pandas as pd
    from models.anomaly_detector import AnomalyDetector

    detector = AnomalyDetector()
    frame = pd.DataFrame(INSPECTION_BATCH)
    first = detector.detect(frame)
    second = detector.detect(frame)
    assert first == second
    assert [a["inspection_id"] for a in first] == [a["inspection_id"] for a in second]


# --------------------------------------------------------------- configuration


def test_cors_origins_default_to_the_local_frontends(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert main.cors_origins() == ["http://localhost:5173", "http://localhost:5174"]


def test_cors_origins_are_read_from_the_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", "https://samajdrishti.gov.in, https://dashboard.gov.in")
    assert main.cors_origins() == ["https://samajdrishti.gov.in", "https://dashboard.gov.in"]


def test_cors_origins_tolerate_whitespace_and_blanks(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("CORS_ORIGINS", " , https://one.gov.in , , https://two.gov.in , ")
    assert main.cors_origins() == ["https://one.gov.in", "https://two.gov.in"]


# ------------------------------------------------------------------ assignment


def test_random_assignment_produces_a_usable_plan(client: TestClient) -> None:
    projects = [{**PROJECT, "id": index, "risk_score": 20 + index * 5} for index in range(1, 5)]
    officials = [{"id": index, "name": f"Official {index}"} for index in range(1, 4)]
    random.seed(20260928)
    body = client.post(
        "/api/inspections/random-assign",
        json={"projects": projects, "officials": officials, "num_inspections": 6},
    ).json()

    assignments = body["assignments"]
    # The assigner never double-books a project, so the plan is bounded by both the
    # request and the number of eligible projects.
    assert 1 <= len(assignments) <= 6
    assert len({a["project_id"] for a in assignments}) == len(assignments)
    assert {a["project_id"] for a in assignments} <= {1, 2, 3, 4}
    assert {a["official_id"] for a in assignments} <= {1, 2, 3}
    for assignment in assignments:
        # The Java client reads exactly these fields when persisting an inspection.
        assert assignment["scheduled_date"] and assignment["scheduled_time"]
        assert assignment["anti_predictability_hash"].startswith("NAV-")
        assert assignment["zero_conflict_score"] >= 0


def test_random_assignment_spreads_across_officials(client: TestClient) -> None:
    projects = [{**PROJECT, "id": index, "risk_score": 20 + index * 5} for index in range(1, 7)]
    officials = [{"id": index, "name": f"Official {index}"} for index in range(1, 4)]
    random.seed(11)
    body = client.post(
        "/api/inspections/random-assign",
        json={"projects": projects, "officials": officials, "num_inspections": 6},
    ).json()
    # Zero-conflict scoring exists to avoid piling everything onto one official.
    assert len({a["official_id"] for a in body["assignments"]}) >= 2


def test_random_assignment_requires_projects_and_officials(client: TestClient) -> None:
    response = client.post(
        "/api/inspections/random-assign", json={"projects": [], "officials": []}
    )
    assert response.status_code == 400
    assert "required" in response.json()["error"]


# -------------------------------------------------------------------- geo check


def test_geo_verification_flags_a_distant_report(client: TestClient) -> None:
    body = client.post(
        "/api/geo/verify",
        json={
            "project": {"id": 1, "name": "Chaubisee", "lat": 28.8955, "lng": 76.6066, "radius_meters": 250},
            "observation": {"lat": 28.95, "lng": 76.65},
        },
    ).json()
    assert body["verdict"] == "suspicious"
    assert body["within_radius"] is False
    assert body["distance_meters"] > 5_000
    assert body["severity"] == "high"


def test_geo_verification_accepts_an_on_site_report(client: TestClient) -> None:
    body = client.post(
        "/api/geo/verify",
        json={
            "project": {"lat": 28.8955, "lng": 76.6066, "radius_meters": 250},
            "observation": {"lat": 28.8956, "lng": 76.6067},
        },
    ).json()
    assert body["verdict"] == "verified"
    assert body["within_radius"] is True


def test_geo_verification_without_coordinates_is_unknown(client: TestClient) -> None:
    body = client.post("/api/geo/verify", json={"project": {}, "observation": {}}).json()
    assert body["verdict"] == "unknown"
    assert body["distance_meters"] is None


# -------------------------------------------------------- attendance + vision


def test_attendance_analysis_returns_irregularities_and_summary(client: TestClient) -> None:
    records = [
        {
            "official_id": 3,
            "date": "2026-09-20",
            "check_in": f"2026-09-20T10:45:00Z",
            "check_out": f"2026-09-20T17:00:00Z",
            "project_id": 1,
            "project_lat": 28.8955,
            "project_lng": 76.6066,
            "lat": 28.98,
            "lng": 76.70,
        }
    ]
    body = client.post("/api/attendance/analyze", json={"records": records}).json()
    assert "irregularities" in body and "summary" in body
    assert body["irregularities"], "a punch 10 km from the site must be reported"


def test_suspicious_pattern_detection(client: TestClient) -> None:
    body = client.post(
        "/api/patterns/suspicious",
        json={"patterns": [{"inspector_id": 2, "scheduled_time": "09:00"}] * 8},
    ).json()
    assert any(p["type"] == "assignment_bias" for p in body["suspicious_patterns"])


def test_cctv_anomaly_detects_an_obstructed_lens(client: TestClient) -> None:
    body = client.post(
        "/api/vision/cctv-anomaly", json={"camera_id": 1, "occlusion_pct": 84.5}
    ).json()
    assert body["is_anomaly"] is True
    assert body["anomaly_type"] == "lens_obstruction"
    assert body["severity"] == "high"


def test_discrepancy_index_exposes_ghost_beneficiaries(client: TestClient) -> None:
    body = client.post(
        "/api/discrepancy/attendance-index",
        json={"sanctioned_capacity": 50, "aebas_count": 47, "visual_headcount": 14},
    ).json()
    assert body["ghost_beneficiary_delta"] == 33
    assert body["proxy_attendance_verdict"] == "critical_proxy_irregularity"
    assert body["tamper_flag"] == "PROXY_ATTENDANCE_FLAGGED"


def test_dashboard_stats_bucket_the_risk_scores(client: TestClient) -> None:
    body = client.post(
        "/api/dashboard/stats",
        json={"projects": [{"risk_score": 85}, {"risk_score": 55}, {"risk_score": 10}]},
    ).json()
    assert body["total_projects"] == 3
    assert body["high_risk_count"] == 1
    assert body["medium_risk_count"] == 1
    assert body["low_risk_count"] == 1
    assert body["average_risk_score"] == 50.0
    assert body["recommendations"]


# ------------------------------------------------------------------ narrative


def test_narrative_falls_back_to_a_local_briefing(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    context = {
        "totals": {"projects": 8, "inspections": 23, "cameras": 6, "cameras_online": 5, "cameras_offline": 1},
        "inspections_by_status": {"completed": 12, "pending": 6, "flagged": 2},
        "geo_verification": {"suspicious": 3},
        "highest_risk_projects": [
            {"name": "Chaubisee Vikas Sangh", "risk_score": 88.5, "factors": [{"factor": "High budget"}]}
        ],
        "anomalies": [{"inspection_id": 1}],
    }
    # Force the offline path so the assertion does not depend on a configured API key.
    monkeypatch.setattr(main.llm, "available", lambda: False)

    body = client.post("/api/narrative", json={"context": context, "tone": "executive"}).json()
    assert body["provider"] == "local-fallback"
    assert body["model"] is None
    assert "Chaubisee Vikas Sangh" in body["narrative"]
    assert "8 projects are under monitoring" in body["narrative"]
    assert "3 geo-verification failure(s)" in body["narrative"]
    assert body["generated_at"]


def test_local_narrative_says_so_when_there_is_no_data() -> None:
    # Unit-level: the exact fallback wording, independent of any provider.
    assert main._local_narrative({}, "executive") == "No monitoring data is available yet."


def test_narrative_rejects_an_unknown_tone_by_defaulting(client: TestClient) -> None:
    body = client.post("/api/narrative", json={"context": {}, "tone": "sarcastic"}).json()
    assert body["tone"] == "executive"


def test_narrative_always_answers(client: TestClient) -> None:
    body = client.post("/api/narrative", json={}).json()
    assert body["narrative"]
    assert body["provider"] in {"local-fallback", main.llm.provider_label()}
