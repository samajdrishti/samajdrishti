const express = require('express');
const { list, checkIn, checkOut, summary, anomalies } = require('../controllers/attendanceController');
const { auth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, list);
router.get('/summary', auth, roleCheck('admin', 'supervisor'), summary);
router.get('/anomalies', auth, roleCheck('admin', 'supervisor'), anomalies);
router.post('/check-in', auth, checkIn);
router.post('/check-out', auth, checkOut);

module.exports = router;
