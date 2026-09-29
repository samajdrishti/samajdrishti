const express = require('express');
const { getProjects, getProject, createProject, updateProject } = require('../controllers/projectController');
const { auth, roleCheck } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, getProjects);
router.get('/:id', auth, getProject);
router.post('/', auth, roleCheck('admin', 'supervisor'), createProject);
router.put('/:id', auth, roleCheck('admin'), updateProject);

module.exports = router;
