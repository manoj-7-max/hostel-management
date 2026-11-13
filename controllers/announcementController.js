const pool = require('../db');

exports.createAnnouncement = async (req, res) => {
  const client = await pool.connect();
  try {
    const { title, message } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'Title and message are required' });

    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO announcement (title, message, created_by, hostel_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, message, req.user.admin_id || req.user.id, req.hostel_id]
    );

    await client.query(
      `INSERT INTO app_notification(user_id, hostel_id, notification_type, title, message, target_url)
       SELECT s.user_id, $1, 'announcement', $2, $3, '/student'
       FROM student s WHERE s.hostel_id=$1 AND s.is_active=true AND s.user_id IS NOT NULL`,
      [req.hostel_id, title, message]
    );
    await client.query('COMMIT');

    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'student') {
      result = await pool.query(
        `SELECT a.*, CASE WHEN ar.announcement_id IS NULL THEN false ELSE true END AS is_read
         FROM announcement a
         LEFT JOIN announcement_read ar
           ON ar.announcement_id = a.announcement_id AND ar.student_id = $1
         WHERE a.hostel_id=$2
         ORDER BY a.created_at DESC`,
        [req.user.student_id, req.hostel_id]
      );
    } else {
      result = await pool.query('SELECT *, true AS is_read FROM announcement WHERE hostel_id=$1 ORDER BY created_at DESC', [req.hostel_id]);
    }

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.markAnnouncementRead = async (req, res) => {
  try {
    if (req.user.role !== 'student') return res.status(403).json({ error: 'Only students can mark announcements read' });

    const { id } = req.params;
    await pool.query(
      `INSERT INTO announcement_read (announcement_id, student_id)
       SELECT a.announcement_id, $2 FROM announcement a
       WHERE a.announcement_id=$1 AND a.hostel_id=$3
       ON CONFLICT (announcement_id, student_id) DO NOTHING`,
      [id, req.user.student_id, req.hostel_id]
    );

    res.json({ message: 'Announcement marked as read' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
