const { pool, getMode } = require('../config/db');
const aiService = require('../services/aiService');
const auditService = require('../services/auditService');
const reportController = require('./reportController');
const notifications = require('./notificationController');

/**
 * Build the payload expected by the AI engine's risk scorer. The scorer reasons
 * over budget, location, department and past inspection outcomes, so the project
 * row is joined with its own inspection history.
 */
const buildRiskPayload = (projects, inspections) => {
  const historyByProject = inspections.reduce((acc, i) => {
    acc[i.project_id] = acc[i.project_id] || [];
    acc[i.project_id].push({ date: i.completed_date || i.scheduled_date, status: i.status });
    return acc;
  }, {});

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    budget: Number(p.budget) || 0,
    location: p.location || '',
    department: p.department || '',
    inspection_history: historyByProject[p.id] || [],
  }));
};

/** Attach an AI risk score to every project (falls back to 50 when AI is down). */
const withRiskScores = async (projects, inspections) => {
  const payload = buildRiskPayload(projects, inspections);
  const scores = await aiService.scoreProjectsBatch(payload);
  const scoreByProject = scores.reduce((acc, s) => {
    acc[s.project_id] = s;
    return acc;
  }, {});

  return projects.map((p) => {
    const scored = scoreByProject[p.id];
    return {
      ...p,
      risk_score: scored ? scored.risk_score : 50,
      risk_factors: scored ? scored.factors : [],
    };
  });
};

