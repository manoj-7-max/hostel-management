const pool = require('../db');
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
const statuses = new Set(['present','absent','late','leave']);

exports.list = async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0,10);
  if (!validDate(date)) return res.status(400).json({ error: 'Date must use YYYY-MM-DD format' });
  const result = await pool.query(
    `SELECT s.staff_id,s.name,s.job_title,s.shift,s.is_active,a.status,a.check_in_at,a.check_out_at,a.note
     FROM staff_member s LEFT JOIN staff_attendance a ON a.staff_id=s.staff_id AND a.hostel_id=s.hostel_id AND a.attendance_date=$2
     WHERE s.hostel_id=$1 ORDER BY s.is_active DESC,s.name`, [req.hostel_id,date]
  );
  res.json(result.rows);
};

exports.save = async (req, res) => {
  const { date, records } = req.body;
  if (!validDate(date) || !Array.isArray(records) || records.some((r) => !Number.isInteger(Number(r.staff_id)) || !statuses.has(r.status))) return res.status(400).json({ error: 'A valid date and staff attendance records are required' });
  const staffIds=[...new Set(records.map((r)=>Number(r.staff_id)))];
  const valid=await pool.query('SELECT COUNT(*)::int AS count FROM staff_member WHERE staff_id=ANY($1::int[]) AND hostel_id=$2',[staffIds,req.hostel_id]);
  if(valid.rows[0].count!==staffIds.length) return res.status(400).json({error:'One or more staff records are outside this hostel'});
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    for(const r of records) await client.query(
      `INSERT INTO staff_attendance(hostel_id,staff_id,attendance_date,status,check_in_at,check_out_at,note,marked_by)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(staff_id,attendance_date) DO UPDATE SET
       status=EXCLUDED.status,check_in_at=EXCLUDED.check_in_at,check_out_at=EXCLUDED.check_out_at,note=EXCLUDED.note,marked_by=EXCLUDED.marked_by`,
      [req.hostel_id,Number(r.staff_id),date,r.status,r.check_in_at||null,r.check_out_at||null,r.note||null,req.user.user_id]
    );
    await client.query('COMMIT'); res.json({message:`Attendance saved for ${records.length} team members`,count:records.length});
  } catch(error) { await client.query('ROLLBACK').catch(()=>{}); res.status(400).json({error:error.message}); }
  finally { client.release(); }
};
