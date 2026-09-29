const { pool } = require('../config/db');
const geo = require('../services/geoService');
const audit = require('../services/auditService');
const aiService = require('../services/aiService');

const VALID_STATUSES = ['pending', 'in_progress', 'completed', 'flagged'];

/** Realtime broadcast helper - required lazily to avoid a circular import. */
const broadcast = (event, payload) => {
  try {
    const { io } = require('../index');
    if (io) io.emit(event, payload);
  } catch (err) {
    // realtime is best-effort and must never fail the request
  }
};


exports.assignInspection = async (req, res) => {
  const { project_id, assigned_to, scheduled_date, ai_risk_score } = req.body;

  try {
    const result = await pool.query(
      'INSERT INTO inspections (project_id, assigned_to, scheduled_date, ai_risk_score) VALUES ($1, $2, $3, $4) RETURNING *',
      [project_id, assigned_to, scheduled_date, ai_risk_score]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getMyInspections = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, p.name as project_name, p.location
       FROM inspections i
       JOIN projects p ON i.project_id = p.id
       WHERE i.assigned_to = $1
       ORDER BY i.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAllInspections = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, p.name as project_name, u.name as official_name
       FROM inspections i
       JOIN projects p ON i.project_id = p.id
       JOIN users u ON i.assigned_to = u.id
       ORDER BY i.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateInspectionStatus = async (req, res) => {
  const { status, notes, completed_date, lat, lng } = req.body;

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  try {
    const before = await pool.query(
      'SELECT * FROM inspections WHERE id = $1 AND assigned_to = $2',
      [req.params.id, req.user.id]
    );
    if (!before.rows.length) {
      return res.status(404).json({ message: 'Inspection not found or not assigned to you' });
    }
    const previousStatus = before.rows[0].status;

    const result = await pool.query(
      'UPDATE inspections SET status = $1, notes = $2, completed_date = $3 WHERE id = $4 AND assigned_to = $5 RETURNING *',
      [status, notes != null ? notes : before.rows[0].notes, completed_date || new Date(), req.params.id, req.user.id]
    );
    const inspection = result.rows[0];
    const flags = [];

    // Geo-verification: where the official actually is when reporting progress.
    // This is the mechanism that reduces fake reporting / proxy functioning.
    let geoVerification = null;
    if (lat != null && lng != null) {
      const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [inspection.project_id]);
      const project = projectResult.rows[0];
      geoVerification = geo.verify(project ? project.geo_coords : null, { lat, lng });

      if (geoVerification.verdict !== 'verified') {
        flags.push(
          geoVerification.verdict === 'suspicious' ? 'possible_proxy_reporting' : 'outside_expected_radius'
        );
        await audit.record({
          actor: req.user,
          action: `geo_verification.${geoVerification.verdict}`,
          entity: 'inspection',
          entityId: inspection.id,
          meta: JSON.stringify(geoVerification),
        });

        // A report filed far away from the site is escalated for review automatically.
        if (geoVerification.verdict === 'suspicious') {
          await pool.query('UPDATE inspections SET status = $1 WHERE id = $2', ['flagged', inspection.id]);
          inspection.status = 'flagged';
          flags.push('auto_flagged');
          broadcast('alert', {
            severity: 'high',
            message: `Inspection #${inspection.id} auto-flagged: ${geoVerification.explanation}`,
            meta: { inspection_id: inspection.id, official: req.user.name },
          });
        }
      }
    }

    await audit.record({
      actor: req.user,
      action: 'inspection.status_changed',
      entity: 'inspection',
      entityId: inspection.id,
      meta: {
        from: previousStatus,
        to: inspection.status,
        geo: geoVerification ? geoVerification.verdict : 'not_provided',
      },
    });

    broadcast('inspection:update', { inspection, status: inspection.status, flags });

    res.json({ inspection, geo_verification: geoVerification, flags });
  } catch (err) {
    console.error('Update inspection status error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

/** Standalone location check - the app calls this before/while capturing evidence. */
exports.geoVerifyInspection = async (req, res) => {
  const { lat, lng } = req.body;

  try {
    const result = await pool.query('SELECT * FROM inspections WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Inspection not found' });

    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [result.rows[0].project_id]);
    const project = projectResult.rows[0];
    const verification = geo.verify(project ? project.geo_coords : null, { lat, lng });

    // Optional AI wording; the local verdict stays authoritative.
    const ai = await aiService.geoVerify(project, { inspection_id: result.rows[0].id, lat, lng });
    if (ai && ai.explanation) verification.ai_explanation = ai.explanation;

    res.json(verification);
  } catch (err) {
    console.error('Geo verify error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getInspectionById = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT i.*, p.name as project_name, p.location, p.geo_coords, p.department as scheme, u.name as official_name
       FROM inspections i
       JOIN projects p ON i.project_id = p.id
       JOIN users u ON i.assigned_to = u.id
       WHERE i.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Inspection not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

/** Scheme-specific checklist templates based on DoSJE guidelines */
const SCHEME_CHECKLISTS = {
  avyay: [
    { id: 'resident_headcount', title: 'Resident Headcount Match: Physical count matches approved quota', weight: 25 },
    { id: 'dietary_nutrition', title: 'Nutrition Standard: Clean kitchen, weekly approved menu displayed', weight: 15 },
    { id: 'medical_log', title: 'Medical Attendance: Registered doctor visit verified in logbook', weight: 20 },
    { id: 'hygiene_bedding', title: 'Living Quarters: Sanitized rooms, clean bedding, hot water', weight: 15 },
    { id: 'emergency_medicines', title: 'Medicine Stock: First aid kit & essential chronic illness drugs stocked', weight: 15 },
    { id: 'recreational_counseling', title: 'Recreation & Well-being: TV room, reading materials, counseling logs', weight: 10 },
  ],
  napddr: [
    { id: 'doctor_duty', title: 'Medical Staff: MBBS Doctor / Psychiatrist verified on active duty', weight: 25 },
    { id: 'detox_ward_safety', title: 'Detox Ward Security: 24/7 nursing and secure patient observation', weight: 20 },
    { id: 'medicine_register', title: 'Schedule-H Register: Controlled medication entries reconciled without gap', weight: 20 },
    { id: 'psychosocial_counseling', title: 'Counseling Protocols: Individual and group therapy session records', weight: 15 },
    { id: 'relapse_tracking', title: 'Post-Discharge Registry: Relapse follow-up documented for alumni', weight: 10 },
    { id: 'nutrition_hygiene', title: 'Sanitation & Diet: Clean kitchen, balanced food, hygienic washrooms', weight: 10 },
  ],
  sipda: [
    { id: 'barrier_free_ramp', title: 'Accessibility Ramps: CPWD standard 1:12 gradient with dual handrails', weight: 25 },
    { id: 'accessible_toilets', title: 'Barrier-Free Restrooms: Grab bars, wide doorways, wheel-chair turning radius', weight: 20 },
    { id: 'assistive_devices', title: 'Assistive Tech Kits: Screen readers, Braille aids, hearing loop functional', weight: 20 },
    { id: 'trainer_ratio', title: 'Certified Special Educators: Recognized RCI trainer ratio maintained', weight: 15 },
    { id: 'biometric_attendance', title: 'AEBAS Verification: Biometric logs match live classroom headcount', weight: 15 },
    { id: 'placement_records', title: 'Vocational Placement: Job link documentation and certificates current', weight: 5 },
  ],
};

exports.getInspectionChecklist = async (req, res) => {
  try {
    const memoryStore = require('../config/memoryStore');
    const inspection = await pool.query('SELECT * FROM inspections WHERE id = $1', [req.params.id]);
    if (!inspection.rows.length) return res.status(404).json({ message: 'Inspection not found' });

    const project = await pool.query('SELECT * FROM projects WHERE id = $1', [inspection.rows[0].project_id]);
    const scheme = ((project.rows[0] && project.rows[0].department) || 'avyay').toLowerCase();

    const template = SCHEME_CHECKLISTS[scheme] || SCHEME_CHECKLISTS.avyay;
    const existing = (memoryStore.state.checklists || []).find((c) => Number(c.inspection_id) === Number(req.params.id));

    res.json({
      scheme: scheme.toUpperCase(),
      items: template,
      saved_checks: existing ? existing.checks : {},
      compliance_score: existing ? existing.compliance_score : null,
      voice_remarks: existing ? existing.voice_remarks : null,
    });
  } catch (err) {
    console.error('getChecklist error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.saveInspectionChecklist = async (req, res) => {
  const { checks, voice_remarks } = req.body; // checks: { [itemId]: boolean }
  try {
    const memoryStore = require('../config/memoryStore');
    const inspection = await pool.query('SELECT * FROM inspections WHERE id = $1', [req.params.id]);
    if (!inspection.rows.length) return res.status(404).json({ message: 'Inspection not found' });

    const project = await pool.query('SELECT * FROM projects WHERE id = $1', [inspection.rows[0].project_id]);
    const scheme = ((project.rows[0] && project.rows[0].department) || 'avyay').toLowerCase();
    const template = SCHEME_CHECKLISTS[scheme] || SCHEME_CHECKLISTS.avyay;

    let score = 0;
    template.forEach((item) => {
      if (checks && checks[item.id]) score += item.weight;
    });

    memoryStore.state.checklists = memoryStore.state.checklists || [];
    const existingIdx = memoryStore.state.checklists.findIndex((c) => Number(c.inspection_id) === Number(req.params.id));

    const record = {
      inspection_id: Number(req.params.id),
      scheme: scheme.toUpperCase(),
      checks: checks || {},
      compliance_score: score,
      voice_remarks: voice_remarks || null,
      updated_at: new Date().toISOString(),
    };

    if (existingIdx >= 0) {
      memoryStore.state.checklists[existingIdx] = record;
    } else {
      memoryStore.state.checklists.push(record);
    }

    await audit.record({
      actor: req.user,
      action: 'checklist.submitted',
      entity: 'inspection',
      entityId: Number(req.params.id),
      meta: { scheme, compliance_score: score, voice_remarks_present: Boolean(voice_remarks) },
    });

    res.json({ message: 'Scheme checklist saved', record });
  } catch (err) {
    console.error('saveChecklist error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