exports.getDashboard = async (req, res) => {
  try {
    const projectsResult = await pool.query('SELECT * FROM projects');
    const inspectionsResult = await pool.query('SELECT * FROM inspections');
    const evidenceResult = await pool.query('SELECT * FROM evidence');
    const officialsResult = await pool.query("SELECT id, name, role FROM users WHERE role = 'official'");

    const projects = await withRiskScores(projectsResult.rows, inspectionsResult.rows);
    const inspections = inspectionsResult.rows;

    let aiStats = null;
    try {
      aiStats = await aiService.getDashboardStats(
        projects.map((p) => ({ id: p.id, name: p.name, risk_score: p.risk_score }))
      );
    } catch (err) {
      console.error('AI stats error:', err.message);
    }

    const officials = officialsResult.rows;

    const stats = {
      totalProjects: projects.length,
      totalInspections: inspections.length,
      totalEvidence: evidenceResult.rows.length,
      totalOfficials: officials.length,
      pendingInspections: inspections.filter(i => i.status === 'pending').length,
      inProgressInspections: inspections.filter(i => i.status === 'in_progress').length,
      completedInspections: inspections.filter(i => i.status === 'completed').length,
      flaggedInspections: inspections.filter(i => i.status === 'flagged').length,
      dataMode: getMode(),
      aiOnline: Boolean(aiStats && aiStats.total_projects !== undefined),
      aiStats: aiStats || {
        high_risk_count: 0,
        medium_risk_count: 0,
        low_risk_count: 0,
        average_risk_score: 0,
        recommendations: []
      }
    };

    const projectById = projects.reduce((acc, p) => { acc[p.id] = p; return acc; }, {});
    const officialById = officials.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});

    const recentInspections = [...inspections]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10)
      .map(i => ({
        ...i,
        project_name: (projectById[i.project_id] || {}).name || null,
        official_name: (officialById[i.assigned_to] || {}).name || null,
      }));

    const highRiskProjects = [...projects]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 6)
      .map(p => ({
        id: p.id,
        name: p.name,
        location: p.location,
        status: p.status,
        budget: Number(p.budget) || 0,
        risk_score: p.risk_score,
        risk_factors: p.risk_factors,
      }));

    res.json({ stats, recentInspections, highRiskProjects, projects, officials });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAIInsights = async (req, res) => {
  try {
    const inspectionsResult = await pool.query(`
      SELECT i.*, p.name as project_name, u.name as official_name
      FROM inspections i
      JOIN projects p ON i.project_id = p.id
      JOIN users u ON i.assigned_to = u.id
      ORDER BY i.created_at DESC LIMIT 100
    `);

    const anomalies = await aiService.detectAnomalies(inspectionsResult.rows);
    res.json({ anomalies });
  } catch (err) {
    console.error('AI insights error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.runAIAssignment = async (req, res) => {
  const { num_inspections, persist = true } = req.body || {};

  try {
    const projectsResult = await pool.query('SELECT * FROM projects');
    const inspectionsResult = await pool.query('SELECT * FROM inspections');
    const officialsResult = await pool.query("SELECT id, name, role FROM users WHERE role = 'official'");

    if (!projectsResult.rows.length || !officialsResult.rows.length) {
      return res.status(400).json({ message: 'Projects and officials are required for AI assignment' });
    }

    // Risk-weighting needs the AI score, otherwise every project weighs the same.
    const projects = await withRiskScores(projectsResult.rows, inspectionsResult.rows);

    const assignments = await aiService.assignInspections(
      projects,
      officialsResult.rows,
      num_inspections || 5
    );

    if (!assignments.length) {
      return res.status(502).json({ message: 'AI engine unavailable - no assignments generated' });
    }

    // Persist the AI output as real pending inspections so field officials see
    // them in the mobile app, and notify each official.
    const created = [];
    if (persist) {
      for (const a of assignments) {
        const result = await pool.query(
          'INSERT INTO inspections (project_id, assigned_to, scheduled_date, ai_risk_score) VALUES ($1, $2, $3, $4) RETURNING *',
          [a.project_id, a.official_id, a.scheduled_date, a.ai_risk_score]
        );
        created.push(result.rows[0]);

        await notifications.createNotification(
          a.official_id,
          `New inspection assigned: ${a.project_name || `Project #${a.project_id}`} on ${a.scheduled_date} at ${a.scheduled_time}.`,
          a.ai_risk_score > 70 ? 'alert' : 'info'
        );
      }
    }

    res.json({
      assignments: assignments.map((a, idx) => ({
        ...a,
        inspection_id: created[idx] ? created[idx].id : null,
      })),
      persisted: Boolean(persist),
      created: created.length,
    });
  } catch (err) {
    console.error('AI assignment error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAIStatus = async (req, res) => {
  const health = await aiService.health();
  res.json({ aiEngine: health, dataMode: getMode() });
};

/** Everything the narrative generator needs, in one compact object. */
const buildNarrativeContext = async () => {
  const [projectsResult, inspectionsResult, evidenceResult, camerasResult, auditRows, officialsResult] =
    await Promise.all([
      pool.query('SELECT * FROM projects'),
      pool.query('SELECT * FROM inspections'),
      pool.query('SELECT * FROM evidence'),
      pool.query('SELECT * FROM cameras'),
      auditService.list({ entity: 'inspection', limit: 500 }),
      pool.query("SELECT id, name, role FROM users WHERE role = 'official'"),
    ]);

  const projects = await withRiskScores(projectsResult.rows, inspectionsResult.rows);
  const inspections = inspectionsResult.rows;
  const cameras = camerasResult.rows;

  const byStatus = inspections.reduce((acc, i) => {
    acc[i.status] = (acc[i.status] || 0) + 1;
    return acc;
  }, {});

  const geoEvents = auditRows.filter((row) => String(row.action).startsWith('geo_verification'));
  const geoCounts = geoEvents.reduce((acc, row) => {
    const verdict = String(row.action).split('.').pop();
    acc[verdict] = (acc[verdict] || 0) + 1;
    return acc;
  }, {});

  const anomalies = await aiService.detectAnomalies(
    inspections.map((i) => ({
      id: i.id,
      status: i.status,
      scheduled_date: i.scheduled_date,
      completed_date: i.completed_date,
      assigned_to: i.assigned_to,
      ai_risk_score: i.ai_risk_score,
    }))
  );

  return {
    department: 'Ministry of Social Justice & Empowerment',
    totals: {
      projects: projects.length,
      inspections: inspections.length,
      evidence: evidenceResult.rows.length,
      officials: officialsResult.rows.length,
      cameras: cameras.length,
      cameras_online: cameras.filter((c) => c.status === 'online').length,
      cameras_offline: cameras.filter((c) => c.status !== 'online').length,
    },
    inspections_by_status: byStatus,
    geo_verification: geoCounts,
    highest_risk_projects: [...projects]
      .sort((a, b) => b.risk_score - a.risk_score)
      .slice(0, 5)
      .map((p) => ({
        name: p.name,
        location: p.location,
        budget: p.budget,
        risk_score: p.risk_score,
        factors: p.risk_factors,
      })),
    anomalies,
  };
};

/**
 * Executive summary written by the LLM (Groq free tier when configured).
 * Always returns 200 - with a deterministic local summary if the engine is down.
 */
exports.getNarrative = async (req, res) => {
  try {
    const tone = ['executive', 'field', 'technical'].includes(req.query.tone) ? req.query.tone : 'executive';
    const context = await buildNarrativeContext();

    const ai = await aiService.narrative(context, tone);
    if (ai && ai.narrative) {
      return res.json({
        narrative: ai.narrative,
        provider: ai.provider,
        model: ai.model || null,
        generated_at: ai.generated_at || new Date().toISOString(),
        tone,
        data: context,
      });
    }

    const { totals, inspections_by_status: byStatus, highest_risk_projects: risky, geo_verification: geoChecks } = context;
    const narrative = [
      `${totals.projects} projects are under monitoring with ${totals.inspections} inspections ` +
        `(${byStatus.completed || 0} completed, ${byStatus.pending || 0} pending, ${byStatus.flagged || 0} flagged).`,
      `${totals.cameras_online} of ${totals.cameras} site cameras are online` +
        `${totals.cameras_offline ? `, ${totals.cameras_offline} offline and need attention` : ''}.`,
      risky.length
        ? `Highest risk: ${risky[0].name} (${risky[0].risk_score}/100)${risky[0].factors && risky[0].factors.length ? ` - ${risky[0].factors.map((f) => f.factor).join(', ')}` : ''}.`
        : 'No project is currently scoring high risk.',
      geoChecks.suspicious
        ? `${geoChecks.suspicious} geo-verification failure(s) were detected, which is the strongest signal of proxy or fake reporting.`
        : 'No geo-verification failures recorded.',
    ].join(' ');

    res.json({
      narrative,
      provider: 'local-fallback',
      model: null,
      generated_at: new Date().toISOString(),
      tone,
      data: context,
    });
  } catch (err) {
    console.error('Narrative error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Cross-module alert feed for the back office. */
exports.getAlerts = async (req, res) => {
  try {
    const [camerasResult, reports] = await Promise.all([
      pool.query('SELECT * FROM cameras'),
      reportController.buildAllReports(),
    ]);

    const flaggedReports = reports.filter((report) => report.flags.length > 0);
    const reportAlerts = flaggedReports.map((report) => ({
      severity: report.geo_verification.verdict === 'suspicious' ? 'high' : 'medium',
      type: `report_${report.geo_verification.verdict}`,
      message: `Inspection #${report.id} (${report.project ? report.project.name : 'project'}): ${report.flags.join(', ')}`,
      meta: {
        inspection_id: report.id,
        geo_verdict: report.geo_verification.verdict,
        distance_meters: report.geo_verification.distance_meters,
      },
    }));

    const cameraAlerts = camerasResult.rows
      .filter((c) => c.status !== 'online')
      .map((c) => ({
        severity: 'medium',
        type: 'camera_offline',
        message: 'A site camera is offline',
        meta: { camera_id: c.id, name: c.name, last_seen: c.last_seen },
      }));

    const alerts = [...reportAlerts, ...cameraAlerts];
    res.json({ alerts, total: alerts.length, generated_at: new Date().toISOString() });
  } catch (err) {
    console.error('Alerts error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};
