const express = require('express');
const {
  createSession, listSessions, getSession, endSession, logJoin,
} = require('../controllers/vcController');
const { auth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.get('/sessions', auth, listSessions);
// Any signed-in user may request a random session (officials use this from the app)
router.post('/sessions', auth, createSession);
router.get('/sessions/:id', auth, getSession);
router.post('/sessions/:id/join-log', auth, logJoin);
router.post('/sessions/:id/end', auth, roleCheck('admin', 'supervisor'), endSession);

module.exports = router;
