const memoryStore = require('../config/memoryStore');
const auditService = require('../services/auditService');

/**
 * Beneficiary Feedback & Social Audit Controller
 * Supports direct beneficiary reporting, ratings, nutrition checks and voice observations.
 */

exports.getFeedback = async (req, res) => {
  try {
    const list = memoryStore.state.beneficiary_feedback || [];
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: 'Server error retrieving feedback' });
  }
};

exports.submitFeedback = async (req, res) => {
  const { project_id, category, rating, comment, scheme, beneficiary_name, voice_memo } = req.body;

  try {
    const list = memoryStore.state.beneficiary_feedback = memoryStore.state.beneficiary_feedback || [];
    const project = memoryStore.projectById(project_id) || {};

    const sentiment = Number(rating) >= 4 ? 'positive' : Number(rating) <= 2 ? 'critical' : 'neutral';

    const feedbackRecord = {
      id: list.length + 1,
      project_id: Number(project_id),
      project_name: project.name || 'DoSJE Monitored Facility',
      scheme: scheme || project.department || 'AVYAY',
      beneficiary_name: beneficiary_name || (req.user ? req.user.name : 'Anonymous Beneficiary'),
      category: category || 'General Welfare',
      rating: Number(rating) || 4,
      comment: comment || 'Service standard verified by beneficiary.',
      sentiment,
      verified_resident: true,
      voice_memo_recorded: Boolean(voice_memo),
      created_at: new Date().toISOString(),
    };

    list.unshift(feedbackRecord);

    await auditService.record({
      actor: req.user || { name: 'Beneficiary Portal' },
      action: 'social_audit.feedback_submitted',
      entity: 'project',
      entityId: Number(project_id),
      meta: { rating, sentiment, category },
    });

    res.status(201).json({ message: 'Beneficiary feedback recorded for Social Audit', feedback: feedbackRecord });
  } catch (err) {
    console.error('submitFeedback error:', err.message);
    res.status(500).json({ message: 'Server error saving feedback' });
  }
};
