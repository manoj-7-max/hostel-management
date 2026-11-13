require('dotenv').config();
if(process.env.NODE_ENV==='production'&&(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32||process.env.JWT_SECRET==='dev_hostel_secret_change_me')){
  throw new Error('Production requires a unique JWT_SECRET with at least 32 characters');
}
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const fs = require('fs');
const path = require('path');
const app = express();
const frontendDirectory=path.join(__dirname,'frontend','dist');

// Middleware
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim());
if(process.env.RENDER_EXTERNAL_URL)allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);

app.use(cors({
  origin(origin, callback) {
    const isLocalDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
    if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json({ limit: '7mb' }));
if(fs.existsSync(frontendDirectory))app.use(express.static(frontendDirectory,{index:false}));

// Import routes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const roomRoutes = require('./routes/roomRoutes');
const allocationRoutes = require('./routes/allocationRoutes');
const menuRoutes = require('./routes/menuRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
const outpassRoutes = require('./routes/outpassRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const staffRoutes = require('./routes/staffRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const reportRoutes = require('./routes/reportRoutes');
const hostelRoutes = require('./routes/hostelRoutes');
const userRoutes = require('./routes/userRoutes');
const admissionRoutes = require('./routes/admissionRoutes');
const visitorRoutes = require('./routes/visitorRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');
const parentRoutes = require('./routes/parentRoutes');
const messRoutes = require('./routes/messRoutes');
const staffAttendanceRoutes = require('./routes/staffAttendanceRoutes');
const expenseRoutes = require('./routes/expenseRoutes');

// Use routes
app.use('/auth', authRoutes);
app.use('/students', studentRoutes);
app.use('/rooms', roomRoutes);
app.use('/allocate-room', allocationRoutes);
app.use('/menu', menuRoutes);
app.use('/payments', paymentRoutes);
app.use('/complaints', complaintRoutes);
app.use('/outpass', outpassRoutes);
app.use('/announcements', announcementRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/staff', staffRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/reports', reportRoutes);
app.use('/hostels', hostelRoutes);
app.use('/users', userRoutes);
app.use('/admissions', admissionRoutes);
app.use('/visitors', visitorRoutes);
app.use('/maintenance', maintenanceRoutes);
app.use('/notifications', notificationRoutes);
app.use('/invoices', invoiceRoutes);
app.use('/parent', parentRoutes);
app.use('/mess', messRoutes);
app.use('/staff-attendance', staffAttendanceRoutes);
app.use('/expenses', expenseRoutes);

app.get('/health', async (_req,res) => {
  try {
    await pool.query('SELECT 1');
    res.json({status:'ok',database:'ready'});
  } catch (_error) {
    res.status(503).json({status:'error',database:'unavailable'});
  }
});

const apiPrefixes=[
  '/auth','/students','/rooms','/allocate-room','/menu','/payments','/complaints','/outpass',
  '/announcements','/attendance','/staff','/inventory','/reports','/hostels','/users','/admissions',
  '/visitors','/maintenance','/notifications','/invoices','/parent','/mess','/staff-attendance','/expenses'
];
app.use((req,res,next)=>{
  if(req.method!=='GET'||apiPrefixes.some((prefix)=>req.path===prefix||req.path.startsWith(`${prefix}/`)))return next();
  const index=path.join(frontendDirectory,'index.html');
  if(fs.existsSync(index))return res.sendFile(index);
  if(req.path==='/')return res.send('Hostel Management System API');
  return next();
});

// Error handler
app.use((err, req, res, next) => {
  console.error("🔥 ERROR:", err.message);
  console.error(err.stack);

  res.status(500).json({
    error: err.message
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
