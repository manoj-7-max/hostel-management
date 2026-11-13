const pool = require('../db');

const validMeals = new Set(['breakfast', 'lunch', 'snacks', 'dinner']);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;

exports.listSubscriptions = async (req, res) => {
  const result = await pool.query(
    `SELECT ms.*,s.name AS student_name,s.email FROM meal_subscription ms
     JOIN student s ON s.student_id=ms.student_id
     WHERE ms.hostel_id=$1 ORDER BY ms.status, s.name LIMIT 500`, [req.hostel_id]
  );
  res.json(result.rows);
};

exports.createSubscription = async (req, res) => {
  const { student_id, plan_name='Standard', start_date, end_date=null, monthly_amount=0 } = req.body;
  const amount = Number(monthly_amount);
  if (!Number.isInteger(Number(student_id)) || !plan_name.trim() || !validDate(start_date) || (end_date && !validDate(end_date)) || !Number.isFinite(amount) || amount < 0) {
    return res.status(400).json({ error: 'Resident, plan, valid start date, and non-negative monthly amount are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO meal_subscription(hostel_id,student_id,plan_name,start_date,end_date,monthly_amount)
       SELECT $1,s.student_id,$3,$4,$5,$6 FROM student s WHERE s.student_id=$2 AND s.hostel_id=$1 AND s.is_active=true
       RETURNING *`, [req.hostel_id, student_id, plan_name.trim(), start_date, end_date || null, amount]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Active resident not found in this hostel' });
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(400).json({ error: error.message }); }
};

exports.updateSubscription = async (req, res) => {
  const { status, end_date } = req.body;
  if (!['active','paused','ended'].includes(status)) return res.status(400).json({ error: 'Choose active, paused, or ended' });
  const result = await pool.query(
    `UPDATE meal_subscription SET status=$1,end_date=COALESCE($2::date,end_date)
     WHERE subscription_id=$3 AND hostel_id=$4 RETURNING *`,
    [status, end_date || null, req.params.id, req.hostel_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Meal subscription not found' });
  res.json(result.rows[0]);
};

exports.listMealAttendance = async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0,10);
  if (!validDate(date) || (req.query.meal_type && !validMeals.has(req.query.meal_type))) return res.status(400).json({ error: 'Use a valid date and meal type' });
  const result = await pool.query(
    `SELECT s.student_id,s.name,room.room_number,ma.meal_attendance_id,ma.meal_type,ma.served_at
     FROM student s
     LEFT JOIN LATERAL (SELECT r.room_number FROM room_allocation ra JOIN room r ON r.room_id=ra.room_id
       WHERE ra.student_id=s.student_id AND ra.hostel_id=s.hostel_id ORDER BY ra.allocation_date DESC LIMIT 1) room ON true
     LEFT JOIN meal_attendance ma ON ma.student_id=s.student_id AND ma.hostel_id=s.hostel_id AND ma.meal_date=$2 AND ($3::text IS NULL OR ma.meal_type=$3)
     WHERE s.hostel_id=$1 AND s.is_active=true ORDER BY s.name`,
    [req.hostel_id, date, req.query.meal_type || null]
  );
  res.json(result.rows);
};

exports.recordMealAttendance = async (req, res) => {
  const { student_id, meal_date, meal_type } = req.body;
  if (!Number.isInteger(Number(student_id)) || !validDate(meal_date) || !validMeals.has(meal_type)) return res.status(400).json({ error: 'Resident, date, and valid meal type are required' });
  try {
    const result = await pool.query(
      `INSERT INTO meal_attendance(hostel_id,student_id,meal_date,meal_type,marked_by)
       SELECT $1,s.student_id,$3,$4,$5 FROM student s
       JOIN meal_subscription ms ON ms.student_id=s.student_id AND ms.hostel_id=s.hostel_id AND ms.status='active'
         AND ms.start_date<=$3 AND (ms.end_date IS NULL OR ms.end_date>=$3)
       WHERE s.student_id=$2 AND s.hostel_id=$1 AND s.is_active=true
       ON CONFLICT(student_id,meal_date,meal_type) DO NOTHING RETURNING *`,
      [req.hostel_id, student_id, meal_date, meal_type, req.user.user_id]
    );
    if (!result.rowCount) {
      const exists = await pool.query('SELECT 1 FROM meal_attendance WHERE student_id=$1 AND hostel_id=$2 AND meal_date=$3 AND meal_type=$4', [student_id, req.hostel_id, meal_date, meal_type]);
      if (exists.rowCount) return res.status(409).json({ error: 'Meal attendance is already recorded' });
      return res.status(400).json({ error: 'An active meal subscription is required for this date' });
    }
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(400).json({ error: error.message }); }
};

exports.listExpenses = async (req, res) => {
  const result = await pool.query(
    `SELECT e.*,u.display_name AS recorded_by_name FROM hostel_expense e LEFT JOIN app_user u ON u.user_id=e.recorded_by
     WHERE e.hostel_id=$1 ORDER BY e.expense_date DESC,e.expense_id DESC LIMIT 500`, [req.hostel_id]
  );
  res.json(result.rows);
};

exports.createExpense = async (req, res) => {
  const { expense_date, category, description, amount, vendor, reference_number } = req.body;
  const numericAmount = Number(amount);
  if (!validDate(expense_date) || !category?.trim() || !description?.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ error: 'Date, category, description, and an amount above zero are required' });
  const result = await pool.query(
    `INSERT INTO hostel_expense(hostel_id,expense_date,category,description,amount,vendor,reference_number,recorded_by)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.hostel_id, expense_date, category.trim(), description.trim(), numericAmount, vendor?.trim() || null, reference_number?.trim() || null, req.user.user_id]
  );
  res.status(201).json(result.rows[0]);
};
