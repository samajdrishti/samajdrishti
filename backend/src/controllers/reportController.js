const { pool } = require('../config/db');
const geo = require('../services/geoService');
const audit = require('../services/auditService');

const inr = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;

/**
 * Geo-tagged inspection reports.
 *
 * A report is assembled at read time from the inspection, its evidence, the
 * attendance record of the official and the audit trail, then annotated with the
 * flags a supervisor actually acts on (proxy reporting, unverified evidence,
 * early completion, ...).
 */
const loadContext = async () => {
  const [projectsResult, usersResult, inspectionsResult, evidenceResult, auditRows, attendanceResult] =
    await Promise.all([
      pool.query('SELECT * FROM projects'),
      pool.query('SELECT id, name, role, department FROM users'),
      pool.query('SELECT * FROM inspections'),
      pool.query('SELECT * FROM evidence'),
      audit.list({ entity: 'inspection', limit: 500 }),
      pool.query('SELECT * FROM attendance ORDER BY id DESC'),
    ]);

  return {
    projectsById: projectsResult.rows.reduce((acc, p) => { acc[p.id] = p; return acc; }, {}),
    usersById: usersResult.rows.reduce((acc, u) => { acc[u.id] = u; return acc; }, {}),
    inspections: inspectionsResult.rows,
    evidence: evidenceResult.rows,
    auditRows,
    attendance: attendanceResult.rows,
  };
};

const resolveGeoVerification = (inspection, project, evidenceRows, auditRows) => {
  // 1) A verdict recorded when the official reported the status is authoritative.
  const recorded = auditRows.find(
    (row) => Number(row.entity_id) === Number(inspection.id) && String(row.action).startsWith('geo_verification')
  );
  if (recorded && recorded.meta) {
    try {
      return { ...JSON.parse(recorded.meta), source: 'status_update' };
    } catch (err) {
      // fall through to evidence-based verification
    }
  }

  // 2) Otherwise fall back to where the evidence itself was captured.
  if (evidenceRows.length) {
    return { ...geo.verify(project ? project.geo_coords : null, evidenceRows[0].geo_coords), source: 'evidence' };
  }
  return { ...geo.verify(project ? project.geo_coords : null, null), source: 'none' };
};

const buildFlags = ({ inspection, verification, evidenceRows, project }) => {
  const flags = [];
  if (verification.verdict === 'suspicious') flags.push('possible_proxy_reporting');
  if (verification.verdict === 'mismatch') flags.push('outside_expected_radius');
  if (inspection.status === 'flagged') flags.push('flagged_by_official');
  if (evidenceRows.length && !evidenceRows.some((e) => e.verified)) flags.push('evidence_unverified');
  if (!evidenceRows.length && ['completed', 'flagged'].includes(inspection.status)) flags.push('no_evidence_captured');
  if (inspection.completed_date && inspection.scheduled_date && inspection.completed_date < inspection.scheduled_date) {
    flags.push('completed_before_schedule');
  }
  if (Number(inspection.ai_risk_score) > 70) flags.push('high_risk_project');
  if (project && project.status !== 'active' && inspection.status === 'completed') flags.push('project_not_active');
  return flags;
};

const buildReport = (inspection, context) => {
  const project = context.projectsById[inspection.project_id] || null;
  const official = context.usersById[inspection.assigned_to] || null;
  const supervisor = context.usersById[inspection.supervisor_id] || null;
  const evidenceRows = context.evidence
    .filter((e) => Number(e.inspection_id) === Number(inspection.id))
    .map((e) => ({ ...e, geo_coords: geo.normaliseCoords(e.geo_coords) }));
  const geoAudit = context.auditRows.filter((row) => Number(row.entity_id) === Number(inspection.id));
  const verification = resolveGeoVerification(inspection, project, evidenceRows, geoAudit);
  const attendance = context.attendance.filter(
    (a) => Number(a.official_id) === Number(inspection.assigned_to) && a.date === inspection.scheduled_date
  );

  return {
    id: inspection.id,
    status: inspection.status,
    scheduled_date: inspection.scheduled_date,
    completed_date: inspection.completed_date,
    notes: inspection.notes,
    ai_risk_score: inspection.ai_risk_score,
    created_at: inspection.created_at,
    project: project
      ? {
          id: project.id,
          name: project.name,
          location: project.location,
          department: project.department,
          budget: project.budget,
          status: project.status,
          geo_coords: geo.normaliseCoords(project.geo_coords),
        }
      : null,
    official: official ? { id: official.id, name: official.name, department: official.department } : null,
    supervisor: supervisor ? { id: supervisor.id, name: supervisor.name } : null,
    evidence: evidenceRows,
    evidence_count: evidenceRows.length,
    verified_evidence_count: evidenceRows.filter((e) => e.verified).length,
    geo_verification: verification,
    flags: buildFlags({ inspection, verification, evidenceRows, project }),
    attendance_context: attendance.map((a) => ({
      date: a.date,
      check_in: a.check_in,
      check_out: a.check_out,
      mode: a.mode,
    })),
    audit: geoAudit.map((a) => ({ action: a.action, actor: a.actor_name, at: a.created_at, meta: a.meta })),
  };
};
/** Full report objects for every inspection - reused by the admin alert feed. */
exports.buildAllReports = async () => {
  const context = await loadContext();
  return context.inspections.map((inspection) => buildReport(inspection, context));
};

