const express = require('express');
const {
  getCameras, createCamera, updateCamera, getSnapshot, getOverview,
} = require('../controllers/monitoringController');
const { auth, softAuth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.get('/overview', auth, getOverview);
router.get('/cameras', auth, getCameras);
// Loaded as an <img> by the web clients, so the token may arrive as ?token=
router.get('/cameras/:id/snapshot', softAuth, getSnapshot);
router.post('/cameras', auth, roleCheck('admin', 'supervisor'), createCamera);
router.patch('/cameras/:id', auth, roleCheck('admin', 'supervisor'), updateCamera);

module.exports = router;
