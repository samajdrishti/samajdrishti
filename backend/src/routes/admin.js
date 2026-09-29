const express = require('express');
const { getDashboard, getAIInsights, runAIAssignment, getAIStatus, getNarrative, getAlerts } = require('../controllers/adminController');
const { auth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.get('/dashboard', auth, roleCheck('admin', 'supervisor'), getDashboard);
router.get('/alerts', auth, roleCheck('admin', 'supervisor'), getAlerts);
router.get('/ai/insights', auth, roleCheck('admin', 'supervisor'), getAIInsights);
router.get('/ai/status', auth, roleCheck('admin', 'supervisor'), getAIStatus);
router.get('/ai/narrative', auth, roleCheck('admin', 'supervisor'), getNarrative);
router.post('/ai/assign', auth, roleCheck('admin', 'supervisor'), runAIAssignment);

module.exports = router;