exports.list = async (req, res) => {
  try {
    const context = await loadContext();
    let inspections = [...context.inspections].sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
    if (req.query.project_id) {
      inspections = inspections.filter((i) => String(i.project_id) === String(req.query.project_id));
    }
    if (req.query.status) {
      inspections = inspections.filter((i) => i.status === req.query.status);
    }

    let reports = inspections.map((inspection) => buildReport(inspection, context));
    if (req.query.verified === 'false') reports = reports.filter((r) => r.geo_verification.verdict !== 'verified');
    if (req.query.verified === 'true') reports = reports.filter((r) => r.geo_verification.verdict === 'verified');
    if (req.query.flagged === 'true') reports = reports.filter((r) => r.flags.length > 0);

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    res.json(
      reports.slice(0, limit).map((report) => ({
        id: report.id,
        status: report.status,
        project_name: report.project ? report.project.name : null,
        project_location: report.project ? report.project.location : null,
        official_name: report.official ? report.official.name : null,
        scheduled_date: report.scheduled_date,
        completed_date: report.completed_date,
        ai_risk_score: report.ai_risk_score,
        evidence_count: report.evidence_count,
        verified_evidence_count: report.verified_evidence_count,
        geo_verdict: report.geo_verification.verdict,
        distance_meters: report.geo_verification.distance_meters,
        flags: report.flags,
      }))
    );
  } catch (err) {
    console.error('Report list error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getOne = async (req, res) => {
  try {
    const context = await loadContext();
    const inspection = context.inspections.find((i) => Number(i.id) === Number(req.params.id));
    if (!inspection) return res.status(404).json({ message: 'Report not found' });
    res.json({ report: buildReport(inspection, context) });
  } catch (err) {
    console.error('Report detail error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.share = async (req, res) => {
  try {
    const context = await loadContext();
    const inspection = context.inspections.find((i) => Number(i.id) === Number(req.params.id));
    if (!inspection) return res.status(404).json({ message: 'Report not found' });

    const report = buildReport(inspection, context);
    const lines = [
      'SAMAJ DRISHTI - GEO-TAGGED INSPECTION REPORT',
      'Ministry of Social Justice & Empowerment',
      '',
      `Report ID         : ${report.id}`,
      `Project           : ${report.project ? report.project.name : 'N/A'}`,
      `Location          : ${report.project ? report.project.location : 'N/A'}`,
      `Budget            : ${report.project ? inr(report.project.budget) : 'N/A'}`,
      `Inspecting officer: ${report.official ? report.official.name : 'Unassigned'}`,
      `Scheduled         : ${report.scheduled_date || 'N/A'}`,
      `Completed         : ${report.completed_date || 'Not completed'}`,
      `Status            : ${report.status}`,
      `AI risk score     : ${report.ai_risk_score ?? 'N/A'} / 100`,
      '',
      `Location check    : ${String(report.geo_verification.verdict).toUpperCase()} - ${report.geo_verification.explanation}`,
      `Evidence          : ${report.verified_evidence_count}/${report.evidence_count} verified`,
      `Flags             : ${report.flags.length ? report.flags.join(', ') : 'none'}`,
    ];
    if (report.notes) lines.push('', `Officer notes     : ${report.notes}`);

    await audit.record({
      actor: req.user,
      action: 'report.shared',
      entity: 'inspection',
      entityId: report.id,
      meta: { flags: report.flags.length },
    });
    res.json({ text: lines.join('\n'), report });
  } catch (err) {
    console.error('Report share error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

