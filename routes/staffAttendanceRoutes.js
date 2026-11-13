const express=require('express');
const controller=require('../controllers/staffAttendanceController');
const {authenticate,requirePermission}=require('../middleware/authMiddleware');
const router=express.Router();
router.use(authenticate,requirePermission('staff.manage'));
router.get('/',controller.list);
router.put('/',controller.save);
module.exports=router;
