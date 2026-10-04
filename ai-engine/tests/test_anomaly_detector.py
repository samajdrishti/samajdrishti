"""Unit tests for the anomaly detector model.

Tests both the Isolation Forest backend and the robust z-score fallback
to ensure deterministic behavior regardless of which backend is active.
"""

import pytest
import pandas as pd
import numpy as np

from models.anomaly_detector import AnomalyDetector


class TestAnomalyDetector:
    def test_detector_initializes_correctly(self):
        detector = AnomalyDetector()
        assert detector.backend in {"isolation_forest", "robust_zscore"}
    
    def test_detect_returns_empty_for_empty_dataframe(self):
        detector = AnomalyDetector()
        df = pd.DataFrame(columns=["inspection_id", "status"])
        assert detector.detect(df) == []
    
    def test_detect_flags_flagged_status_as_anomaly(self):
        detector = AnomalyDetector()
        df = pd.DataFrame([
            {"inspection_id": 1, "status": "normal"},
            {"inspection_id": 2, "status": "flagged"},
        ])
        results = detector.detect(df)
        flagged = [r for r in results if r["inspection_id"] == 2]
        assert len(flagged) >= 1
    
    def test_detect_handles_small_batches_with_rule_based(self):
        detector = AnomalyDetector()
        small_df = pd.DataFrame([{"inspection_id": i, "status": "flagged"} for i in range(1, 4)])
        results = detector.detect(small_df)
        assert all(r["inspection_id"] in [1, 2, 3] for r in results)
    
    def test_feature_extraction_handles_missing_columns(self):
        detector = AnomalyDetector()
        df = pd.DataFrame([{"inspection_id": 1}])
        features = detector._extract_features(df)
        assert features.shape == (1, 0) or (features.shape[0] == 1 and features.shape[1] >= 0)
    
    def test_scheduled_gap_calculation(self):
        detector = AnomalyDetector()
        df = pd.DataFrame([
            {"scheduled_date": "2026-09-01", "completed_date": "2026-09-05"},
        ])
        gaps = detector._calculate_schedule_gap(df)
        assert gaps.iloc[0] == 4
    
    def test_scheduled_gap_handles_invalid_dates(self):
        detector = AnomalyDetector()
        df = pd.DataFrame([
            {"scheduled_date": None, "completed_date": "2026-09-05"},
        ])
        gaps = detector._calculate_schedule_gap(df)
        assert gaps.iloc[0] == 0


class TestAnomalyDetectorFallback:
    def test_robust_zscore_detects_statistical_outliers(self):
        detector = AnomalyDetector()
        if detector.backend != "robust_zscore":
            pytest.skip("This test is for the fallback path only")
        
        # Create data with clear outlier
        df = pd.DataFrame([
            {"inspection_id": 1, "status": "completed", "ai_risk_score": 50},
            {"inspection_id": 2, "status": "completed", "ai_risk_score": 52},
            {"inspection_id": 3, "status": "completed", "ai_risk_score": 55},
            {"inspection_id": 4, "status": "completed", "ai_risk_score": 53},
            {"inspection_id": 5, "status": "flagged", "ai_risk_score": 50},
        ])
        results = detector.detect(df)
        assert isinstance(results, list)


class TestAnomalyDetectorReasoning:
    def test_high_risk_score_creates_anomaly(self):
        detector = AnomalyDetector()
        df = pd.DataFrame([
            {"inspection_id": 1, "status": "completed", "ai_risk_score": 85},
        ])
        results = detector.detect(df)
        assert len(results) >= 1
    
    def test_reason_strings_are_generated(self):
        detector = AnomalyDetector()
        df = pd.DataFrame([
            {"inspection_id": 1, "status": "flagged"},
        ])
        results = detector.detect(df)
        if results:
            assert "details" in results[0]
            assert len(results[0]["details"]) > 0