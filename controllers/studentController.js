const bcrypt = require('bcrypt');
const pool = require('../db');

const publicStudentFields = `
  student_id, name, email, phone, gender, dob, address, role, is_active, must_reset_password
`;

// Add student
exports.addStudent = async (req, res) => {
  try {
    const { name, email, phone, gender, dob, address, password, is_active = true } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Student password must be at least 6 characters' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const client = await pool.connect();
    let result;
    try {
      await client.query('BEGIN');
      const identity = await client.query(
        `INSERT INTO app_user(email, display_name, password_hash, is_active, must_reset_password)
         VALUES (LOWER($1), $2, $3, $4, true) RETURNING user_id`,
        [email, name, passwordHash, is_active]
      );
      result = await client.query(
        `INSERT INTO student (name, email, phone, gender, dob, address, password_hash, role, is_active, must_reset_password, user_id, hostel_id)
         VALUES ($1, LOWER($2), $3, $4, $5, $6, $7, 'student', $8, true, $9, $10)
         RETURNING ${publicStudentFields}`,
        [name, email, phone, gender, dob, address, passwordHash, is_active, identity.rows[0].user_id, req.hostel_id]
      );
      await client.query(`INSERT INTO app_user_role(user_id, role_id) SELECT $1, role_id FROM app_role WHERE role_key='student'`, [identity.rows[0].user_id]);
      await client.query('INSERT INTO user_hostel_access(user_id, hostel_id) VALUES ($1, $2)', [identity.rows[0].user_id, req.hostel_id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Get all students
exports.getAllStudents = async (req, res) => {
  try {
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined || req.query.search !== undefined;
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    if (hasPagination) {
      const [rows, count] = await Promise.all([
        pool.query(
          `SELECT s.${publicStudentFields.replaceAll(', ', ', s.')}, r.room_number
           FROM student s
           LEFT JOIN room_allocation ra ON ra.student_id=s.student_id
           LEFT JOIN room r ON r.room_id=ra.room_id
           WHERE s.hostel_id=$1 AND ($2='' OR s.name ILIKE '%' || $2 || '%' OR s.email ILIKE '%' || $2 || '%' OR s.phone ILIKE '%' || $2 || '%')
           ORDER BY s.student_id LIMIT $3 OFFSET $4`,
          [req.hostel_id, search, limit, offset]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS total FROM student s
           WHERE s.hostel_id=$1 AND ($2='' OR s.name ILIKE '%' || $2 || '%' OR s.email ILIKE '%' || $2 || '%' OR s.phone ILIKE '%' || $2 || '%')`,
          [req.hostel_id, search]
        )
      ]);
      const total = count.rows[0].total;
      return res.json({ data: rows.rows, page, limit, total, total_pages: Math.ceil(total / limit) });
    }
    const result = await pool.query(
      `SELECT s.${publicStudentFields.replaceAll(', ', ', s.')}, r.room_number
       FROM student s
       LEFT JOIN room_allocation ra ON ra.student_id = s.student_id
       LEFT JOIN room r ON r.room_id = ra.room_id
       WHERE s.hostel_id=$1
       ORDER BY s.student_id LIMIT 1000`
      , [req.hostel_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${publicStudentFields} FROM student WHERE student_id=$1 AND hostel_id=$2`,
      [req.user.student_id, req.hostel_id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Student not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyRoom = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, ra.allocation_date
       FROM room_allocation ra
       JOIN room r ON r.room_id = ra.room_id
       WHERE ra.student_id=$1 AND ra.hostel_id=$2`,
      [req.user.student_id, req.hostel_id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Update student
exports.updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, gender, dob, address, is_active } = req.body;
    const result = await pool.query(
      `UPDATE student
       SET name=$1, email=$2, phone=$3, gender=$4, dob=$5, address=$6, is_active=COALESCE($7, is_active)
       WHERE student_id=$8 AND hostel_id=$9
       RETURNING ${publicStudentFields}`,
      [name, email, phone, gender, dob, address, is_active, id, req.hostel_id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Student not found' });
    await pool.query('UPDATE app_user SET email=LOWER($1), display_name=$2, is_active=COALESCE($3, is_active) WHERE user_id=(SELECT user_id FROM student WHERE student_id=$4)', [email, name, is_active, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Delete student
exports.deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('UPDATE student SET is_active=false WHERE student_id=$1 AND hostel_id=$2 RETURNING user_id', [id, req.hostel_id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Student not found' });
    await pool.query('UPDATE app_user SET is_active=false WHERE user_id=$1', [result.rows[0].user_id]);
    res.json({ message: 'Student deactivated; history is preserved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
