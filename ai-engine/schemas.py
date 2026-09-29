"""Request and response models for the Samaj Drishti AI engine.

The request bodies that carry inspection / project / attendance rows are typed as
``list[dict[str, Any]]`` on purpose: they arrive straight out of the database, where
columns legitimately differ between rows (``scheduled_date`` is a date while
``completed_date`` is a timestamp, an unknown key means "no value yet"). Rejecting
those with a schema error would be stricter than the data warrants, and the detectors
already handle missing keys.

Everything the engine *returns* is typed, so the response contract is enforced here
rather than discovered at runtime.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Passthrough(BaseModel):
    """A model whose extra keys are preserved rather than stripped.

    The detectors and the assigner add fields over time (anti_predictability_hash,
    zero_conflict_score, ...). The web clients render whatever arrives, so a response
    model must not silently swallow a field just because the schema predates it.
    """

    model_config = ConfigDict(extra="allow")

# --------------------------------------------------------------------- requests


class AnomalyRequest(BaseModel):
    """A batch of inspections to screen for anomalous patterns."""

    inspections: list[dict[str, Any]] = Field(default_factory=list)

    # An empty or absent list is a legitimate "nothing to screen" request, not an error.
    @field_validator("inspections", mode="before")
    @classmethod
    def _coerce(cls, value: Any) -> list[dict[str, Any]]:
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("inspections must be a list of objects")
        return value


class RiskScoreRequest(BaseModel):
    project_id: int | str | None = None
    budget: float = 0
    location: str = ""
    department: str = ""
    inspection_history: list[dict[str, Any]] = Field(default_factory=list)


class RiskBatchRequest(BaseModel):
    projects: list[dict[str, Any]] = Field(default_factory=list)


class RandomAssignRequest(BaseModel):
    projects: list[dict[str, Any]] = Field(default_factory=list)
    officials: list[dict[str, Any]] = Field(default_factory=list)
    num_inspections: int = Field(default=5, ge=1, le=200)


class AttendanceRequest(BaseModel):
    records: list[dict[str, Any]] = Field(default_factory=list)


class PatternRequest(BaseModel):
    patterns: list[dict[str, Any]] = Field(default_factory=list)


class GeoVerifyRequest(BaseModel):
    project: dict[str, Any] = Field(default_factory=dict)
    observation: dict[str, Any] = Field(default_factory=dict)


class VisionVerifyRequest(BaseModel):
    image_path: str = ""
    lat: float | None = None
    lng: float | None = None
    timestamp: str | None = None


class CctvAnomalyRequest(BaseModel):
    camera_id: int | str | None = None
    occlusion_pct: float = 0
    detected_headcount: int | None = None
    status: str = "online"
    is_covered: bool = False
    is_tilted: bool = False


class DiscrepancyRequest(BaseModel):
    sanctioned_capacity: int = Field(default=50, ge=0)
    aebas_count: int = Field(default=0, ge=0)
    visual_headcount: int = Field(default=0, ge=0)


class DashboardRequest(BaseModel):
    projects: list[dict[str, Any]] = Field(default_factory=list)


class NarrativeRequest(BaseModel):
    context: dict[str, Any] = Field(default_factory=dict)
    tone: str = "executive"

    @field_validator("tone")
    @classmethod
    def _known_tone(cls, value: str) -> str:
        allowed = ("executive", "field", "technical")
        return value if value in allowed else "executive"


# -------------------------------------------------------------------- responses


class HealthResponse(BaseModel):
    service: str
    status: str
    models: list[str]
    anomaly_backend: str
    llm_provider: str
    llm_available: bool
    capabilities: list[str]

class RiskFactor(BaseModel):
    factor: str
    weight: float


class RiskScoreResponse(Passthrough):
    project_id: int | str | None = None
    risk_score: float
    factors: list[RiskFactor] = Field(default_factory=list)


class BatchScore(Passthrough):
    project_id: int | str | None = None
    project_name: str | None = None
    risk_score: float
    factors: list[RiskFactor] = Field(default_factory=list)


class RiskBatchResponse(BaseModel):
    scores: list[BatchScore]
    count: int


class Anomaly(Passthrough):
    inspection_id: int | str | None = None
    type: str = "pattern_anomaly"
    method: str = "rule_based"
    confidence: float = 0.0
    details: str = ""


class AnomalyResponse(BaseModel):
    anomalies: list[Anomaly]
    error: str | None = None


class Assignment(Passthrough):
    project_id: int | str | None = None
    project_name: str | None = None
    official_id: int | str | None = None
    official_name: str | None = None
    scheduled_date: str = ""
    scheduled_time: str = ""
    ai_risk_score: float | None = None


class AssignmentResponse(BaseModel):
    assignments: list[Assignment]


class GeoVerdict(BaseModel):
    distance_meters: float | None = None
    within_radius: bool
    verdict: Literal["verified", "mismatch", "suspicious", "unknown"]
    severity: Literal["low", "medium", "high"]
    explanation: str
    radius_meters: int


class DashboardStats(BaseModel):
    total_projects: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    average_risk_score: float
    recommendations: list[str]


class NarrativeResponse(BaseModel):
    narrative: str
    provider: str
    model: str | None = None
    tone: str
    generated_at: str


class CctvAnomalyResponse(BaseModel):
    camera_id: int | str | None = None
    is_anomaly: bool
    anomaly_type: str
    occlusion_pct: float
    detected_headcount: int | None = None
    severity: str
    timestamp: str
    recommendation: str


class DiscrepancyResponse(BaseModel):
    sanctioned_capacity: int
    aebas_punched_attendance: int
    visual_cctv_headcount: int
    ghost_beneficiary_delta: int
    discrepancy_ratio: float
    proxy_attendance_verdict: str
    detection_confidence: float
    tamper_flag: str


class ErrorResponse(BaseModel):
    """Every failure the API returns has the same shape, as the API contract requires."""

    error: str
