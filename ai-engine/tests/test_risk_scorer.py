"""Unit tests for the risk scorer model."""

import pytest
from models.risk_scorer import RiskScorer


class TestRiskScorer:
    def test_initialization_sets_weights(self):
        scorer = RiskScorer()
        assert "budget" in scorer.risk_weights
        assert scorer.risk_weights["budget"] == 0.3
    
    def test_high_budget_adds_risk(self):
        scorer = RiskScorer()
        score = scorer.calculate_score({"budget": 1_500_000, "location": "test"})
        assert score >= 30
    
    def test_remote_location_adds_risk(self):
        scorer = RiskScorer()
        score = scorer.calculate_score({"budget": 100_000, "location": "remote village"})
        assert score >= 15
    
    def test_flagged_history_adds_risk(self):
        scorer = RiskScorer()
        score = scorer.calculate_score({
            "budget": 100_000,
            "location": "city",
            "history": [
                {"status": "completed"},
                {"status": "flagged"},
            ]
        })
        assert score >= 25
    
    def test_score_is_bounded_at_100(self):
        scorer = RiskScorer()
        score = scorer.calculate_score({
            "budget": 10_000_000,
            "location": "remote border area",
            "history": [{"status": "flagged"}] * 5,
            "department": "public_works"
        })
        assert score <= 100
    
    def test_get_risk_factors_returns_list(self):
        scorer = RiskScorer()
        factors = scorer.get_risk_factors({"budget": 2_000_000, "location": "remote"})
        assert isinstance(factors, list)
    
    def test_get_risk_factors_includes_budget_factor_for_high_budget(self):
        scorer = RiskScorer()
        factors = scorer.get_risk_factors({"budget": 1_500_000})
        factor_names = [f["factor"] for f in factors]
        assert any("budget" in name.lower() for name in factor_names)


class TestRiskScorerEdgeCases:
    def test_empty_project_has_zero_risk(self):
        scorer = RiskScorer()
        score = scorer.calculate_score({})
        assert score == 0
    
    def test_none_history_treated_as_empty(self):
        scorer = RiskScorer()
        score = scorer.calculate_score({
            "budget": 100_000,
            "location": "city",
            "history": None
        })
        assert score < 50
    
    def test_dict_history_treated_as_list(self):
        scorer = RiskScorer()
        score = scorer.calculate_score({
            "budget": 100_000,
            "location": "city",
            "history": {"status": "flagged"}
        })
        assert score >= 25
    
    def test_detect_attendance_irregularities_finds_low_attendance(self):
        scorer = RiskScorer()
        records = [
            {"official_id": 1, "date": "2026-09-01"},
            {"official_id": 1, "date": "2026-09-02"},
        ]
        irregularities = scorer.detect_attendance_irregularities(records)
        assert isinstance(irregularities, list)
    
    def test_detect_pattern_anomalies_finds_assignment_bias(self):
        scorer = RiskScorer()
        patterns = [
            {"inspector_id": 1, "scheduled_time": "09:00"} for _ in range(10)
        ]
        suspicious = scorer.detect_pattern_anomalies(patterns)
        assert isinstance(suspicious, list)
    
    def test_generate_dashboard_stats_returns_valid_structure(self):
        scorer = RiskScorer()
        projects = [
            {"risk_score": 80},
            {"risk_score": 50},
            {"risk_score": 20},
        ]
        stats = scorer.generate_dashboard_stats(projects)
        assert stats["total_projects"] == 3
        assert stats["high_risk_count"] == 1
        assert stats["medium_risk_count"] == 1
        assert stats["low_risk_count"] == 1
        assert stats["average_risk_score"] == 50.0
        assert isinstance(stats["recommendations"], list)