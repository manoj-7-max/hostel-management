const express = require('express');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { authenticate, requireRole, requirePermission } = require('../middleware/authMiddleware');

router.post('/', authenticate, requireRole('student', 'admin'), (req, res, next) => req.user.role === 'student' ? next() : requirePermission('complaints.manage')(req, res, next), complaintController.addComplaint);
router.get('/', authenticate, requireRole('student', 'admin'), (req, res, next) => req.user.role === 'student' ? next() : requirePermission('complaints.read')(req, res, next), complaintController.getComplaints);
router.put('/:id', authenticate, requirePermission('complaints.manage'), complaintController.updateComplaintStatus);

module.exports = router;
