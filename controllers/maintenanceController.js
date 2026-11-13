const pool = require('../db');

exports.list = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT m.*, r.room_number, s.name AS resident_name, st.name AS assigned_staff_name
       FROM maintenance_request m LEFT JOIN room r ON r.room_id=m.room_id
       LEFT JOIN student s ON s.student_id=m.reported_by
       LEFT JOIN staff_member st ON st.staff_id=m.assigned_staff_id
       WHERE m.hostel_id=$1 ORDER BY CASE m.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END, m.created_at DESC`,
      [req.hostel_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  const { title, description, priority='normal', room_id } = req.body;
  if (!title?.trim() || !description?.trim() || !['low','normal','high','urgent'].includes(priority)) {
    return res.status(400).json({ error: 'Title, description, and a valid priority are required' });
  }
  const studentId = req.user.role === 'student' ? req.user.student_id : (req.body.reported_by || null);
  let resolvedRoomId = room_id || null;
  if (req.user.role === 'student') {
    const allocation = await pool.query('SELECT room_id FROM room_allocation WHERE student_id=$1 AND hostel_id=$2', [studentId, req.hostel_id]);
    if (room_id && allocation.rows[0]?.room_id !== Number(room_id)) return res.status(403).json({ error: 'You can only report maintenance for your allocated room' });
    if (!resolvedRoomId) resolvedRoomId = allocation.rows[0]?.room_id || null;
  }
  if (resolvedRoomId) {
    const room = await pool.query('SELECT room_id FROM room WHERE room_id=$1 AND hostel_id=$2', [resolvedRoomId, req.hostel_id]);
    if (!room.rowCount) return res.status(404).json({ error: 'Room not found in this hostel' });
  }
  if (studentId) {
    const resident = await pool.query('SELECT student_id FROM student WHERE student_id=$1 AND hostel_id=$2', [studentId, req.hostel_id]);
    if (!resident.rowCount) return res.status(404).json({ error: 'Resident not found in this hostel' });
  }
  const result = await pool.query(
    `INSERT INTO maintenance_request(hostel_id, room_id, reported_by, title, description, priority, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [req.hostel_id, resolvedRoomId, studentId, title.trim(), description.trim(), priority, req.user.user_id]
  );
  await pool.query(
    `INSERT INTO app_notification(user_id, hostel_id, notification_type, title, message, target_url)
     SELECT DISTINCT u.user_id, $1, 'maintenance', 'New maintenance request', $2, '/admin'
     FROM app_user u JOIN user_hostel_access ua ON ua.user_id=u.user_id AND ua.hostel_id=$1
     JOIN app_user_role ur ON ur.user_id=u.user_id JOIN app_role_permission rp ON rp.role_id=ur.role_id
     JOIN app_permission p ON p.permission_id=rp.permission_id AND p.permission_key='maintenance.manage'
     WHERE u.user_id<>$3`,
    [req.hostel_id, `Maintenance request: ${title.trim()}`, req.user.user_id]
  );
  res.status(201).json(result.rows[0]);
};

exports.update = async (req, res) => {
  const { status, assigned_staff_id, priority } = req.body;
  if (status && !['open','assigned','in_progress','completed','cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid maintenance status' });
  if (priority && !['low','normal','high','urgent'].includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  if (assigned_staff_id) {
    const staff = await pool.query('SELECT staff_id FROM staff_member WHERE staff_id=$1 AND hostel_id=$2', [assigned_staff_id, req.hostel_id]);
    if (!staff.rowCount) return res.status(404).json({ error: 'Assigned staff member not found in this hostel' });
  }
  const result = await pool.query(
    `UPDATE maintenance_request SET status=COALESCE($1,status), assigned_staff_id=COALESCE($2,assigned_staff_id),
       priority=COALESCE($3,priority), updated_at=CURRENT_TIMESTAMP,
       completed_at=CASE WHEN $1='completed' THEN CURRENT_TIMESTAMP WHEN $1 IS NOT NULL THEN NULL ELSE completed_at END
     WHERE maintenance_id=$4 AND hostel_id=$5 RETURNING *`,
    [status || null, assigned_staff_id || null, priority || null, req.params.id, req.hostel_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Maintenance request not found' });
  res.json(result.rows[0]);
};
