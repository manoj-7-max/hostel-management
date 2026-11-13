const express = require('express');
const router = express.Router();
const controller = require('../controllers/inventoryController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');

router.use(authenticate, requirePermission('inventory.manage'));
router.get('/', controller.listInventory);
router.post('/', controller.addInventoryItem);
router.patch('/:id/quantity', controller.adjustInventory);

module.exports = router;
