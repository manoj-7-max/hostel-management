const pool = require('../db');

exports.children = async (req, res) => {
  const result = await pool.query(
    `SELECT DISTINCT s.student_id, s.name, s.gender, r.room_number, ra.allocation_date
     FROM guardian g JOIN student s ON s.student_id=g.student_id
     LEFT JOIN room_allocation ra ON ra.student_id=s.student_id AND ra.hostel_id=s.hostel_id
     LEFT JOIN room r ON r.room_id=ra.room_id
     WHERE g.user_id=$1 AND g.hostel_id=$2 AND s.is_active=true ORDER BY s.name`,
    [req.user.user_id, req.hostel_id]
  );
  res.json(result.rows);
};

async function authorizeChild(client, req, studentId) {
  const result = await client.query(
    `SELECT s.student_id FROM guardian g JOIN student s ON s.student_id=g.student_id
     WHERE g.user_id=$1 AND g.hostel_id=$2 AND s.student_id=$3 AND s.is_active=true`,
    [req.user.user_id, req.hostel_id, studentId]
  );
  return result.rowCount > 0;
}

exports.attendance = async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!(await authorizeChild(pool, req, studentId))) return res.status(404).json({ error: 'Resident not found for this guardian' });
  const result = await pool.query(
    `SELECT attendance_date,status,note FROM attendance_record WHERE student_id=$1 AND hostel_id=$2 ORDER BY attendance_date DESC LIMIT 90`,
    [studentId, req.hostel_id]
  );
  res.json(result.rows);
};

exports.invoices = async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!(await authorizeChild(pool, req, studentId))) return res.status(404).json({ error: 'Resident not found for this guardian' });
  const result = await pool.query(
    `SELECT i.invoice_id,i.invoice_number,i.billing_period,i.due_date,i.status,
       COALESCE(items.total_amount,0)::numeric AS total_amount,
       COALESCE(paid.paid_amount,0)::numeric AS paid_amount,
       COALESCE(refunds.refunded_amount,0)::numeric AS refunded_amount,
       GREATEST(COALESCE(items.total_amount,0)-COALESCE(paid.paid_amount,0)+COALESCE(refunds.refunded_amount,0),0)::numeric AS balance_due
     FROM invoice i
     LEFT JOIN LATERAL (SELECT SUM(quantity*unit_amount) AS total_amount FROM invoice_item WHERE invoice_id=i.invoice_id) items ON true
     LEFT JOIN LATERAL (SELECT SUM(amount) AS paid_amount FROM payment WHERE invoice_id=i.invoice_id AND status='paid') paid ON true
     LEFT JOIN LATERAL (SELECT SUM(pr.amount) AS refunded_amount FROM payment_refund pr JOIN payment p ON p.payment_id=pr.payment_id WHERE p.invoice_id=i.invoice_id) refunds ON true
     WHERE i.student_id=$1 AND i.hostel_id=$2 ORDER BY i.due_date DESC`,
    [studentId, req.hostel_id]
  );
  res.json(result.rows);
};

exports.announcements = async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!(await authorizeChild(pool, req, studentId))) return res.status(404).json({ error: 'Resident not found for this guardian' });
  const result = await pool.query(
    `SELECT announcement_id,title,message,created_at FROM announcement WHERE hostel_id=$1 ORDER BY created_at DESC LIMIT 100`,
    [req.hostel_id]
  );
  res.json(result.rows);
};

exports.leave = async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!(await authorizeChild(pool, req, studentId))) return res.status(404).json({ error: 'Resident not found for this guardian' });
  const result = await pool.query(
    `SELECT outpass_id,reason,status,request_time,check_out_time,check_in_time
     FROM outpass WHERE student_id=$1 AND hostel_id=$2 ORDER BY request_time DESC LIMIT 100`,
    [studentId,req.hostel_id]
  );
  res.json(result.rows);
};
