"""
Sample data generator for testing the AI engine
"""
import random
import json
from datetime import datetime, timedelta

def generate_sample_projects(count=10):
    """Generate sample project data"""
    departments = ['public_works', 'education', 'health', 'social_welfare', 'urban_development']
    locations = ['Zone 1', 'Zone 2', 'Zone 3', 'Remote Area', 'Border Region']

    projects = []
    base_date = datetime.now()

    for i in range(count):
        project = {
            "id": i + 1,
            "name": f"Project_{i+1}",
            "department": random.choice(departments),
            "location": random.choice(locations),
            "budget": random.choice([50000, 150000, 500000, 1200000, 2000000]),
            "start_date": (base_date - timedelta(days=random.randint(30, 365))).strftime('%Y-%m-%d'),
            "risk_score": round(random.uniform(20, 95), 2),
            "inspection_history": generate_history(random.randint(0, 5))
        }
        projects.append(project)

    return projects

def generate_history(count):
    """Generate random inspection history"""
    history = []
    for _ in range(count):
        history.append({
            "date": (datetime.now() - timedelta(days=random.randint(1, 365))).strftime('%Y-%m-%d'),
            "status": random.choice(['completed', 'completed', 'completed', 'flagged']),
            "issues_found": random.randint(0, 5)
        })
    return history

def generate_sample_officials(count=5):
    """Generate sample officials"""
    names = ["Rajesh Kumar", "Priya Sharma", "Amit Patel", "Sunita Devi", "Ramesh Chandra",
             "Meena Kumari", "Dinesh Gupta", "Kavita Joshi"]

    officials = []
    for i in range(count):
        officials.append({
            "id": i + 1,
            "name": random.choice(names),
            "department": random.choice(['public_works', 'education', 'health']),
            "experience_years": random.randint(1, 20)
        })

    return officials

def generate_sample_inspections(count=50):
    """Generate sample inspection data for anomaly detection"""
    inspections = []
    statuses = ['completed', 'completed', 'completed', 'in_progress', 'flagged', 'pending']

    for i in range(count):
        scheduled = datetime.now() - timedelta(days=random.randint(1, 30))
        completed = scheduled + timedelta(days=random.randint(0, 10)) if random.random() > 0.2 else None

        inspection = {
            "id": i + 1,
            "project_id": random.randint(1, 10),
            "inspection_id": f"INSP_{i+1:04d}",
            "assigned_to": random.choice([1, 2, 3, 4, 5]),
            "scheduled_date": scheduled.strftime('%Y-%m-%d'),
            "completed_date": completed.strftime('%Y-%m-%d') if completed else None,
            "status": random.choice(statuses),
            "ai_risk_score": round(random.uniform(10, 95), 2) if random.random() > 0.3 else None
        }
        inspections.append(inspection)

    return inspections

if __name__ == '__main__':
    print("=== Sample Project Data ===")
    projects = generate_sample_projects(5)
    print(json.dumps(projects, indent=2))

    print("\n=== Sample Officials ===")
    officials = generate_sample_officials(3)
    print(json.dumps(officials, indent=2))

    print("\n=== Sample Inspections ===")
    inspections = generate_sample_inspections(10)
    print(json.dumps(inspections, indent=2))

    print("\nSample data generated successfully!")
