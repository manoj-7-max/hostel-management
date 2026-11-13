const pool = require('../db');

// Register complaint
exports.addComplaint = async (req, res) => {
  try {
    const student_id = req.user.role === 'student' ? req.user.student_id : req.body.student_id;
    const { description } = req.body;
    const result = await pool.query(
      `INSERT INTO complaint (student_id, description, hostel_id)
       SELECT student_id, $2, hostel_id FROM student WHERE student_id=$1 AND hostel_id=$3 RETURNING *`,
      [student_id, description, req.hostel_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Student not found in this hostel' });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// View complaints
exports.getComplaints = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*,s.name AS student_name,room.room_number,staff.name AS assigned_staff_name,
         COALESCE(updates.history,'[]'::json) AS updates
       FROM complaint c JOIN student s ON s.student_id=c.student_id
       LEFT JOIN LATERAL(SELECT r.room_number FROM room_allocation ra JOIN room r ON r.room_id=ra.room_id
         WHERE ra.student_id=s.student_id AND ra.hostel_id=s.hostel_id AND ra.checked_out_at IS NULL
         ORDER BY ra.allocation_date DESC LIMIT 1) room ON true
       LEFT JOIN staff_member staff ON staff.staff_id=c.assigned_staff_id AND staff.hostel_id=c.hostel_id
       LEFT JOIN LATERAL(SELECT json_agg(json_build_object('old_status',cu.old_status,'new_status',cu.new_status,'note',cu.note,'created_at',cu.created_at,'actor',u.display_name) ORDER BY cu.created_at) AS history
         FROM complaint_update cu LEFT JOIN app_user u ON u.user_id=cu.user_id WHERE cu.complaint_id=c.complaint_id AND cu.hostel_id=c.hostel_id) updates ON true
       WHERE c.hostel_id=$1 AND ($2::int IS NULL OR c.student_id=$2)
       ORDER BY c.created_at DESC LIMIT 500`,
      [req.hostel_id,req.user.role==='student'?req.user.student_id:null]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update complaint status
exports.updateComplaintStatus = async (req, res) => {
  const { id } = req.params;
  const { status, note, assigned_staff_id, priority } = req.body;
  if (!['pending', 'in_progress', 'resolved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid complaint status' });
  if (priority && !['low', 'normal', 'high', 'urgent'].includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const previous = await client.query('SELECT status, student_id FROM complaint WHERE complaint_id=$1 AND hostel_id=$2 FOR UPDATE', [id, req.hostel_id]);
    if (!previous.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Complaint not found' }); }
    if (assigned_staff_id) {
      const staff = await client.query('SELECT staff_id FROM staff_member WHERE staff_id=$1 AND hostel_id=$2', [assigned_staff_id, req.hostel_id]);
      if (!staff.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Assigned staff member not found in this hostel' }); }
    }
    const result = await client.query(
      `UPDATE complaint SET status=$1, assigned_staff_id=COALESCE($2,assigned_staff_id), priority=COALESCE($3,priority), updated_at=CURRENT_TIMESTAMP
       WHERE complaint_id=$4 AND hostel_id=$5 RETURNING *`,
      [status, assigned_staff_id || null, priority || null, id, req.hostel_id]
    );
    await client.query(
      `INSERT INTO complaint_update(complaint_id, hostel_id, user_id, old_status, new_status, note)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, req.hostel_id, req.user.user_id, previous.rows[0].status, status, note || null]
    );
    await client.query(
      `INSERT INTO app_notification(user_id, hostel_id, notification_type, title, message, target_url)
       SELECT user_id, $1, 'complaint', 'Complaint update', $2, '/student'
       FROM student WHERE student_id=$3 AND user_id IS NOT NULL
       ON CONFLICT DO NOTHING`,
      [req.hostel_id, `Complaint #${id} is now ${status.replaceAll('_', ' ')}.`, previous.rows[0].student_id]
    );
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};
