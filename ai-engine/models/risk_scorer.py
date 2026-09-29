import numpy as np
from datetime import datetime, timedelta
from collections import defaultdict

class RiskScorer:
    """AI-powered risk scoring for projects and official performance"""

    def __init__(self):
        self.risk_weights = {
            'budget': 0.3,
            'history': 0.25,
            'location': 0.2,
            'department': 0.15,
            'time': 0.1,
        }

    @staticmethod
    def _history(project_data):
        """Inspection history as a list of records.

        Callers occasionally send a count instead of the records themselves, so
        anything that is not a list of mappings is coerced rather than iterated:
        scoring must degrade to "no history" instead of raising.
        """
        history = project_data.get('history', [])
        if isinstance(history, dict):
            return [history]
        if not isinstance(history, (list, tuple)):
            return []
        return [entry for entry in history if isinstance(entry, dict)]

    def calculate_score(self, project_data):
        """Calculate overall risk score (0-100) for a project"""
        score = 0

        # Budget risk (higher budget = higher risk)
        budget = project_data.get('budget', 0)
        if budget > 1000000:
            score += 30
        elif budget > 500000:
            score += 20
        elif budget > 100000:
            score += 10

        # Historical inspection risk
        history = self._history(project_data)
        if history:
            completed = sum(1 for h in history if h.get('status') == 'completed')
            flagged = sum(1 for h in history if h.get('status') == 'flagged')
            if flagged > 0:
                score += 25 * min(flagged, 3)
            if completed < len(history) * 0.5:
                score += 15

        # Location-based risk
        location = project_data.get('location', '').lower()
        boundary_areas = ['remote', 'hill', 'border', 'rural']
        if any(keyword in location for keyword in boundary_areas):
            score += 15

        # Department historical risk
        dept_risk = {
            'public_works': 25,
            'education': 10,
            'health': 5,
            'social_welfare': 15,
            'urban_development': 20,
        }
        score += dept_risk.get(project_data.get('department', ''), 0)

        return min(score, 100)

    def get_risk_factors(self, project_data):
        """Return detailed risk breakdown"""
        factors = []

        budget = project_data.get('budget', 0)
        if budget > 1000000:
            factors.append({"factor": "High budget allocation", "weight": 30})

        history = self._history(project_data)
        flagged_count = sum(1 for h in history if h.get('status') == 'flagged')
        if flagged_count > 0:
            factors.append({"factor": f"{flagged_count} previous flagged inspections", "weight": 25 * min(flagged_count, 3)})

        location = project_data.get('location', '').lower()
        boundary_areas = ['remote', 'hill', 'border', 'rural']
        if any(keyword in location for keyword in boundary_areas):
            factors.append({"factor": f"Remote location risk", "weight": 15})

        return factors

    def detect_attendance_irregularities(self, attendance_records):
        """Detect patterns in attendance that suggest irregularities"""
        irregularities = []

        if not attendance_records:
            return irregularities

        official_dates = defaultdict(set)
        for record in attendance_records:
            official = record.get('official_id')
            date = record.get('date')
            if official and date:
                official_dates[official].add(date)

        for official_id, dates in official_dates.items():
            if len(dates) < 10:
                irregularities.append({
                    "official_id": official_id,
                    "type": "low_attendance",
                    "days_worked": len(dates),
                    "confidence": 0.8
                })

        return irregularities

    def detect_pattern_anomalies(self, patterns):
        """Detect suspicious inspection patterns (e.g., always same inspector, always same time)"""
        suspicious = []

        if not patterns:
            return suspicious

        # Detect if same inspector always gets assigned
        inspector_counts = defaultdict(int)
        for p in patterns:
            inspector_counts[p.get('inspector_id', '')] += 1

        total = len(patterns)
        for inspector, count in inspector_counts.items():
            if count > total * 0.8:
                suspicious.append({
                    "type": "assignment_bias",
                    "inspector_id": inspector,
                    "assignments": count,
                    "total": total,
                    "confidence": round(count / total, 2)
                })

        # Detect time clustering (all inspections at same time)
        times = [p.get('scheduled_time', '') for p in patterns if p.get('scheduled_time')]
        if times:
            early_count = sum(1 for t in times if t.startswith('08') or t.startswith('09'))
            if early_count > len(times) * 0.7:
                suspicious.append({
                    "type": "time_clustering",
                    "description": "70%+ inspections scheduled in same time slot",
                    "confidence": round(early_count / len(times), 2)
                })

        return suspicious

    def generate_dashboard_stats(self, projects):
        """Generate AI insights for dashboard"""
        total = len(projects)
        scores = [p.get('risk_score', 0) for p in projects]

        high_risk = sum(1 for s in scores if s > 70)
        medium_risk = sum(1 for s in scores if 40 <= s <= 70)
        low_risk = sum(1 for s in scores if s < 40)

        avg_score = round(np.mean(scores), 2) if scores else 0

        recommendations = []
        if high_risk > 0:
            recommendations.append(f"Prioritize {high_risk} high-risk projects for immediate inspection")
        if medium_risk > 0:
            recommendations.append(f"Schedule routine monitoring for {medium_risk} medium-risk projects")

        return {
            "total_projects": total,
            "high_risk_count": high_risk,
            "medium_risk_count": medium_risk,
            "low_risk_count": low_risk,
            "average_risk_score": avg_score,
            "recommendations": recommendations
        }
