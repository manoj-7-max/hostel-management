const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const pool = require('../db');

exports.list = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT a.*, g.full_name AS guardian_name, g.phone AS guardian_phone,
              COALESCE(json_agg(json_build_object('document_id', d.document_id, 'file_name', d.file_name,
                'verification_status',d.verification_status,'verification_note',d.verification_note))
                FILTER (WHERE d.document_id IS NOT NULL), '[]'::json) AS documents,
              COUNT(d.document_id)::int AS document_count
       FROM admission_application a
       LEFT JOIN guardian g ON g.application_id=a.application_id AND g.is_primary=true
       LEFT JOIN private_document d ON d.application_id=a.application_id
       WHERE a.hostel_id=$1
       GROUP BY a.application_id, g.full_name, g.phone
       ORDER BY a.created_at DESC LIMIT 500`,
      [req.hostel_id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.create = async (req, res) => {
  const { applicant_name, email, phone, gender, dob, requested_move_in, address, guardian: parent } = req.body;
  if (!applicant_name?.trim() || !email?.trim() || !phone?.trim() || !gender || !dob) {
    return res.status(400).json({ error: 'Applicant name, email, phone, gender, and date of birth are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO admission_application(hostel_id, applicant_user_id, application_number, applicant_name, email, phone, gender, dob, requested_move_in, applicant_address)
       VALUES ($1, NULL, $2, $3, LOWER($4), $5, $6, $7, $8, $9) RETURNING *`,
      [req.hostel_id, `TMP-${randomUUID().replaceAll('-', '').slice(0, 24)}`, applicant_name.trim(), email.trim(), phone.trim(), gender, dob, requested_move_in || null, address || null]
    );
    const application = result.rows[0];
    const branch = await client.query('SELECT hostel_code FROM hostel WHERE hostel_id=$1', [req.hostel_id]);
    application.application_number = `AD-${branch.rows[0].hostel_code}-${String(application.application_id).padStart(5, '0')}`;
    await client.query('UPDATE admission_application SET application_number=$1 WHERE application_id=$2', [application.application_number, application.application_id]);
    if (parent?.full_name && parent?.relation && parent?.phone) {
      await client.query(
        `INSERT INTO guardian(hostel_id, application_id, full_name, relation, phone, email, address, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
        [req.hostel_id, application.application_id, parent.full_name.trim(), parent.relation.trim(), parent.phone.trim(), parent.email || null, address || parent.address || null]
      );
    }
    await client.query('COMMIT');
    res.status(201).json(application);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.review = async (req, res) => {
  const { status, review_notes, password } = req.body;
  if (!['under_review', 'approved', 'rejected', 'waitlisted'].includes(status)) {
    return res.status(400).json({ error: 'Choose under review, approved, rejected, or waitlisted' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM admission_application WHERE application_id=$1 AND hostel_id=$2 FOR UPDATE', [req.params.id, req.hostel_id]);
    if (!found.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Application not found in this hostel' });
    }
    const application = found.rows[0];
    let studentId = application.student_id;
    if (status === 'approved' && !studentId) {
      if (!password || password.length < 8) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Set an initial student password of at least 8 characters before approval' });
      }
      const existing = await client.query(
        `SELECT u.user_id, s.student_id,
                EXISTS (SELECT 1 FROM app_user_role ur JOIN app_role r ON r.role_id=ur.role_id
                        WHERE ur.user_id=u.user_id AND r.role_key='student') AS is_student_account
         FROM app_user u LEFT JOIN student s ON s.user_id=u.user_id WHERE LOWER(u.email)=LOWER($1)`,
        [application.email]
      );
      if (existing.rows[0] && (!existing.rows[0].is_student_account || existing.rows[0].student_id)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This email already belongs to an existing account' });
      }
      const hash = await bcrypt.hash(password, 10);
      const identity = existing.rowCount
        ? await client.query(`UPDATE app_user SET display_name=$1, password_hash=$2, is_active=true, must_reset_password=true, updated_at=CURRENT_TIMESTAMP WHERE user_id=$3 RETURNING user_id`, [application.applicant_name, hash, existing.rows[0].user_id])
        : await client.query(`INSERT INTO app_user(email, display_name, password_hash, must_reset_password) VALUES (LOWER($1), $2, $3, true) RETURNING user_id`, [application.email, application.applicant_name, hash]);
      const userId = identity.rows[0].user_id;
      const resident = await client.query(
        `INSERT INTO student(name, email, phone, gender, dob, address, password_hash, role, is_active, must_reset_password, user_id, hostel_id)
         VALUES ($1, LOWER($2), $3, $4, $5, $6, $7, 'student', true, true, $8, $9) RETURNING student_id`,
        [application.applicant_name, application.email, application.phone, application.gender, application.dob, application.applicant_address || null, hash, userId, req.hostel_id]
      );
      studentId = resident.rows[0].student_id;
      await client.query(`INSERT INTO app_user_role(user_id, role_id) SELECT $1, role_id FROM app_role WHERE role_key='student' ON CONFLICT DO NOTHING`, [userId]);
      await client.query('INSERT INTO user_hostel_access(user_id, hostel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, req.hostel_id]);
      await client.query('UPDATE guardian SET student_id=$1, application_id=NULL WHERE application_id=$2', [studentId, application.application_id]);
      await client.query(
        `INSERT INTO app_notification(user_id, hostel_id, notification_type, title, message)
         VALUES ($1, $2, 'admission', 'Admission approved', 'Your resident account is ready. Sign in and change your initial password.')`,
        [userId, req.hostel_id]
      );
    }
    const updated = await client.query(
      `UPDATE admission_application SET status=$1, review_notes=$2, reviewed_by=$3, reviewed_at=CURRENT_TIMESTAMP,
              student_id=$4, updated_at=CURRENT_TIMESTAMP
       WHERE application_id=$5 RETURNING *`,
      [status, review_notes || null, req.user.user_id, studentId, application.application_id]
    );
    await client.query(
      `INSERT INTO audit_log(user_id, hostel_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [req.user.user_id, req.hostel_id, `admission.${status}`, 'admission_application', String(application.application_id), JSON.stringify({ student_id: studentId })]
    );
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};
