const express = require('express');
const controller = require('../controllers/invoiceController');
const { authenticate, requireRole, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);
router.get('/', requireRole('student', 'admin'), (req, res, next) => req.user.role === 'student' ? next() : requirePermission('fees.read', 'fees.manage')(req, res, next), controller.list);
router.get('/fee-types', requirePermission('fees.read', 'fees.manage'), controller.listFeeTypes);
router.put('/fee-types/:id/rate', requirePermission('fees.manage'), controller.setRate);
router.post('/monthly', requirePermission('fees.manage'), controller.generateMonthly);
router.post('/', requirePermission('fees.manage'), controller.create);
router.post('/:id/payments', requirePermission('fees.manage'), controller.recordPayment);
router.post('/payments/:id/refunds', requirePermission('fees.manage'), controller.refundPayment);
module.exports = router;
