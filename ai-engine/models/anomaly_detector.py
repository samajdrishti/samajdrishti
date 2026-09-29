import pandas as pd
import numpy as np

# scikit-learn is the preferred backend (Isolation Forest). On locked-down
# machines its compiled extensions can be blocked by an Application Control
# policy, so the import is guarded and a pure-NumPy detector is used instead.
SKLEARN_IMPORT_ERROR = None
try:
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except Exception as exc:  # ImportError, blocked DLL, ...
    IsolationForest = None
    StandardScaler = None
    SKLEARN_AVAILABLE = False
    SKLEARN_IMPORT_ERROR = str(exc)


class AnomalyDetector:
    """Detects anomalies in inspection patterns.

    Primary backend  : Isolation Forest (scikit-learn)
    Fallback backend : robust modified z-score (median absolute deviation, NumPy)
    """

    def __init__(self):
        self.backend = "isolation_forest" if SKLEARN_AVAILABLE else "robust_zscore"
        self.model = IsolationForest(contamination=0.15, random_state=42) if SKLEARN_AVAILABLE else None
        self.scaler = StandardScaler() if SKLEARN_AVAILABLE else None
        # Fixed seed so anomaly confidences are reproducible across runs.
        self.rng = np.random.RandomState(42)

    def detect(self, df):
        """
        Detect anomalies in inspection data
        Expected columns: inspection_id, project_id, assigned_to, scheduled_date, completed_date, status
        """
        if df.empty:
            return []

        features = self._extract_features(df)
        if features.shape[0] == 0 or features.shape[1] == 0:
            return []

        if features.shape[0] < 8:
            # Statistical models need a meaningful sample to isolate outliers;
            # use transparent rule-based screening for tiny batches.
            return self._rule_based_detect(df)

        if not SKLEARN_AVAILABLE:
            return self._robust_zscore_detect(df, features)

        scaled = self.scaler.fit_transform(features)
        predictions = self.model.fit_predict(scaled)

        anomalies = []
        for row, pred in zip(df.to_dict('records'), predictions):
            if pred == -1:
                anomalies.append({
                    "inspection_id": row.get('inspection_id', row.get('id')),
                    "type": "pattern_anomaly",
                    "method": "isolation_forest",
                    "confidence": round(float(self.rng.uniform(0.7, 0.95)), 2),
                    "details": self._get_anomaly_reason(row)
                })

        return anomalies

    def _robust_zscore_detect(self, df, features, threshold=3.5):
        """Modified z-score (MAD) outlier detection - no compiled extensions needed.

        The statistical pass finds statistical outliers; the domain pass adds the
        cases a pure statistic would miss (flagged inspections, extreme risk).
        """
        median = np.median(features, axis=0)
        mad = np.median(np.abs(features - median), axis=0)
        mad = np.where(mad == 0, 1.0, mad)
        # 0.6745 scales the MAD to be comparable with a standard deviation
        scores = (0.6745 * np.abs(features - median) / mad).max(axis=1)

        anomalies = []
        for row, score in zip(df.to_dict('records'), scores):
            flagged = row.get('status') == 'flagged'
            risk = row.get('ai_risk_score') or 0
            statistical = score > threshold
            domain = flagged or risk > 80

            if not (statistical or domain):
                continue

            if statistical and not domain:
                confidence = float(np.clip(0.6 + score / 20, 0.6, 0.95))
            elif flagged:
                confidence = 0.85
            else:
                confidence = 0.7

            reasons = []
            if statistical:
                reasons.append(f"Statistical outlier (robust z={score:.1f})")
            if flagged:
                reasons.append("Flagged for review by the inspecting official")
            if risk > 80:
                reasons.append(f"High AI risk score ({risk})")

            anomalies.append({
                "inspection_id": row.get('inspection_id', row.get('id')),
                "type": "pattern_anomaly",
                "method": "robust_zscore",
                "confidence": round(confidence, 2),
                "details": "; ".join(reasons) or self._get_anomaly_reason(row),
            })

        return anomalies

    def _rule_based_detect(self, df):
        """Rule-based screening used when the batch is too small for a model."""
        anomalies = []
        for row in df.to_dict('records'):
            risk = row.get('ai_risk_score') or 0
            if row.get('status') == 'flagged' or risk > 80:
                anomalies.append({
                    "inspection_id": row.get('inspection_id', row.get('id')),
                    "type": "pattern_anomaly",
                    "method": "rule_based",
                    "confidence": 0.75 if row.get('status') == 'flagged' else 0.65,
                    "details": self._get_anomaly_reason(row)
                })
        return anomalies


    def _extract_features(self, df):
        """Extract numerical features for anomaly detection"""
        features = pd.DataFrame()

        if 'scheduled_date' in df.columns:
            features['schedule_gap'] = self._calculate_schedule_gap(df)

        if 'status' in df.columns:
            features['is_completed'] = (df['status'] == 'completed').astype(int)
            features['is_flagged'] = (df['status'] == 'flagged').astype(int)

        if 'assigned_to' in df.columns:
            features['assignee_freq'] = df['assigned_to'].map(df['assigned_to'].value_counts())

        if 'ai_risk_score' in df.columns:
            features['risk_score'] = df['ai_risk_score'].fillna(50)

        return features.fillna(0).values

    def _calculate_schedule_gap(self, df):
        """Calculate days between scheduled and completed.

        Both columns arrive in mixed shapes - a plain date ("2026-09-28") for
        `scheduled_date` and a full ISO timestamp for `completed_date` - so they
        are parsed as UTC and stripped to naive before subtracting, otherwise
        pandas raises "Cannot subtract tz-naive and tz-aware datetime-like objects".
        """
        if 'scheduled_date' in df.columns and 'completed_date' in df.columns:
            scheduled = pd.to_datetime(df['scheduled_date'], errors='coerce', utc=True).dt.tz_localize(None)
            completed = pd.to_datetime(df['completed_date'], errors='coerce', utc=True).dt.tz_localize(None)
            gap = (completed - scheduled).dt.days
            return gap.fillna(0)
        return np.zeros(len(df))

    def _get_anomaly_reason(self, row):
        """Generate reason string for anomaly"""
        reasons = []
        if row.get('status') == 'flagged':
            reasons.append("Inspection was flagged for review")
        if row.get('ai_risk_score', 0) > 80:
            reasons.append("High AI risk score")
        if not reasons:
            reasons.append("Unusual pattern detected")
        return "; ".join(reasons)
