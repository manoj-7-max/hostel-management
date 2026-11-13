const bcrypt = require('bcrypt');
const pool = require('../db');

exports.listRoles = async (_req, res) => {
  const result = await pool.query(
    `SELECT r.role_key, r.display_name, COALESCE(array_agg(p.permission_key ORDER BY p.permission_key)
       FILTER (WHERE p.permission_key IS NOT NULL), '{}') AS permissions
     FROM app_role r LEFT JOIN app_role_permission rp ON rp.role_id=r.role_id
     LEFT JOIN app_permission p ON p.permission_id=rp.permission_id
     GROUP BY r.role_id ORDER BY r.display_name`
  );
  res.json(result.rows);
};

exports.listUsers = async (req, res) => {
  const result = await pool.query(
    `SELECT u.user_id, u.email, u.display_name, u.is_active, u.must_reset_password, u.last_login_at,
            array_agg(DISTINCT r.role_key) AS roles
     FROM app_user u JOIN app_user_role ur ON ur.user_id=u.user_id
     JOIN app_role r ON r.role_id=ur.role_id
     JOIN user_hostel_access uha ON uha.user_id=u.user_id
     WHERE uha.hostel_id=$1
     GROUP BY u.user_id ORDER BY u.display_name`,
    [req.hostel_id]
  );
  res.json(result.rows);
};

exports.createUser = async (req, res) => {
  const { email, display_name, password, role_key } = req.body;
  if (!email?.trim() || !display_name?.trim() || !password || password.length < 8 || !role_key) {
    return res.status(400).json({ error: 'Email, name, role, and a password of at least 8 characters are required' });
  }
  if (!['super_admin', 'hostel_manager', 'warden', 'accountant', 'security', 'mess_manager', 'parent'].includes(role_key)) {
    return res.status(400).json({ error: 'Choose an administrator or staff role' });
  }
  if (role_key === 'super_admin' && req.user.role_key !== 'super_admin') {
    return res.status(403).json({ error: 'Only a super administrator can grant that role' });
  }
  const hash = await bcrypt.hash(password, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const account = await client.query(
      `INSERT INTO app_user(email, display_name, password_hash, must_reset_password)
       VALUES (LOWER($1), $2, $3, true) RETURNING user_id, email, display_name, is_active, must_reset_password`,
      [email.trim(), display_name.trim(), hash]
    );
    const role = await client.query('SELECT role_id FROM app_role WHERE role_key=$1', [role_key]);
    if (!role.rowCount) throw new Error('Unknown role');
    await client.query('INSERT INTO app_user_role(user_id, role_id, assigned_by) VALUES ($1, $2, $3)', [account.rows[0].user_id, role.rows[0].role_id, req.user.user_id]);
    if (role_key === 'parent') {
      const guardians = await client.query(
        `SELECT DISTINCT hostel_id FROM guardian WHERE LOWER(email)=LOWER($1) AND hostel_id=$2`,
        [email.trim(), req.hostel_id]
      );
      if (!guardians.rowCount) throw new Error('No guardian record for this email exists in the active hostel');
      await client.query('UPDATE guardian SET user_id=$1 WHERE LOWER(email)=LOWER($2) AND hostel_id=$3', [account.rows[0].user_id, email.trim(), req.hostel_id]);
      await client.query(
        `INSERT INTO user_hostel_access(user_id, hostel_id, granted_by)
         SELECT $1, hostel_id, $2 FROM guardian WHERE user_id=$1 ON CONFLICT DO NOTHING`,
        [account.rows[0].user_id, req.user.user_id]
      );
    } else if (role_key === 'super_admin') {
      await client.query(
        `INSERT INTO user_hostel_access(user_id, hostel_id, granted_by)
         SELECT $1, hostel_id, $2 FROM hostel WHERE is_active=true ON CONFLICT DO NOTHING`,
        [account.rows[0].user_id, req.user.user_id]
      );
    } else {
      await client.query('INSERT INTO user_hostel_access(user_id, hostel_id, granted_by) VALUES ($1, $2, $3)', [account.rows[0].user_id, req.hostel_id, req.user.user_id]);
    }
    await client.query('INSERT INTO audit_log(user_id, hostel_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4, $5)', [req.user.user_id, req.hostel_id, 'user.created', 'app_user', String(account.rows[0].user_id)]);
    await client.query('COMMIT');
    res.status(201).json({ ...account.rows[0], roles: [role_key] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.setActive = async (req, res) => {
  if (typeof req.body.is_active !== 'boolean') return res.status(400).json({ error: 'is_active must be true or false' });
  const result = await pool.query(
    `UPDATE app_user u SET is_active=$1, updated_at=CURRENT_TIMESTAMP
     WHERE u.user_id=$2 AND EXISTS (SELECT 1 FROM user_hostel_access a WHERE a.user_id=u.user_id AND a.hostel_id=$3)
     RETURNING user_id, email, display_name, is_active`,
    [req.body.is_active, req.params.id, req.hostel_id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'User not found in this hostel' });
  res.json(result.rows[0]);
};
