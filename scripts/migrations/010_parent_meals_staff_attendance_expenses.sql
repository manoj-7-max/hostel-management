ALTER TABLE guardian ADD COLUMN IF NOT EXISTS user_id INT REFERENCES app_user(user_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_guardian_user ON guardian(user_id, hostel_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS staff_attendance (
  staff_attendance_id BIGSERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  staff_id INT NOT NULL REFERENCES staff_member(staff_id) ON DELETE RESTRICT,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL CHECK(status IN ('present','absent','late','leave')),
  check_in_at TIMESTAMP,
  check_out_at TIMESTAMP,
  note TEXT,
  marked_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(staff_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_hostel_date ON staff_attendance(hostel_id, attendance_date DESC);

CREATE TABLE IF NOT EXISTS meal_subscription (
  subscription_id BIGSERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  student_id INT NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
  plan_name VARCHAR(80) NOT NULL DEFAULT 'Standard',
  start_date DATE NOT NULL,
  end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','ended')),
  monthly_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(monthly_amount >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_meal_subscription_student ON meal_subscription(hostel_id, student_id, status);

CREATE TABLE IF NOT EXISTS meal_attendance (
  meal_attendance_id BIGSERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  student_id INT NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
  meal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  meal_type VARCHAR(20) NOT NULL CHECK(meal_type IN ('breakfast','lunch','snacks','dinner')),
  served_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  marked_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  UNIQUE(student_id, meal_date, meal_type)
);
CREATE INDEX IF NOT EXISTS idx_meal_attendance_hostel_date ON meal_attendance(hostel_id, meal_date DESC);

CREATE TABLE IF NOT EXISTS hostel_expense (
  expense_id BIGSERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
  vendor VARCHAR(140),
  reference_number VARCHAR(120),
  recorded_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_expense_hostel_date ON hostel_expense(hostel_id, expense_date DESC);

INSERT INTO app_role_permission(role_id, permission_id)
SELECT r.role_id, p.permission_id FROM app_role r CROSS JOIN app_permission p
WHERE (r.role_key='mess_manager' AND p.permission_key IN ('students.read','rooms.read','mess.read','mess.manage','inventory.manage','reports.read'))
   OR (r.role_key='warden' AND p.permission_key IN ('staff.manage','reports.read'))
ON CONFLICT DO NOTHING;
