const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const { authenticate, requireRole, requirePermission } = require('../middleware/authMiddleware');

router.get('/me', authenticate, requireRole('student'), studentController.getMyProfile);
router.get('/me/room', authenticate, requireRole('student'), studentController.getMyRoom);
router.post('/', authenticate, requirePermission('students.manage'), studentController.addStudent);
router.get('/', authenticate, requirePermission('students.read'), studentController.getAllStudents);
router.put('/:id', authenticate, requirePermission('students.manage'), studentController.updateStudent);
router.delete('/:id', authenticate, requirePermission('students.manage'), studentController.deleteStudent);

module.exports = router;
