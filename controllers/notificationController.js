const pool = require('../db');

exports.list = async (req, res) => {
  const result = await pool.query(
    `SELECT notification_id, notification_type, title, message, target_url, read_at, created_at
     FROM app_notification WHERE user_id=$1 AND (hostel_id IS NULL OR hostel_id=$2)
     ORDER BY created_at DESC LIMIT 100`,
    [req.user.user_id, req.hostel_id]
  );
  res.json(result.rows);
};

exports.markRead = async (req, res) => {
  const result = await pool.query(
    `UPDATE app_notification SET read_at=COALESCE(read_at,CURRENT_TIMESTAMP)
     WHERE notification_id=$1 AND user_id=$2 AND (hostel_id IS NULL OR hostel_id=$3) RETURNING notification_id, read_at`,
    [req.params.id, req.user.user_id, req.hostel_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Notification not found' });
  res.json(result.rows[0]);
};

exports.markAllRead = async (req, res) => {
  const result = await pool.query(
    `UPDATE app_notification SET read_at=CURRENT_TIMESTAMP
     WHERE user_id=$1 AND (hostel_id IS NULL OR hostel_id=$2) AND read_at IS NULL`,
    [req.user.user_id, req.hostel_id]
  );
  res.json({ updated: result.rowCount });
};
