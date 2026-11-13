const express = require('express');
const controller = require('../controllers/hostelController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);
router.get('/', controller.listHostels);
router.post('/', requirePermission('hostels.manage'), controller.createHostel);
router.get('/locations', controller.listLocations);
router.post('/buildings', requirePermission('rooms.manage'), controller.addBuilding);
router.post('/floors', requirePermission('rooms.manage'), controller.addFloor);

module.exports = router;
