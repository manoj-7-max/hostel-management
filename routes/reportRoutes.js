const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');

router.get('/summary', authenticate, requirePermission('reports.read'), reportController.getSummary);

module.exports = router;
