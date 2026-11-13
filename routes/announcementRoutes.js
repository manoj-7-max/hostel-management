const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcementController');
const { authenticate, requireRole, requirePermission } = require('../middleware/authMiddleware');

router.get('/', authenticate, requirePermission('announcements.read', 'announcements.manage'), announcementController.getAnnouncements);
router.post('/', authenticate, requirePermission('announcements.manage'), announcementController.createAnnouncement);
router.put('/:id/read', authenticate, requireRole('student'), announcementController.markAnnouncementRead);

module.exports = router;
