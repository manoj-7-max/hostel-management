const express = require('express');
const controller = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware');
const router = express.Router();
router.use(authenticate);
router.get('/', controller.list);
router.put('/read-all', controller.markAllRead);
router.put('/:id/read', controller.markRead);
module.exports = router;
