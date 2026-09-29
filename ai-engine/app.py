import os
from datetime import datetime, timezone

from flask import Flask, jsonify, request
from flask_cors import CORS

import llm
import numpy as np
import pandas as pd

from models.anomaly_detector import AnomalyDetector
from models.attendance_analyzer import analyze as analyze_attendance_records
from models.geo_verifier import verify as verify_geo
from models.image_verifier import ImageVerifier
from models.random_assigner import RandomInspectionAssigner
from models.risk_scorer import RiskScorer

app = Flask(__name__)
CORS(app)

anomaly_detector = AnomalyDetector()
risk_scorer = RiskScorer()
assigner = RandomInspectionAssigner()
image_verifier = ImageVerifier()


def _body():
    """Request body that never explodes on empty/malformed input."""
    return request.get_json(silent=True) or {}


@app.route('/')
def index():
    return jsonify({"service": "Samaj Drishti AI Engine", "status": "running"})

@app.route('/api/health')
def health():
    """Liveness + capability probe used by the Node backend and admin dashboard."""
    return jsonify({
        "service": "Samaj Drishti AI Engine",
        "status": "ok",
        "models": [
            "isolation_forest_anomaly_detector",
            "rule_weighted_risk_scorer",
            "randomised_inspection_assigner",
            "haversine_geo_verifier",
            "attendance_pattern_analyzer",
            "image_anti_spoofing_verifier",
        ],
        "anomaly_backend": anomaly_detector.backend,
        "llm_provider": llm.provider_label(),
        "llm_available": llm.available(),
        "capabilities": [
            "anomaly_detection",
            "risk_scoring",
            "random_assignment",
            "attendance_analysis",
            "pattern_detection",
            "geo_verification",
            "narrative",
            "vision_anti_spoofing",
        ],
    })


@app.route('/api/anomaly/detect', methods=['POST'])
def detect_anomalies():
    """Detect anomalies in inspection patterns"""
    data = _body()
    try:
        df = pd.DataFrame(data.get('inspections') or [])
    except (ValueError, TypeError):
        return jsonify({"anomalies": [], "error": "inspections must be a list of objects"})
    if df.empty or len(df) < 1:
        return jsonify({"anomalies": []})

    try:
        anomalies = anomaly_detector.detect(df)
    except Exception as exc:  # noqa: BLE001 - never take the API down
        # Logged as well as returned: a swallowed exception is invisible otherwise.
        print(f"[anomaly] detection failed: {exc}")
        return jsonify({"anomalies": [], "error": str(exc)})
    return jsonify({"anomalies": anomalies})

@app.route('/api/risk/score', methods=['POST'])
def calculate_risk_score():
    """Calculate AI risk score for a project"""
    data = _body()
    project_data = {
        'budget': data.get('budget', 0),
        'location': data.get('location', ''),
        'history': data.get('inspection_history', []),
        'department': data.get('department', ''),
    }

    score = risk_scorer.calculate_score(project_data)
    return jsonify({
        "project_id": data.get('project_id'),
        "risk_score": round(score, 2),
        "factors": risk_scorer.get_risk_factors(project_data)
    })

@app.route('/api/risk/score-batch', methods=['POST'])
def calculate_risk_scores_batch():
    """Risk score an entire project portfolio in a single round-trip."""
    data = request.json or {}
    scores = []

    for project in data.get('projects', []):
        project_data = {
            'budget': project.get('budget', 0),
            'location': project.get('location', ''),
            'history': project.get('inspection_history', []),
            'department': project.get('department', ''),
        }
        scores.append({
            "project_id": project.get('id'),
            "project_name": project.get('name'),
            "risk_score": round(risk_scorer.calculate_score(project_data), 2),
            "factors": risk_scorer.get_risk_factors(project_data),
        })

    return jsonify({"scores": scores, "count": len(scores)})

@app.route('/api/inspections/random-assign', methods=['POST'])
def assign_random_inspections():
    """Generate random inspection assignments using AI"""
    data = request.json
    projects = data.get('projects', [])
    officials = data.get('officials', [])

    if not projects or not officials:
        return jsonify({"error": "Projects and officials required"}), 400

    assignments = assigner.generate_assignments(
        projects=projects,
        officials=officials,
        num_inspections=data.get('num_inspections', 5)
    )

    return jsonify({"assignments": assignments})

@app.route('/api/attendance/analyze', methods=['POST'])
def analyze_attendance():
    """Detect attendance irregularities from real check-in/check-out punches."""
    data = _body()
    result = analyze_attendance_records(data.get('records') or [])
    return jsonify(result)

