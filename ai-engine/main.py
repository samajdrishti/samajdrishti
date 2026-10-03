"""Samaj Drishti AI engine - FastAPI service.

Migrated from Flask to FastAPI while keeping every route, request field and response
key identical, so the Java API and both web clients need no changes.

What the migration buys:

* Every request and response is a validated Pydantic model, so a malformed payload
  fails loudly at the edge instead of surfacing as a ``KeyError`` deep in pandas.
* Interactive OpenAPI docs at ``/docs`` and a machine-readable schema at ``/openapi.json``.
* The detectors run in a worker thread rather than blocking the event loop - pandas and
  scikit-learn calls are CPU bound, and a synchronous endpoint gets that for free.
* One uniform error shape (``{"error": ...}``) from a single handler.

Run it with:

    uvicorn main:app --host 0.0.0.0 --port 5001
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import llm
import schemas
from models.anomaly_detector import AnomalyDetector
from models.attendance_analyzer import analyze as analyze_attendance_records
from models.geo_verifier import verify as verify_geo
from models.image_verifier import ImageVerifier
from models.random_assigner import RandomInspectionAssigner
from models.risk_scorer import RiskScorer

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
)
log = logging.getLogger("ai-engine")

# Shared secret with the Java API. Auth is only enforced when the key is set, so
# a local dev run with no AI_ENGINE_API_KEY keeps working unchanged.
API_KEY = os.environ.get("AI_ENGINE_API_KEY", "")

# Root that evidence images may be read from. verify-image must never resolve
# paths outside this directory.
UPLOAD_ROOT = Path(
    os.environ.get(
        "AI_UPLOAD_ROOT",
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads"),
    )
).resolve()


# CORS origins are deployment-specific, so they come from the environment
# (comma-separated) with the two local dev frontends as the default.
def cors_origins() -> list[str]:
    raw = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


async def require_api_key(request: Request) -> None:
    if not API_KEY:
        return
    if request.headers.get("X-API-Key", "") != API_KEY:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")

MODELS = [
    "isolation_forest_anomaly_detector",
    "rule_weighted_risk_scorer",
    "randomised_inspection_assigner",
    "haversine_geo_verifier",
    "attendance_pattern_analyzer",
    "image_anti_spoofing_verifier",
]

CAPABILITIES = [
    "anomaly_detection",
    "risk_scoring",
    "random_assignment",
    "attendance_analysis",
    "pattern_detection",
    "geo_verification",
    "narrative",
    "vision_anti_spoofing",
]

NARRATIVE_TONES = {
    "executive": (
        "You are briefing the District Social Welfare Officer and the State Project Management "
        "Unit of the Department of Social Justice & Empowerment. Scope is the Coimbatore district "
        "portfolio. Be concise, factual and decision oriented. 3-5 sentences. No bullet points, "
        "no headings, no preamble. Lead with the most important risk."
    ),
    "field": (
        "You are briefing field inspection officials on their phone. Be short, practical and "
        "actionable: what to check, where, and what looks suspicious. 3-4 sentences, plain English."
    ),
    "technical": (
        "You are writing a technical monitoring note for engineers. Be precise, mention the metrics "
        "and thresholds involved, and state the data quality caveats. 3-5 sentences."
    ),
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    log.info("Samaj Drishti AI Engine starting")
    yield
    log.info("Samaj Drishti AI Engine stopping")


app = FastAPI(
    title="Samaj Drishti AI Engine",
    version="2.0.0",
    description=(
        "Risk scoring, anomaly detection, randomised inspection assignment, geo verification "
        "and executive narrative generation for the Samaj Drishti monitoring platform."
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model instances are cheap to build and hold no per-request state beyond a seeded RNG,
# so a module-level singleton is the right lifetime for all of them.
anomaly_detector = AnomalyDetector()
risk_scorer = RiskScorer()
assigner = RandomInspectionAssigner()
image_verifier = ImageVerifier()


@app.exception_handler(ValueError)
async def value_error_handler(_: Request, exc: ValueError) -> JSONResponse:
    """A bad payload is a 400 with the contract's error shape, not a 500."""
    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"error": str(exc)})


# --------------------------------------------------------------------- service


@app.get("/", tags=["service"])
async def index() -> dict[str, str]:
    return {"service": "Samaj Drishti AI Engine", "status": "running"}


