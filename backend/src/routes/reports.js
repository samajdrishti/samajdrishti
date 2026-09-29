const express = require('express');
const { list, getOne, share } = require('../controllers/reportController');
const { auth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, roleCheck('admin', 'supervisor'), list);
router.get('/:id', auth, roleCheck('admin', 'supervisor'), getOne);
router.post('/:id/share', auth, roleCheck('admin', 'supervisor'), share);

module.exports = router;
