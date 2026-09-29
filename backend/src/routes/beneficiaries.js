const express = require('express');
const { getFeedback, submitFeedback } = require('../controllers/beneficiaryController');

const router = express.Router();

router.get('/feedback', getFeedback);
router.post('/feedback', submitFeedback);

module.exports = router;
