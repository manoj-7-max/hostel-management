const express = require('express');
const router = express.Router();
const controller = require('../controllers/staffController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');

router.use(authenticate, requirePermission('staff.manage'));
router.get('/', controller.listStaff);
router.post('/', controller.addStaff);
router.patch('/:id', controller.setStaffActive);

module.exports = router;
