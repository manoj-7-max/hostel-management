const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const TOKEN_EXPIRY = process.env.JWT_EXPIRES_IN || '8h';

function sendAuthServerError(res, err) {
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(err.code)) {
    return res.status(503).json({
      error: 'Database unavailable. Start PostgreSQL and confirm the DB_HOST, DB_PORT, and DB_NAME settings.'
    });
  }

  return res.status(500).json({ error: err.message || 'Unable to complete the authentication request.' });
}

exports.login = async (req, res) => {
  try {
    const { identifier, email, student_id, password, role } = req.body;
    const loginId = identifier || email || student_id;

    if (!loginId || !password || !role) {
      return res.status(400).json({ error: 'Identifier, password and role are required' });
    }

    if (!['admin', 'student', 'parent'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const roleFilter = role === 'admin'
      ? "ar.role_key IN ('super_admin', 'hostel_manager', 'warden', 'accountant', 'security', 'mess_manager')"
      : "ar.role_key = 'student'";
    const identityFilter = role === 'admin'
      ? 'LOWER(u.email) = LOWER($1)'
      : role === 'parent'
        ? 'LOWER(u.email) = LOWER($1)'
        : '(LOWER(u.email) = LOWER($1) OR s.student_id::text = $1)';
    const effectiveRoleFilter = role === 'admin'
      ? roleFilter
      : role === 'parent' ? "ar.role_key = 'parent'" : roleFilter;
    const result = await pool.query(
      `SELECT u.user_id, u.email, u.display_name AS name, u.password_hash,
              u.is_active, u.must_reset_password, u.failed_login_count, u.locked_until,
              ar.role_key, s.student_id, a.admin_id
       FROM app_user u
       JOIN app_user_role ur ON ur.user_id = u.user_id
       JOIN app_role ar ON ar.role_id = ur.role_id
       LEFT JOIN student s ON s.user_id = u.user_id
       LEFT JOIN admin_user a ON a.user_id = u.user_id
       WHERE ${identityFilter} AND ${effectiveRoleFilter}
       ORDER BY CASE ar.role_key WHEN 'super_admin' THEN 0 WHEN 'hostel_manager' THEN 1 ELSE 2 END
       LIMIT 1`,
      [String(loginId)]
    );
    const user = result.rows[0];

    const logAttempt = async (userId, succeeded) => pool.query(
      `INSERT INTO login_attempt (user_id, submitted_email, succeeded, ip_address, user_agent)
       VALUES ($1, $2, $3, NULLIF($4, '')::inet, $5)`,
      [userId || null, String(loginId).toLowerCase(), succeeded, req.ip || '', req.get('user-agent') || null]
    );

    if (!user || !user.is_active) {
      await logAttempt(user?.user_id, false);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      await logAttempt(user.user_id, false);
      return res.status(423).json({ error: 'Account temporarily locked. Try again later.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash || '');
    if (!validPassword) {
      await pool.query(
        `UPDATE app_user
         SET failed_login_count=failed_login_count+1,
             locked_until=CASE WHEN failed_login_count+1 >= 5
                               THEN COALESCE(locked_until, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
                               ELSE NULL END,
             updated_at=CURRENT_TIMESTAMP
         WHERE user_id=$1`,
        [user.user_id]
      );
      await logAttempt(user.user_id, false);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query(
      `UPDATE app_user
       SET failed_login_count=0, locked_until=NULL, last_login_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE user_id=$1`,
      [user.user_id]
    );
    await logAttempt(user.user_id, true);

    const permissionResult = await pool.query(
      `SELECT DISTINCT p.permission_key
       FROM app_user_role ur
       JOIN app_role_permission rp ON rp.role_id=ur.role_id
       JOIN app_permission p ON p.permission_id=rp.permission_id
       WHERE ur.user_id=$1`,
      [user.user_id]
    );
    const hostelResult = await pool.query(
      `SELECT h.hostel_id, h.hostel_code, h.hostel_name, h.address
       FROM user_hostel_access uha JOIN hostel h ON h.hostel_id=uha.hostel_id
       WHERE uha.user_id=$1 AND h.is_active=true ORDER BY h.hostel_name`,
      [user.user_id]
    );

    const tokenUser = {
      id: user.admin_id || user.student_id,
      user_id: user.user_id,
      admin_id: user.admin_id,
      student_id: user.student_id,
      name: user.name,
      email: user.email,
      role: role === 'admin' ? 'admin' : role === 'parent' ? 'parent' : 'student',
      role_key: user.role_key
    };

    const token = jwt.sign(tokenUser, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
    res.json({
      token,
      user: { ...tokenUser, must_reset_password: user.must_reset_password || false },
      permissions: permissionResult.rows.map((row) => row.permission_key),
      hostels: hostelResult.rows
    });
  } catch (err) {
    sendAuthServerError(res, err);
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Current password and a new password of at least 8 characters are required' });
    }

    const result = await pool.query('SELECT password_hash FROM app_user WHERE user_id=$1', [req.user.user_id]);
    const account = result.rows[0];
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const validPassword = await bcrypt.compare(currentPassword, account.password_hash || '');
    if (!validPassword) return res.status(401).json({ error: 'Current password is incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
      'UPDATE app_user SET password_hash=$1, must_reset_password=false, updated_at=CURRENT_TIMESTAMP WHERE user_id=$2',
      [passwordHash, req.user.user_id]
      );
      await client.query(
      'UPDATE student SET password_hash=$1, must_reset_password=false WHERE user_id=$2',
      [passwordHash, req.user.user_id]
      );
      await client.query('UPDATE admin_user SET password_hash=$1 WHERE user_id=$2', [passwordHash, req.user.user_id]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    res.json({ message: 'Password updated successfully', must_reset_password: false });
  } catch (err) {
    sendAuthServerError(res, err);
  }
};
