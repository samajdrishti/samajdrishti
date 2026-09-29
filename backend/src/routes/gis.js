const express = require('express');
const { getCenters } = require('../controllers/gisController');
const { auth } = require('../middleware/auth');

const router = express.Router();

/* Compliance GIS feed: centers + registered coordinates + center heads + CCTV. */
router.get('/centers', auth, getCenters);

module.exports = router;