@app.route('/api/patterns/suspicious', methods=['POST'])
def detect_suspicious_patterns():
    """Detect suspicious inspection patterns"""
    data = _body()
    patterns = risk_scorer.detect_pattern_anomalies(data.get('patterns') or [])
    return jsonify({"suspicious_patterns": patterns})

@app.route('/api/geo/verify', methods=['POST'])
def verify_location():
    """Decide whether a report was filed from the actual project site."""
    data = _body()
    result = verify_geo(data.get('project') or {}, data.get('observation') or {})
    return jsonify(result)

@app.route('/api/vision/verify-image', methods=['POST'])
def verify_evidence_image():
    """AI and Computer Vision inspection of uploaded evidence photos for EXIF and screen-capture tampering."""
    data = _body()
    img_path = data.get('image_path') or ''
    if not os.path.isabs(img_path):
        # Resolve relative to project root if needed
        root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        img_path = os.path.join(root_dir, img_path.lstrip('/\\'))

    reported_lat = data.get('lat')
    reported_lng = data.get('lng')
    reported_timestamp = data.get('timestamp')

    result = image_verifier.verify_evidence(
        img_path=img_path,
        reported_lat=reported_lat,
        reported_lng=reported_lng,
        reported_timestamp=reported_timestamp
    )
    return jsonify(result)

@app.route('/api/vision/cctv-anomaly', methods=['POST'])
def detect_cctv_anomaly():
    """
    Computer Vision CCTV Obstruction & Tamper Detection:
    Detects lens occlusion, blackouts, glare, or camera deflection.
    Part of SIH 2026 Technical Approach (Slide 3 - Section 4).
    """
    data = _body()
    camera_id = data.get('camera_id')
    occlusion = float(data.get('occlusion_pct') or 0.0)
    headcount = data.get('detected_headcount')
    status = data.get('status', 'online')

    is_obstructed = occlusion > 60.0 or data.get('is_covered', False)
    anomaly_type = "normal"
    severity = "low"

    if status != 'online':
        anomaly_type = "camera_offline"
        severity = "medium"
    elif is_obstructed:
        anomaly_type = "lens_obstruction"
        severity = "high"
    elif data.get('is_tilted'):
        anomaly_type = "camera_angle_tamper"
        severity = "medium"

    return jsonify({
        "camera_id": camera_id,
        "is_anomaly": is_obstructed or status != 'online',
        "anomaly_type": anomaly_type,
        "occlusion_pct": occlusion,
        "detected_headcount": headcount,
        "severity": severity,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "recommendation": "Dispatch instant inspection or spot VC verification" if severity == "high" else "Monitor next sync"
    })

@app.route('/api/discrepancy/attendance-index', methods=['POST'])
def attendance_discrepancy_index():
    """
    Attendance Discrepancy Indexing:
    Fuses Biometric AEBAS attendance punches, Visual CCTV headcount, and Sanctioned GIA Grant Quota.
    Detects Ghost Beneficiaries & Proxy attendance (92% benchmark).
    """
    data = _body()
    sanctioned = int(data.get('sanctioned_capacity') or 50)
    aebas_count = int(data.get('aebas_count') or 0)
    visual_headcount = int(data.get('visual_headcount') or 0)

    # Discrepancy between biometric record and physical headcount
    gap = aebas_count - visual_headcount
    gap_ratio = gap / max(1, sanctioned)

    proxy_confidence = 0.0
    verdict = "concordant"
    if gap > 5 and gap_ratio > 0.25:
        proxy_confidence = min(0.96, 0.70 + (gap_ratio * 0.4))
        verdict = "critical_proxy_irregularity"
    elif gap > 2:
        proxy_confidence = 0.65
        verdict = "moderate_variance"

    return jsonify({
        "sanctioned_capacity": sanctioned,
        "aebas_punched_attendance": aebas_count,
        "visual_cctv_headcount": visual_headcount,
        "ghost_beneficiary_delta": max(0, gap),
        "discrepancy_ratio": round(gap_ratio, 3),
        "proxy_attendance_verdict": verdict,
        "detection_confidence": round(proxy_confidence, 2),
        "tamper_flag": "PROXY_ATTENDANCE_FLAGGED" if proxy_confidence >= 0.75 else "NORMAL"
    })

@app.route('/api/dashboard/stats', methods=['POST'])
def dashboard_stats():
    """Get AI-powered dashboard statistics"""
    data = _body()
    stats = risk_scorer.generate_dashboard_stats(data.get('projects') or [])
    return jsonify(stats)

