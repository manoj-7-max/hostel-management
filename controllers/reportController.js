const pool = require('../db');

exports.getSummary = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM student WHERE is_active = true AND hostel_id=$1) AS active_students,
         (SELECT COUNT(*)::int FROM room WHERE hostel_id=$1) AS room_count,
         (SELECT COALESCE(SUM(capacity), 0)::int FROM room WHERE hostel_id=$1) AS total_beds,
         (SELECT COALESCE(SUM(occupancy), 0)::int FROM room WHERE hostel_id=$1) AS occupied_beds,
         (SELECT COUNT(*)::int FROM complaint WHERE status = 'pending' AND hostel_id=$1) AS open_complaints,
         (SELECT COALESCE(SUM(amount), 0)::numeric FROM payment WHERE status = 'paid' AND hostel_id=$1) AS paid_total,
         (SELECT COALESCE(SUM(GREATEST(billed.total_amount-paid.paid_amount+refund.refunded_amount,0)),0)::numeric
          FROM invoice i
          CROSS JOIN LATERAL (SELECT COALESCE(SUM(quantity*unit_amount),0) AS total_amount FROM invoice_item WHERE invoice_id=i.invoice_id) billed
          CROSS JOIN LATERAL (SELECT COALESCE(SUM(amount),0) AS paid_amount FROM payment WHERE invoice_id=i.invoice_id AND status='paid') paid
          CROSS JOIN LATERAL (SELECT COALESCE(SUM(pr.amount),0) AS refunded_amount FROM payment_refund pr JOIN payment p ON p.payment_id=pr.payment_id WHERE p.invoice_id=i.invoice_id) refund
          WHERE i.hostel_id=$1 AND i.status<>'void')
          + (SELECT COALESCE(SUM(amount),0)::numeric FROM payment WHERE hostel_id=$1 AND invoice_id IS NULL AND status='pending') AS pending_total,
         (SELECT COUNT(*)::int FROM outpass WHERE hostel_id=$1 AND check_out_time IS NOT NULL AND check_in_time IS NULL) AS outside_now,
         (SELECT COUNT(*)::int FROM attendance_record WHERE hostel_id=$1 AND attendance_date = CURRENT_DATE AND status = 'present') AS present_today,
         (SELECT COUNT(*)::int FROM attendance_record WHERE hostel_id=$1 AND attendance_date = CURRENT_DATE AND status = 'absent') AS absent_today,
         (SELECT COALESCE(SUM(amount),0)::numeric FROM hostel_expense WHERE hostel_id=$1 AND expense_date >= date_trunc('month',CURRENT_DATE)::date AND expense_date < (date_trunc('month',CURRENT_DATE) + INTERVAL '1 month')::date) AS expense_total`,
      [req.hostel_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load reports.' });
  }
};
