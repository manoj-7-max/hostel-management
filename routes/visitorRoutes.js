const express = require('express');
const controller = require('../controllers/visitorController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');
const router = express.Router();
router.use(authenticate, requirePermission('visitors.manage'));
router.get('/', controller.list);
router.post('/', controller.checkIn);
router.patch('/:id/checkout', controller.checkOut);
module.exports = router;
