const pool = require('../db');

exports.list = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*, s.name AS resident_name, r.room_number
       FROM visitor_visit v JOIN student s ON s.student_id=v.student_id
       LEFT JOIN room_allocation ra ON ra.student_id=s.student_id
       LEFT JOIN room r ON r.room_id=ra.room_id
       WHERE v.hostel_id=$1 ORDER BY v.checked_in_at DESC LIMIT 300`,
      [req.hostel_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.checkIn = async (req, res) => {
  const { student_id, visitor_name, visitor_phone, relationship, purpose, vehicle_number } = req.body;
  if (!student_id || !visitor_name?.trim() || !purpose?.trim()) return res.status(400).json({ error: 'Resident, visitor name, and purpose are required' });
  const result = await pool.query(
    `INSERT INTO visitor_visit(hostel_id, student_id, visitor_name, visitor_phone, relationship, purpose, vehicle_number, registered_by)
     SELECT $1, student_id, $3, $4, $5, $6, $7, $8 FROM student WHERE student_id=$2 AND hostel_id=$1 AND is_active=true
     RETURNING *`,
    [req.hostel_id, student_id, visitor_name.trim(), visitor_phone || null, relationship || null, purpose.trim(), vehicle_number || null, req.user.user_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Active resident not found in this hostel' });
  res.status(201).json(result.rows[0]);
};

exports.checkOut = async (req, res) => {
  const result = await pool.query(
    `UPDATE visitor_visit SET checked_out_at=CURRENT_TIMESTAMP
     WHERE visit_id=$1 AND hostel_id=$2 AND checked_out_at IS NULL RETURNING *`,
    [req.params.id, req.hostel_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Active visitor visit not found in this hostel' });
  res.json(result.rows[0]);
};
