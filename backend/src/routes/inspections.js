const express = require('express');
const {
  assignInspection,
  getMyInspections,
  getAllInspections,
  updateInspectionStatus,
  getInspectionById,
  geoVerifyInspection,
  getInspectionChecklist,
  saveInspectionChecklist,
} = require('../controllers/inspectionController');
const { auth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.post('/assign', auth, roleCheck('admin', 'supervisor'), assignInspection);
router.get('/mine', auth, getMyInspections);
router.get('/all', auth, roleCheck('admin', 'supervisor'), getAllInspections);
router.get('/:id', auth, getInspectionById);
router.get('/:id/checklist', auth, getInspectionChecklist);
router.post('/:id/checklist', auth, saveInspectionChecklist);
router.post('/:id/geo-verify', auth, geoVerifyInspection);
router.put('/:id/status', auth, updateInspectionStatus);

module.exports = router;

