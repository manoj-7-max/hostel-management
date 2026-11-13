const express = require('express');
const admissions = require('../controllers/admissionController');
const documents = require('../controllers/documentController');
const { authenticate, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authenticate);
router.get('/', requirePermission('students.read'), admissions.list);
router.post('/', requirePermission('students.manage'), admissions.create);
router.patch('/:id/status', requirePermission('students.manage'), admissions.review);
router.post('/:id/documents', requirePermission('students.manage'), documents.uploadApplicationDocument);
router.get('/documents/:id', requirePermission('students.read'), documents.download);
router.put('/documents/:id/status', requirePermission('students.manage'), documents.setVerificationStatus);

module.exports = router;
