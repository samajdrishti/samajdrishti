const express = require('express');
const { uploadEvidence, getEvidence, verifyEvidence } = require('../controllers/evidenceController');
const { auth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.post('/', auth, uploadEvidence);
router.get('/', auth, getEvidence);
router.put('/:id/verify', auth, roleCheck('admin', 'supervisor'), verifyEvidence);

module.exports = router;
