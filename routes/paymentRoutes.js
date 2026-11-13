const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const invoiceController = require('../controllers/invoiceController');
const { authenticate, requireRole, requirePermission } = require('../middleware/authMiddleware');

router.post('/', authenticate, requireRole('student', 'admin'), (req, res, next) => {
  if (req.user.role === 'student') return next();
  return requirePermission('fees.manage')(req, res, next);
}, paymentController.addPayment);
router.get('/', authenticate, requireRole('student', 'admin'), (req, res, next) => {
  if (req.user.role === 'student') return next();
  return requirePermission('fees.read', 'fees.manage')(req, res, next);
}, paymentController.getPayments);
router.post('/:id/refunds', authenticate, requirePermission('fees.manage'), invoiceController.refundPayment);

module.exports = router;
