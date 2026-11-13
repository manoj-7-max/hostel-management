const express = require('express');
const router = express.Router();
const outpassController = require('../controllers/outpassController');
const { authenticate, requireRole, requirePermission } = require('../middleware/authMiddleware');

router.post('/request', authenticate, requireRole('student', 'admin'), (req, res, next) => req.user.role === 'student' ? next() : requirePermission('leave.manage')(req, res, next), outpassController.requestOutpass);
router.put('/approve/:id', authenticate, requirePermission('leave.manage'), outpassController.approveOutpass);
router.put('/checkout/:id', authenticate, requirePermission('leave.manage'), outpassController.checkoutOutpass);
router.put('/checkin/:id', authenticate, requirePermission('leave.manage'), outpassController.checkinOutpass);
router.get('/currently-outside', authenticate, requirePermission('leave.manage'), outpassController.getCurrentlyOutside);
router.get('/', authenticate, requireRole('student', 'admin'), (req, res, next) => req.user.role === 'student' ? next() : requirePermission('leave.manage')(req, res, next), outpassController.getOutpasses);

module.exports = router;
