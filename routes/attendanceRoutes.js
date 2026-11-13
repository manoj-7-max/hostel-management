const express = require('express');
const router = express.Router();
const controller = require('../controllers/attendanceController');
const { authenticate, requireRole, requirePermission } = require('../middleware/authMiddleware');

router.get('/me', authenticate, requirePermission('student.self'), controller.getMyAttendance);
router.get('/', authenticate, requirePermission('attendance.read'), controller.getAttendance);
router.put('/', authenticate, requirePermission('attendance.manage'), controller.saveAttendance);

module.exports = router;
