CREATE TABLE IF NOT EXISTS app_role (
  role_id SERIAL PRIMARY KEY,
  role_key VARCHAR(40) NOT NULL UNIQUE,
  display_name VARCHAR(80) NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS app_permission (
  permission_id SERIAL PRIMARY KEY,
  permission_key VARCHAR(80) NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS app_user (
  user_id SERIAL PRIMARY KEY,
  email VARCHAR(160) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_reset_password BOOLEAN NOT NULL DEFAULT false,
  failed_login_count INT NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until TIMESTAMP,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_user_email_lower ON app_user (LOWER(email));

CREATE TABLE IF NOT EXISTS app_user_role (
  user_id INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  role_id INT NOT NULL REFERENCES app_role(role_id) ON DELETE CASCADE,
  assigned_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS app_role_permission (
  role_id INT NOT NULL REFERENCES app_role(role_id) ON DELETE CASCADE,
  permission_id INT NOT NULL REFERENCES app_permission(permission_id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS login_attempt (
  attempt_id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  submitted_email VARCHAR(160) NOT NULL,
  succeeded BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_login_attempt_email_date ON login_attempt (LOWER(submitted_email), attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempt_date ON login_attempt (attempted_at DESC);

ALTER TABLE admin_user ADD COLUMN IF NOT EXISTS user_id INT REFERENCES app_user(user_id);
ALTER TABLE student ADD COLUMN IF NOT EXISTS user_id INT REFERENCES app_user(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_user_identity ON admin_user (user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_identity ON student (user_id) WHERE user_id IS NOT NULL;

INSERT INTO app_role (role_key, display_name) VALUES
  ('super_admin', 'Super Administrator'),
  ('hostel_manager', 'Hostel Manager'),
  ('warden', 'Warden'),
  ('accountant', 'Accountant'),
  ('security', 'Security Personnel'),
  ('mess_manager', 'Mess Manager'),
  ('student', 'Student'),
  ('parent', 'Parent / Guardian')
ON CONFLICT (role_key) DO NOTHING;

INSERT INTO app_permission (permission_key, description) VALUES
  ('hostels.manage', 'Create and configure hostel branches'),
  ('users.manage', 'Create users and assign roles'),
  ('students.read', 'Read resident records'),
  ('students.manage', 'Admit and update residents'),
  ('rooms.read', 'Read rooms and occupancy'),
  ('rooms.manage', 'Manage rooms, floors, buildings, and beds'),
  ('allocations.manage', 'Allocate, transfer, and check out residents'),
  ('fees.read', 'Read invoices and payments'),
  ('fees.manage', 'Create invoices and record payments or refunds'),
  ('attendance.read', 'Read attendance records'),
  ('attendance.manage', 'Record attendance and approved corrections'),
  ('leave.manage', 'Review leave requests and returns'),
  ('visitors.manage', 'Register and track visitors'),
  ('complaints.read', 'Read complaints'),
  ('complaints.manage', 'Assign and resolve complaints'),
  ('mess.manage', 'Manage menus, subscriptions, and meal records'),
  ('mess.read', 'Read hostel menus and meal information'),
  ('staff.manage', 'Manage staff records and duty assignments'),
  ('inventory.manage', 'Manage stock and inventory'),
  ('maintenance.manage', 'Manage maintenance requests'),
  ('reports.read', 'Read operational reports'),
  ('reports.financial', 'Read financial reports'),
  ('announcements.manage', 'Create hostel announcements'),
  ('announcements.read', 'Read announcements for an authorized hostel'),
  ('settings.manage', 'Manage system settings'),
  ('audit.read', 'Read administrative audit history'),
  ('student.self', 'Read or update permitted self-service records')
ON CONFLICT (permission_key) DO NOTHING;

INSERT INTO app_user (email, display_name, password_hash, is_active, must_reset_password, created_at)
SELECT LOWER(email), name, password_hash, is_active, false, COALESCE(created_at, CURRENT_TIMESTAMP)
FROM admin_user
ON CONFLICT (email) DO NOTHING;

INSERT INTO app_user (email, display_name, password_hash, is_active, must_reset_password)
SELECT LOWER(email), name, password_hash, is_active, must_reset_password
FROM student
WHERE password_hash IS NOT NULL
ON CONFLICT (email) DO NOTHING;

UPDATE admin_user a
SET user_id = u.user_id
FROM app_user u
WHERE LOWER(a.email) = u.email AND a.user_id IS NULL;

UPDATE student s
SET user_id = u.user_id
FROM app_user u
WHERE LOWER(s.email) = u.email AND s.user_id IS NULL;

INSERT INTO app_user_role (user_id, role_id)
SELECT a.user_id, r.role_id
FROM admin_user a JOIN app_role r ON r.role_key = 'super_admin'
WHERE a.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO app_user_role (user_id, role_id)
SELECT s.user_id, r.role_id
FROM student s JOIN app_role r ON r.role_key = 'student'
WHERE s.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

WITH role_grants(role_key, permission_key) AS (
  SELECT 'super_admin', permission_key FROM app_permission
  UNION ALL SELECT 'hostel_manager', permission_key FROM app_permission
    WHERE permission_key NOT IN ('hostels.manage', 'settings.manage', 'audit.read')
  UNION ALL SELECT 'warden', permission_key FROM app_permission
    WHERE permission_key IN ('students.read','rooms.read','allocations.manage','attendance.read','attendance.manage','leave.manage','visitors.manage','maintenance.manage','complaints.read','complaints.manage','reports.read','announcements.read','announcements.manage')
  UNION ALL SELECT 'accountant', permission_key FROM app_permission
    WHERE permission_key IN ('students.read','rooms.read','fees.read','fees.manage','reports.read','reports.financial')
  UNION ALL SELECT 'security', permission_key FROM app_permission
    WHERE permission_key IN ('students.read','rooms.read','attendance.read','attendance.manage','leave.manage','visitors.manage')
  UNION ALL SELECT 'mess_manager', permission_key FROM app_permission
    WHERE permission_key IN ('students.read','mess.read','mess.manage','inventory.manage','reports.read')
  UNION ALL SELECT 'student', permission_key FROM app_permission
    WHERE permission_key IN ('student.self','rooms.read','fees.read','attendance.read','mess.read','announcements.read')
  UNION ALL SELECT 'parent', permission_key FROM app_permission
    WHERE permission_key IN ('student.self','fees.read','attendance.read','announcements.read')
)
INSERT INTO app_role_permission (role_id, permission_id)
SELECT r.role_id, p.permission_id
FROM role_grants g
JOIN app_role r ON r.role_key = g.role_key
JOIN app_permission p ON p.permission_key = g.permission_key
ON CONFLICT DO NOTHING;
