const express = require('express');
const { list, byEntity } = require('../controllers/auditController');
const { auth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, roleCheck('admin', 'supervisor'), list);
router.get('/:entity/:id', auth, roleCheck('admin', 'supervisor'), byEntity);

module.exports = router;
