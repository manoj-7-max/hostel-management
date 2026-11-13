const express=require('express');
const controller=require('../controllers/messController');
const {authenticate,requirePermission}=require('../middleware/authMiddleware');
const router=express.Router();
router.use(authenticate,requirePermission('reports.read','fees.manage'));
router.get('/',controller.listExpenses);
router.post('/',requirePermission('mess.manage','fees.manage'),controller.createExpense);
module.exports=router;
