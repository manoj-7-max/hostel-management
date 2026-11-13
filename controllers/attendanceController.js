const pool = require('../db');

function isDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

exports.getAttendance = async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  if (!isDate(date)) return res.status(400).json({ error: 'Date must use YYYY-MM-DD format' });

  try {
    const result = await pool.query(
      `SELECT s.student_id, s.name, r.room_number,
              a.status, COALESCE(a.note, '') AS note
       FROM student s
       LEFT JOIN room_allocation ra ON ra.student_id = s.student_id
       LEFT JOIN room r ON r.room_id = ra.room_id
       LEFT JOIN attendance_record a ON a.student_id = s.student_id AND a.attendance_date = $1
       WHERE s.is_active = true AND s.hostel_id=$2
       ORDER BY s.name`,
      [date, req.hostel_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load attendance.' });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT attendance_date, status, note
       FROM attendance_record
       WHERE student_id = $1 AND hostel_id=$2
       ORDER BY attendance_date DESC
       LIMIT 90`,
      [req.user.student_id, req.hostel_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load your attendance.' });
  }
};

exports.saveAttendance = async (req, res) => {
  const { date, records } = req.body;
  if (!isDate(date) || !Array.isArray(records)) {
    return res.status(400).json({ error: 'A valid date and attendance records are required' });
  }

  const validStatuses = new Set(['present', 'absent', 'late', 'leave']);
  if (records.some((record) => !Number.isInteger(Number(record.student_id)) || !validStatuses.has(record.status))) {
    return res.status(400).json({ error: 'Each record needs a student and a valid attendance status' });
  }

  const studentIds = [...new Set(records.map((record) => Number(record.student_id)))];
  const validStudents = await pool.query(
    'SELECT COUNT(*)::int AS count FROM student WHERE student_id=ANY($1::int[]) AND hostel_id=$2',
    [studentIds, req.hostel_id]
  );
  if (validStudents.rows[0].count !== studentIds.length) {
    return res.status(400).json({ error: 'One or more residents are outside this hostel' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const record of records) {
      await client.query(
        `INSERT INTO attendance_record (student_id, attendance_date, status, note, hostel_id)
         SELECT student_id, $2, $3, $4, hostel_id FROM student WHERE student_id=$1 AND hostel_id=$5
         ON CONFLICT (student_id, attendance_date)
         DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note`,
        [Number(record.student_id), date, record.status, record.note || null, req.hostel_id]
      );
    }
    await client.query('COMMIT');
    res.json({ message: `Attendance saved for ${records.length} students`, count: records.length });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: err.message || 'Unable to save attendance.' });
  } finally {
    client.release();
  }
};
