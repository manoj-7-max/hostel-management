ALTER TABLE complaint ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal'
  CHECK (priority IN ('low','normal','high','urgent'));
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS assigned_staff_id INT REFERENCES staff_member(staff_id) ON DELETE SET NULL;
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE IF NOT EXISTS complaint_update (
  update_id BIGSERIAL PRIMARY KEY,
  complaint_id INT NOT NULL REFERENCES complaint(complaint_id) ON DELETE CASCADE,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE CASCADE,
  user_id INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  old_status VARCHAR(30),
  new_status VARCHAR(30) NOT NULL,
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_complaint_update_complaint ON complaint_update(complaint_id, created_at DESC);

CREATE TABLE IF NOT EXISTS admission_application (
  application_id BIGSERIAL PRIMARY KEY,
  application_number VARCHAR(32) NOT NULL UNIQUE,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  applicant_user_id INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  applicant_name VARCHAR(140) NOT NULL,
  email VARCHAR(160) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  gender VARCHAR(20) NOT NULL,
  dob DATE,
  applicant_address TEXT,
  requested_move_in DATE,
  status VARCHAR(24) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','approved','rejected','waitlisted')),
  review_notes TEXT,
  reviewed_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP,
  student_id INT UNIQUE REFERENCES student(student_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admission_hostel_status ON admission_application(hostel_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS guardian (
  guardian_id BIGSERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  student_id INT REFERENCES student(student_id) ON DELETE CASCADE,
  application_id BIGINT REFERENCES admission_application(application_id) ON DELETE CASCADE,
  full_name VARCHAR(140) NOT NULL,
  relation VARCHAR(60) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  email VARCHAR(160),
  address TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((student_id IS NOT NULL)::int + (application_id IS NOT NULL)::int = 1)
);
CREATE INDEX IF NOT EXISTS idx_guardian_student ON guardian(student_id) WHERE student_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS private_document (
  document_id BIGSERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  student_id INT REFERENCES student(student_id) ON DELETE CASCADE,
  application_id BIGINT REFERENCES admission_application(application_id) ON DELETE CASCADE,
  uploaded_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  storage_key UUID NOT NULL UNIQUE,
  file_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  byte_size INT NOT NULL CHECK (byte_size BETWEEN 1 AND 5242880),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((student_id IS NOT NULL)::int + (application_id IS NOT NULL)::int = 1)
);
CREATE INDEX IF NOT EXISTS idx_private_document_student ON private_document(student_id) WHERE student_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS visitor_visit (
  visit_id BIGSERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  student_id INT NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
  visitor_name VARCHAR(140) NOT NULL,
  visitor_phone VARCHAR(30),
  relationship VARCHAR(60),
  purpose TEXT NOT NULL,
  vehicle_number VARCHAR(30),
  checked_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checked_out_at TIMESTAMP,
  registered_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  CHECK (checked_out_at IS NULL OR checked_out_at >= checked_in_at)
);
CREATE INDEX IF NOT EXISTS idx_visitor_hostel_in ON visitor_visit(hostel_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_student ON visitor_visit(student_id, checked_in_at DESC);

CREATE TABLE IF NOT EXISTS maintenance_request (
  maintenance_id BIGSERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  room_id INT REFERENCES room(room_id) ON DELETE SET NULL,
  reported_by INT REFERENCES student(student_id) ON DELETE SET NULL,
  title VARCHAR(160) NOT NULL,
  description TEXT NOT NULL,
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status VARCHAR(24) NOT NULL DEFAULT 'open' CHECK (status IN ('open','assigned','in_progress','completed','cancelled')),
  assigned_staff_id INT REFERENCES staff_member(staff_id) ON DELETE SET NULL,
  created_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_maintenance_hostel_status ON maintenance_request(hostel_id, status, priority);

CREATE TABLE IF NOT EXISTS app_notification (
  notification_id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  hostel_id INT REFERENCES hostel(hostel_id) ON DELETE CASCADE,
  notification_type VARCHAR(40) NOT NULL DEFAULT 'info',
  title VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  target_url VARCHAR(255),
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notification_user_unread ON app_notification(user_id, created_at DESC) WHERE read_at IS NULL;
