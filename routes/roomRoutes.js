const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { authenticate, requireRole, requirePermission } = require('../middleware/authMiddleware');

router.post('/', authenticate, requirePermission('rooms.manage'), roomController.addRoom);
router.get('/', authenticate, requirePermission('rooms.read'), roomController.getRooms);

module.exports = router;
