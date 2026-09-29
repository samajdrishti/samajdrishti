const { pool } = require('../config/db');
const memoryStore = require('../config/memoryStore');
const auditService = require('../services/auditService');

/**
 * Action Taken Report (ATR) Adjudication Controller
 *
 * Implements the DoSJE compliance workflow:
 * MONITOR -> RECORD DEFICIENCY -> ISSUE ATR DEADLINE -> NGO RESPONDS WITH PROOF -> PMU ADJUDICATION -> ESCALATE / CLOSE
 * Part of SIH 2026 PS-26095 Technical Approach (Slide 3 - Section 5 & 6)
 */

exports.getATRs = async (req, res) => {
  try {
    const atrs = memoryStore.state.atrs || [];
    res.json(atrs);
  } catch (err) {
    console.error('getATRs error:', err.message);
    res.status(500).json({ message: 'Server error retrieving ATR records' });
  }
};

exports.getATRById = async (req, res) => {
  try {
    const atrs = memoryStore.state.atrs || [];
    const item = atrs.find((a) => Number(a.id) === Number(req.params.id));
    if (!item) return res.status(404).json({ message: 'Action Taken Report not found' });
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.submitNGOReply = async (req, res) => {
  const { id } = req.params;
  const { ngo_reply, corrective_evidence_url } = req.body;

  try {
    const atrs = memoryStore.state.atrs || [];
    const item = atrs.find((a) => Number(a.id) === Number(id));
    if (!item) return res.status(404).json({ message: 'ATR record not found' });

    item.ngo_reply = ngo_reply || item.ngo_reply;
    item.corrective_evidence_url = corrective_evidence_url || item.corrective_evidence_url;
    item.status = 'under_review';
    item.updated_at = new Date().toISOString();

    await auditService.record({
      actor: req.user,
      action: 'atr.ngo_reply_submitted',
      entity: 'atr',
      entityId: item.id,
      meta: { project_id: item.project_id, status: item.status },
    });

    res.json({ message: 'Corrective action taken report submitted successfully', atr: item });
  } catch (err) {
    console.error('submitNGOReply error:', err.message);
    res.status(500).json({ message: 'Server error updating ATR' });
  }
};

exports.adjudicateATR = async (req, res) => {
  const { id } = req.params;
  const { action, pmu_adjudication } = req.body; // action: 'approve' | 'escalate' | 'reject'

  try {
    const atrs = memoryStore.state.atrs || [];
    const item = atrs.find((a) => Number(a.id) === Number(id));
    if (!item) return res.status(404).json({ message: 'ATR record not found' });

    if (action === 'approve') {
      item.status = 'approved_closed';
    } else if (action === 'escalate') {
      item.status = 'escalated';
    } else if (action === 'reject') {
      item.status = 'rejected_reinspection';
    }

    item.pmu_adjudication = pmu_adjudication || item.pmu_adjudication;
    item.official_name = req.user.name;
    item.updated_at = new Date().toISOString();

    await auditService.record({
      actor: req.user,
      action: `atr.adjudicated.${action}`,
      entity: 'atr',
      entityId: item.id,
      meta: { action, verdict: item.status },
    });

    res.json({ message: `ATR adjudicated: ${item.status}`, atr: item });
  } catch (err) {
    console.error('adjudicateATR error:', err.message);
    res.status(500).json({ message: 'Server error adjudicating ATR' });
  }
};
