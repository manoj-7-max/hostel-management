const express = require('express');
const controller = require('../controllers/userController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate, requirePermission('users.manage'));
router.get('/roles', controller.listRoles);
router.get('/', controller.listUsers);
router.post('/', controller.createUser);
router.patch('/:id/active', controller.setActive);

module.exports = router;
