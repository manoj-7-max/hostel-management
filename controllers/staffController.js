const pool = require('../db');

exports.listStaff = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM staff_member WHERE hostel_id=$1 ORDER BY is_active DESC, name', [req.hostel_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load staff.' });
  }
};

exports.addStaff = async (req, res) => {
  const { name, job_title, email, phone, shift } = req.body;
  if (!name || !job_title) return res.status(400).json({ error: 'Name and job title are required' });

  try {
    const result = await pool.query(
      `INSERT INTO staff_member (name, job_title, email, phone, shift, hostel_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name.trim(), job_title.trim(), email || null, phone || null, shift || 'Day', req.hostel_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to add staff member.' });
  }
};

exports.setStaffActive = async (req, res) => {
  const active = req.body.is_active;
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'is_active must be true or false' });

  try {
    const result = await pool.query(
      'UPDATE staff_member SET is_active=$1 WHERE staff_id=$2 AND hostel_id=$3 RETURNING *',
      [active, req.params.id, req.hostel_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Staff member not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to update staff member.' });
  }
};