@app.get("/api/health", response_model=schemas.HealthResponse, tags=["service"])
async def health() -> dict[str, object]:
    """Liveness and capability probe, used by the Java API and the admin dashboard."""
    return {
        "service": "Samaj Drishti AI Engine",
        "status": "ok",
        "models": MODELS,
        "anomaly_backend": anomaly_detector.backend,
        "llm_provider": llm.provider_label(),
        "llm_available": llm.available(),
        "capabilities": CAPABILITIES,
    }


# -------------------------------------------------------------------- analysis


@app.post("/api/anomaly/detect", response_model=schemas.AnomalyResponse, tags=["analysis"],
          dependencies=[Depends(require_api_key)])
async def detect_anomalies(body: schemas.AnomalyRequest) -> dict[str, object]:
    """Detect anomalies in inspection patterns.

    Detection is best effort by design: a failure is logged and returned as an empty
    list so a bad batch can never take the monitoring pipeline down.
    """
    if not body.inspections:
        return {"anomalies": []}

    try:
        frame = pd.DataFrame(body.inspections)
    except (ValueError, TypeError) as exc:
        return {"anomalies": [], "error": f"inspections must be a list of objects: {exc}"}

    try:
        anomalies = anomaly_detector.detect(frame)
    except Exception as exc:  # noqa: BLE001 - never take the API down
        log.warning("[anomaly] detection failed: %s", exc)
        return {"anomalies": [], "error": str(exc)}
    return {"anomalies": anomalies}


@app.post("/api/risk/score", response_model=schemas.RiskScoreResponse, tags=["analysis"],
          dependencies=[Depends(require_api_key)])
async def calculate_risk_score(body: schemas.RiskScoreRequest) -> dict[str, object]:
    """AI risk score (0-100) for a single project."""
    project_data = {
        "budget": body.budget,
        "location": body.location,
        "history": body.inspection_history,
        "department": body.department,
    }
    score = risk_scorer.calculate_score(project_data)
    return {
        "project_id": body.project_id,
        "risk_score": round(float(score), 2),
        "factors": risk_scorer.get_risk_factors(project_data),
    }


@app.post("/api/risk/score-batch", response_model=schemas.RiskBatchResponse, tags=["analysis"],
          dependencies=[Depends(require_api_key)])
async def calculate_risk_scores_batch(body: schemas.RiskBatchRequest) -> dict[str, object]:
    """Risk score an entire portfolio in one round-trip."""
    scores = []
    for project in body.projects:
        project_data = {
            "budget": project.get("budget", 0),
            "location": project.get("location", ""),
            "history": project.get("inspection_history", []),
            "department": project.get("department", ""),
        }
        scores.append(
            {
                "project_id": project.get("id"),
                "project_name": project.get("name"),
                "risk_score": round(float(risk_scorer.calculate_score(project_data)), 2),
                "factors": risk_scorer.get_risk_factors(project_data),
            }
        )
    return {"scores": scores, "count": len(scores)}


@app.post(
    "/api/inspections/random-assign",
    response_model=schemas.AssignmentResponse,
    tags=["analysis"],
    dependencies=[Depends(require_api_key)],
)
async def assign_random_inspections(body: schemas.RandomAssignRequest) -> dict[str, object]:
    """Randomised, risk-weighted inspection assignment with zero-conflict scoring."""
    if not body.projects or not body.officials:
        raise ValueError("Projects and officials required")
    return {
        "assignments": assigner.generate_assignments(
            projects=body.projects,
            officials=body.officials,
            num_inspections=body.num_inspections,
        )
    }


@app.post("/api/attendance/analyze", tags=["analysis"], dependencies=[Depends(require_api_key)])
async def analyze_attendance(body: schemas.AttendanceRequest) -> dict[str, object]:
    """Detect attendance irregularities from real check-in/check-out punches."""
    return analyze_attendance_records(body.records)


@app.post("/api/patterns/suspicious", tags=["analysis"], dependencies=[Depends(require_api_key)])
async def detect_suspicious_patterns(body: schemas.PatternRequest) -> dict[str, object]:
    """Detect suspicious inspection patterns, such as a single inspector dominating."""
    return {"suspicious_patterns": risk_scorer.detect_pattern_anomalies(body.patterns)}


@app.post("/api/geo/verify", response_model=schemas.GeoVerdict, tags=["analysis"],
          dependencies=[Depends(require_api_key)])
