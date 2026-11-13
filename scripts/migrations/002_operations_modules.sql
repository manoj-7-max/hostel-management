CREATE TABLE IF NOT EXISTS attendance_record (
  attendance_id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave')),
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (student_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_record (attendance_date);

CREATE TABLE IF NOT EXISTS staff_member (
  staff_id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  job_title VARCHAR(80) NOT NULL,
  email VARCHAR(160) UNIQUE,
  phone VARCHAR(30),
  shift VARCHAR(30) NOT NULL DEFAULT 'Day',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_item (
  inventory_id SERIAL PRIMARY KEY,
  item_name VARCHAR(140) NOT NULL UNIQUE,
  category VARCHAR(80) NOT NULL,
  quantity NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit VARCHAR(30) NOT NULL,
  reorder_level NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  location VARCHAR(120),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO staff_member (name, job_title, email, phone, shift)
VALUES
  ('Ravi Kumar', 'Warden', 'ravi.warden@hostel.com', '9876500001', 'Day'),
  ('Meena Das', 'Kitchen Manager', 'meena.kitchen@hostel.com', '9876500002', 'Day'),
  ('Arjun Rao', 'Maintenance', 'arjun.maintenance@hostel.com', '9876500003', 'Evening')
ON CONFLICT (email) DO NOTHING;

INSERT INTO inventory_item (item_name, category, quantity, unit, reorder_level, location)
VALUES
  ('Study desk', 'Furniture', 18, 'units', 4, 'Storage room A'),
  ('LED bulb', 'Electrical', 36, 'units', 10, 'Maintenance store'),
  ('Cleaning liquid', 'Housekeeping', 12, 'litres', 4, 'Housekeeping store')
ON CONFLICT (item_name) DO NOTHING;
