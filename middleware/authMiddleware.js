const jwt = require('jsonwebtoken');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_hostel_secret_change_me';

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Authentication token required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.user_id) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    const result = await pool.query(
      `SELECT u.is_active, u.must_reset_password,
              COALESCE(array_agg(DISTINCT h.hostel_id) FILTER (WHERE h.hostel_id IS NOT NULL), '{}') AS hostel_ids
       FROM app_user u
       LEFT JOIN user_hostel_access uha ON uha.user_id=u.user_id
       LEFT JOIN hostel h ON h.hostel_id=uha.hostel_id AND h.is_active=true
       WHERE u.user_id=$1 GROUP BY u.user_id`,
      [decoded.user_id]
    );
    if (!result.rows[0]?.is_active) return res.status(401).json({ error: 'Account is inactive or no longer exists' });
    if (result.rows[0].must_reset_password && !(req.baseUrl === '/auth' && req.path === '/reset-password')) {
      return res.status(428).json({ error: 'Change your initial password before continuing' });
    }
    const allowedHostels = result.rows[0].hostel_ids.map(Number);
    const hostelHeader = req.get('x-hostel-id');
    const requestedHostel = Number(hostelHeader);
    if (hostelHeader && (!Number.isInteger(requestedHostel) || requestedHostel < 1)) {
      return res.status(400).json({ error: 'x-hostel-id must be a valid hostel ID' });
    }
    const activeHostel = Number.isInteger(requestedHostel) && requestedHostel > 0
      ? requestedHostel
      : allowedHostels[0];
    if (!activeHostel || !allowedHostels.includes(activeHostel)) {
      return res.status(403).json({ error: 'You do not have access to this hostel' });
    }
    req.user = decoded;
    req.hostel_id = activeHostel;
    req.accessible_hostel_ids = allowedHostels;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    next(err);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  };
}

function requirePermission(...permissions) {
  return async (req, res, next) => {
    try {
      if (!req.user?.user_id) return res.status(401).json({ error: 'Authentication required' });
      const result = await pool.query(
        `SELECT EXISTS (
           SELECT 1
           FROM app_user_role ur
           JOIN app_role_permission rp ON rp.role_id=ur.role_id
           JOIN app_permission p ON p.permission_id=rp.permission_id
           WHERE ur.user_id=$1 AND p.permission_key = ANY($2::text[])
         ) AS allowed`,
        [req.user.user_id, permissions]
      );
      if (!result.rows[0]?.allowed) return res.status(403).json({ error: 'Permission denied' });
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authenticate, requireRole, requirePermission, JWT_SECRET };
