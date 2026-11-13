const express = require('express');
const controller = require('../controllers/maintenanceController');
const { authenticate, requireRole, requirePermission } = require('../middleware/authMiddleware');
const router = express.Router();
router.use(authenticate);
router.get('/', requirePermission('maintenance.manage'), controller.list);
router.post('/', requireRole('student', 'admin'), (req, res, next) => req.user.role === 'student' ? next() : requirePermission('maintenance.manage')(req, res, next), controller.create);
router.patch('/:id', requirePermission('maintenance.manage'), controller.update);
module.exports = router;
