const axios = require('axios');
const geo = require('./geoService');

const AI_BASE_URL = process.env.AI_ENGINE_URL || 'http://localhost:5001';

class AIService {
  async calculateRiskScore(projectId, projectData) {
    try {
      const { data } = await axios.post(`${AI_BASE_URL}/api/risk/score`, {
        project_id: projectId,
        ...projectData
      });
      return data;
    } catch (err) {
      console.error('AI risk score error:', err.message);
      return { risk_score: 50, factors: [] };
    }
  }

  /**
   * Batch risk scoring - one AI round-trip for the whole project portfolio.
   * Used by the dashboard and by the random-assignment engine so projects are
   * risk-weighted instead of defaulting to a flat score.
   */
  async scoreProjectsBatch(projects) {
    if (!projects || !projects.length) return [];
    try {
      const { data } = await axios.post(`${AI_BASE_URL}/api/risk/score-batch`, { projects });
      return data.scores || [];
    } catch (err) {
      console.error('AI batch risk score error:', err.message);
      return [];
    }
  }

  /** Liveness probe for the Python AI engine (surfaced in the admin settings page). */
  async health() {
    try {
      const { data } = await axios.get(`${AI_BASE_URL}/api/health`, { timeout: 3000 });
      return { online: true, url: AI_BASE_URL, ...data };
    } catch (err) {
      return { online: false, url: AI_BASE_URL, error: err.message };
    }
  }

  async detectAnomalies(inspections) {
    try {
      const { data } = await axios.post(`${AI_BASE_URL}/api/anomaly/detect`, {
        inspections
      });
      return data.anomalies;
    } catch (err) {
      console.error('AI anomaly detection error:', err.message);
      return [];
    }
  }

  async assignInspections(projects, officials, numInspections = 5) {
    try {
      const { data } = await axios.post(`${AI_BASE_URL}/api/inspections/random-assign`, {
        projects,
        officials,
        num_inspections: numInspections
      });
      return data.assignments;
    } catch (err) {
      console.error('AI assignment error:', err.message);
      return [];
    }
  }

  async getDashboardStats(projects) {
    try {
      const { data } = await axios.post(`${AI_BASE_URL}/api/dashboard/stats`, {
        projects
      });
      return data;
    } catch (err) {
      console.error('AI dashboard stats error:', err.message);
      return null;
    }
  }

  async analyzeAttendance(records) {
    try {
      const { data } = await axios.post(`${AI_BASE_URL}/api/attendance/analyze`, {
        records
      });
      return data.irregularities;
    } catch (err) {
      console.error('AI attendance analysis error:', err.message);
      return [];
    }
  }

  async detectSuspiciousPatterns(patterns) {
    try {
      const { data } = await axios.post(`${AI_BASE_URL}/api/patterns/suspicious`, {
        patterns
      });
      return data.suspicious_patterns;
    } catch (err) {
      console.error('AI pattern detection error:', err.message);
      return [];
    }
  }

  /**
   * AI-assisted geo verification wording. The deterministic verdict always comes
   * from geoService; this only enriches the explanation, so a failure here is
   * non-fatal.
   */
  async geoVerify(project, observation) {
    const coords = geo.normaliseCoords(project && project.geo_coords);
    if (!coords) return null;

    try {
      const { data } = await axios.post(
        `${AI_BASE_URL}/api/geo/verify`,
        {
          project: {
            id: project.id,
            name: project.name,
            lat: coords.lat,
            lng: coords.lng,
            radius_meters: geo.DEFAULT_RADIUS_M,
          },
          observation,
        },
        { timeout: 8000 }
      );
      return data;
    } catch (err) {
      console.error('AI geo verify error:', err.message);
      return null;
    }
  }

  /** LLM narrative (Groq free tier when a key is configured, local fallback otherwise). */
  async narrative(context, tone = 'executive') {
    try {
      const { data } = await axios.post(
        `${AI_BASE_URL}/api/narrative`,
        { context, tone },
        { timeout: 45000 }
      );
      return data;
    } catch (err) {
      console.error('AI narrative error:', err.message);
      return null;
    }
  }
}

module.exports = new AIService();
