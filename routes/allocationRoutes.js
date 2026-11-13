const express = require('express');
const router = express.Router();
const allocationController = require('../controllers/allocationController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');

router.post('/', authenticate, requirePermission('allocations.manage'), allocationController.allocateRoom);
router.get('/:studentId/history', authenticate, requirePermission('students.read'), allocationController.history);
router.post('/transfer', authenticate, requirePermission('allocations.manage'), allocationController.transfer);
router.post('/:studentId/checkout', authenticate, requirePermission('allocations.manage'), allocationController.checkout);

module.exports = router;
