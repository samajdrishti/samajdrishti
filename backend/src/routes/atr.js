const express = require('express');
const { getATRs, getATRById, submitNGOReply, adjudicateATR } = require('../controllers/atrController');
const { auth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getATRs);
router.get('/:id', auth, getATRById);
router.post('/:id/respond', auth, submitNGOReply);
router.post('/:id/adjudicate', auth, roleCheck('admin', 'supervisor'), adjudicateATR);

module.exports = router;
