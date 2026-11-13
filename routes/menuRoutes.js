const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');

router.get('/', authenticate, requirePermission('mess.read', 'mess.manage'), menuController.getMenu);
router.post('/', authenticate, requirePermission('mess.manage'), menuController.addMenuItem);
router.delete('/:id', authenticate, requirePermission('mess.manage'), menuController.deleteMenuItem);

module.exports = router;