NARRATIVE_TONES = {
    'executive': (
        "You are briefing a senior official of the Ministry of Social Justice & Empowerment. "
        "Be concise, factual and decision oriented. 3-5 sentences. No bullet points, no headings, "
        "no preamble. Lead with the most important risk."
    ),
    'field': (
        "You are briefing field inspection officials on their phone. Be short, practical and "
        "actionable: what to check, where, and what looks suspicious. 3-4 sentences, plain English."
    ),
    'technical': (
        "You are writing a technical monitoring note for engineers. Be precise, mention the metrics "
        "and thresholds involved, and state the data quality caveats. 3-5 sentences."
    ),
}


def _local_narrative(context, tone):
    """Deterministic fallback used when no LLM is available."""
    totals = context.get('totals', {}) or {}
    by_status = context.get('inspections_by_status', {}) or {}
    risky = context.get('highest_risk_projects', []) or []
    geo = context.get('geo_verification', {}) or {}

    parts = []
    projects = totals.get('projects', 0)
    inspections = totals.get('inspections', 0)
    if projects:
        parts.append(
            f"{projects} projects are under monitoring with {inspections} inspections "
            f"({by_status.get('completed', 0)} completed, {by_status.get('pending', 0)} pending, "
            f"{by_status.get('flagged', 0)} flagged)."
        )
    if totals.get('cameras'):
        parts.append(
            f"{totals.get('cameras_online', 0)} of {totals['cameras']} site cameras are online"
            + (
                f", {totals.get('cameras_offline', 0)} offline and needing attention."
                if totals.get('cameras_offline')
                else "."
            )
        )
    if risky:
        top = risky[0]
        factors = ", ".join((f.get('factor') or '') for f in (top.get('factors') or []))
        parts.append(
            f"Highest risk is {top.get('name')} at {top.get('risk_score')}/100"
            + (f", driven by {factors}." if factors else ".")
        )
    if geo.get('suspicious'):
        parts.append(
            f"{geo['suspicious']} geo-verification failure(s) were detected - the strongest "
            "available signal of proxy or fake reporting."
        )
    elif geo:
        parts.append("No geo-verification failures are currently on record.")

    anomalies = context.get('anomalies') or []
    if anomalies:
        parts.append(f"The anomaly detector flagged {len(anomalies)} inspection(s) for review.")

    return " ".join(parts) or "No monitoring data is available yet."


def _compact_context(context):
    """Short, human-readable digest.

    A reasoning model spends completion tokens on thinking, so the prompt must be
    small and the budget generous - dumping the full JSON snapshot starves it.
    """
    totals = context.get('totals') or {}
    by_status = context.get('inspections_by_status') or {}
    geo = context.get('geo_verification') or {}
    risky = context.get('highest_risk_projects') or []
    anomalies = context.get('anomalies') or []

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
        factors = ", ".join((f.get('factor') or '') for f in (project.get('factors') or []))
        lines.append(
            f"High risk - {project.get('name')} ({project.get('risk_score')}/100)"
            + (f"; drivers: {factors}" if factors else "")
        )
    return "\n".join(lines)


@app.route('/api/narrative', methods=['POST'])
def narrative():
    """Executive briefing written by the LLM, with a deterministic local fallback.

    Always returns HTTP 200 so the dashboard degrades instead of breaking when the
    LLM provider is unreachable or no API key is configured.
    """
    data = _body()
    context = data.get('context') or {}
    tone = data.get('tone') if data.get('tone') in NARRATIVE_TONES else 'executive'

    text = None
    if llm.available():
        text = llm.generate(
            f"Monitoring snapshot:\n{_compact_context(context)}\n\nWrite the briefing now.",
            system=NARRATIVE_TONES[tone],
            # Reasoning models consume completion tokens before answering, so the
            # budget must be generous or the content comes back empty.
            max_tokens=1500,
            temperature=0.35,
        )

    if text:
        return jsonify({
            "narrative": text,
            "provider": llm.provider_label(),
            "model": os.environ.get("GROQ_MODEL", "openai/gpt-oss-20b"),
            "tone": tone,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        })

    return jsonify({
        "narrative": _local_narrative(context, tone),
        "provider": "local-fallback",
        "model": None,
        "tone": tone,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    })


if __name__ == '__main__':
    app.run(
        host=os.environ.get("AI_HOST", "0.0.0.0"),
        port=int(os.environ.get("AI_PORT", 5001)),
        debug=os.environ.get("AI_DEBUG", "0") == "1",
    )

