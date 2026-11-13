const pool = require('../db');

// Add payment
exports.addPayment = async (req, res) => {
  try {
    const student_id = req.user.role === 'student' ? req.user.student_id : req.body.student_id;
    const { amount, purpose, status } = req.body;
    const paymentStatus = req.user.role === 'student' ? 'pending' : (status || 'pending');
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ error: 'Payment amount must be greater than zero' });

    if (!purpose) {
      return res.status(400).json({ error: 'Payment purpose is required' });
    }

    const result = await pool.query(
      `INSERT INTO payment (student_id, amount, purpose, status, hostel_id)
       SELECT student_id, $2, $3, $4, hostel_id FROM student
       WHERE student_id=$1 AND hostel_id=$5 RETURNING *`,
      [student_id, numericAmount, purpose, paymentStatus, req.hostel_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Student not found in this hostel' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get payments (optionally filter by status)
exports.getPayments = async (req, res) => {
  try {
    const { status } = req.query;
    let result;
    if (req.user.role === 'student') {
      result = status
        ? await pool.query('SELECT * FROM payment WHERE student_id=$1 AND hostel_id=$2 AND status=$3 ORDER BY payment_date DESC, payment_id DESC', [req.user.student_id, req.hostel_id, status])
        : await pool.query('SELECT * FROM payment WHERE student_id=$1 AND hostel_id=$2 ORDER BY payment_date DESC, payment_id DESC', [req.user.student_id, req.hostel_id]);
    } else if (status) {
      result = await pool.query(
        `SELECT p.*, s.name AS student_name, r.room_number, i.invoice_number
         FROM payment p
         JOIN student s ON s.student_id = p.student_id
         LEFT JOIN invoice i ON i.invoice_id=p.invoice_id
         LEFT JOIN LATERAL(SELECT room_id FROM room_allocation WHERE student_id=s.student_id AND hostel_id=s.hostel_id AND checked_out_at IS NULL ORDER BY allocation_date DESC LIMIT 1) ra ON true
         LEFT JOIN room r ON r.room_id = ra.room_id
         WHERE p.status=$1 AND p.hostel_id=$2
         ORDER BY p.payment_date DESC, p.payment_id DESC`,
        [status, req.hostel_id]
      );
    } else {
      result = await pool.query(
        `SELECT p.*, s.name AS student_name, r.room_number, i.invoice_number
         FROM payment p
         JOIN student s ON s.student_id = p.student_id
         LEFT JOIN invoice i ON i.invoice_id=p.invoice_id
         LEFT JOIN LATERAL(SELECT room_id FROM room_allocation WHERE student_id=s.student_id AND hostel_id=s.hostel_id AND checked_out_at IS NULL ORDER BY allocation_date DESC LIMIT 1) ra ON true
         LEFT JOIN room r ON r.room_id = ra.room_id
         WHERE p.hostel_id=$1
         ORDER BY p.payment_date DESC, p.payment_id DESC`
        , [req.hostel_id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
