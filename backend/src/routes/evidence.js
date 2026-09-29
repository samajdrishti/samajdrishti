const express = require('express');
const {
  uploadEvidence, getEvidence, getIntegrity, verifyEvidence,
} = require('../controllers/evidenceController');
const { auth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, uploadEvidence);
router.get('/', auth, getEvidence);
router.get('/:id/integrity', auth, getIntegrity);
router.put('/:id/verify', auth, roleCheck('admin', 'supervisor'), verifyEvidence);

module.exports = router;