async def verify_location(body: schemas.GeoVerifyRequest) -> dict[str, object]:
    """Decide whether a report was filed from the actual project site."""
    return verify_geo(body.project, body.observation)


@app.post("/api/dashboard/stats", response_model=schemas.DashboardStats, tags=["analysis"],
          dependencies=[Depends(require_api_key)])
async def dashboard_stats(body: schemas.DashboardRequest) -> dict[str, object]:
    """Aggregate risk statistics for the admin dashboard."""
    return risk_scorer.generate_dashboard_stats(body.projects)


# --------------------------------------------------------------------- vision


@app.post("/api/vision/verify-image", tags=["vision"], dependencies=[Depends(require_api_key)])
async def verify_evidence_image(body: schemas.VisionVerifyRequest) -> dict[str, object]:
    """EXIF and screen-capture tamper checks on an uploaded evidence photo.

    The image must live inside UPLOAD_ROOT - absolute paths and traversal
    (``..``) are rejected so the endpoint cannot be used to read arbitrary
    files on the host.
    """
    image_path = body.image_path or ""
    if not image_path:
        raise ValueError("image_path is required")
    candidate = (UPLOAD_ROOT / image_path.lstrip("/\\")).resolve()
    if not candidate.is_file() or UPLOAD_ROOT not in candidate.parents:
        raise ValueError(f"image not found under the upload root: {image_path}")
    return image_verifier.verify_evidence(
        img_path=str(candidate),
        reported_lat=body.lat,
        reported_lng=body.lng,
        reported_timestamp=body.timestamp,
    )


@app.post("/api/vision/cctv-anomaly", response_model=schemas.CctvAnomalyResponse, tags=["vision"],
          dependencies=[Depends(require_api_key)])
async def detect_cctv_anomaly(body: schemas.CctvAnomalyRequest) -> dict[str, object]:
    """CCTV obstruction and tamper detection: occlusion, blackout, glare, deflection."""
    is_obstructed = body.occlusion_pct > 60.0 or body.is_covered

    anomaly_type = "normal"
    severity = "low"
    if body.status != "online":
        anomaly_type = "camera_offline"
        severity = "medium"
    elif is_obstructed:
        anomaly_type = "lens_obstruction"
        severity = "high"
    elif body.is_tilted:
        anomaly_type = "camera_angle_tamper"
        severity = "medium"

    return {
        "camera_id": body.camera_id,
        "is_anomaly": is_obstructed or body.status != "online",
        "anomaly_type": anomaly_type,
        "occlusion_pct": body.occlusion_pct,
        "detected_headcount": body.detected_headcount,
        "severity": severity,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "recommendation": (
            "Dispatch instant inspection or spot VC verification"
            if severity == "high"
            else "Monitor next sync"
        ),
    }


@app.post(
    "/api/discrepancy/attendance-index",
    response_model=schemas.DiscrepancyResponse,
    tags=["analysis"],
    dependencies=[Depends(require_api_key)],
)
async def attendance_discrepancy_index(body: schemas.DiscrepancyRequest) -> dict[str, object]:
    """Fuse AEBAS biometric punches, CCTV headcount and the sanctioned quota.

    This is the index that exposes ghost beneficiaries: a large gap between who was
    marked present and who is physically on site.
    """
    gap = body.aebas_count - body.visual_headcount
    gap_ratio = gap / max(1, body.sanctioned_capacity)

    proxy_confidence = 0.0
    verdict = "concordant"
    if gap > 5 and gap_ratio > 0.25:
        proxy_confidence = min(0.96, 0.70 + (gap_ratio * 0.4))
        verdict = "critical_proxy_irregularity"
    elif gap > 2:
        proxy_confidence = 0.65
        verdict = "moderate_variance"

    return {
        "sanctioned_capacity": body.sanctioned_capacity,
        "aebas_punched_attendance": body.aebas_count,
        "visual_cctv_headcount": body.visual_headcount,
        "ghost_beneficiary_delta": max(0, gap),
        "discrepancy_ratio": round(gap_ratio, 3),
        "proxy_attendance_verdict": verdict,
        "detection_confidence": round(proxy_confidence, 2),
        "tamper_flag": "PROXY_ATTENDANCE_FLAGGED" if proxy_confidence >= 0.75 else "NORMAL",
    }


# ------------------------------------------------------------------ narrative


def _local_narrative(context: dict, tone: str) -> str:
    """Deterministic briefing used when no LLM provider is available."""
    totals = context.get("totals") or {}
    by_status = context.get("inspections_by_status") or {}
    risky = context.get("highest_risk_projects") or []
    geo = context.get("geo_verification") or {}

    parts: list[str] = []
    projects = totals.get("projects", 0)
    inspections = totals.get("inspections", 0)
    if projects:
        parts.append(
            f"{projects} projects are under monitoring with {inspections} inspections "
            f"({by_status.get('completed', 0)} completed, {by_status.get('pending', 0)} pending, "
            f"{by_status.get('flagged', 0)} flagged)."
        )
    if totals.get("cameras"):
        parts.append(
            f"{totals.get('cameras_online', 0)} of {totals['cameras']} site cameras are online"
            + (
                f", {totals.get('cameras_offline', 0)} offline and needing attention."
                if totals.get("cameras_offline")
                else "."
            )
        )
    if risky:
        top = risky[0]
        factors = ", ".join((f.get("factor") or "") for f in (top.get("factors") or []))
        parts.append(
            f"Highest risk is {top.get('name')} at {top.get('risk_score')}/100"
            + (f", driven by {factors}." if factors else ".")
        )
    if geo.get("suspicious"):
        parts.append(
            f"{geo['suspicious']} geo-verification failure(s) were detected - the strongest "
            "available signal of proxy or fake reporting."
        )
    elif geo:
        parts.append("No geo-verification failures are currently on record.")

    anomalies = context.get("anomalies") or []
    if anomalies:
        parts.append(f"The anomaly detector flagged {len(anomalies)} inspection(s) for review.")

    return " ".join(parts) or "No monitoring data is available yet."


def _compact_context(context: dict) -> str:
    """Short, human-readable digest for the LLM.

    A reasoning model spends completion tokens thinking, so the prompt must be small and
    the budget generous - dumping the full JSON snapshot starves it of both.
    """
    totals = context.get("totals") or {}
    by_status = context.get("inspections_by_status") or {}
    geo = context.get("geo_verification") or {}
    risky = context.get("highest_risk_projects") or []
    anomalies = context.get("anomalies") or []

    lines = [
        f"Projects under monitoring: {totals.get('projects', 0)}",
        f"Inspections: {totals.get('inspections', 0)} "
        f"(completed {by_status.get('completed', 0)}, pending {by_status.get('pending', 0)}, "
        f"in progress {by_status.get('in_progress', 0)}, flagged {by_status.get('flagged', 0)})",
        f"Geo-tagged evidence records: {totals.get('evidence', 0)}",
        f"Site cameras: {totals.get('cameras_online', 0)} online, {totals.get('cameras_offline', 0)} offline",
        f"Geo-verification failures: {geo.get('suspicious', 0)} suspicious, {geo.get('mismatch', 0)} outside radius",
        f"Anomalies flagged by the detector: {len(anomalies)}",
    ]
    for project in risky[:4]:
        factors = ", ".join((f.get("factor") or "") for f in (project.get("factors") or []))
        lines.append(
            f"High risk - {project.get('name')} ({project.get('risk_score')}/100)"
            + (f"; drivers: {factors}" if factors else "")
        )
    return "\n".join(lines)


@app.post("/api/narrative", response_model=schemas.NarrativeResponse, tags=["narrative"],
          dependencies=[Depends(require_api_key)])
async def narrative(body: schemas.NarrativeRequest) -> dict[str, object]:
    """Executive briefing written by the LLM, with a deterministic local fallback.

    Always returns HTTP 200 so the dashboard degrades instead of breaking when the LLM
    provider is unreachable or no API key is configured.
    """
    text = None
    if llm.available():
        text = llm.generate(
            f"Monitoring snapshot:\n{_compact_context(body.context)}\n\nWrite the briefing now.",
            system=NARRATIVE_TONES[body.tone],
            # Reasoning models consume completion tokens before answering, so the
            # budget must be generous or the content comes back empty.
            max_tokens=1500,
            temperature=0.35,
        )

    generated_at = datetime.now(timezone.utc).isoformat()
    if text:
        return {
            "narrative": text,
            "provider": llm.provider_label(),
            "model": os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b"),
            "tone": body.tone,
            "generated_at": generated_at,
        }

    return {
        "narrative": _local_narrative(body.context, body.tone),
        "provider": "local-fallback",
        "model": None,
        "tone": body.tone,
        "generated_at": generated_at,
    }
