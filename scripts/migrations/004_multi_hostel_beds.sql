CREATE TABLE IF NOT EXISTS hostel (
  hostel_id SERIAL PRIMARY KEY,
  hostel_code VARCHAR(30) NOT NULL UNIQUE,
  hostel_name VARCHAR(140) NOT NULL,
  address TEXT,
  contact_phone VARCHAR(30),
  gender_policy VARCHAR(20) NOT NULL DEFAULT 'mixed' CHECK (gender_policy IN ('male','female','mixed')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS building (
  building_id SERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  building_name VARCHAR(120) NOT NULL,
  UNIQUE(hostel_id, building_name),
  UNIQUE(building_id, hostel_id)
);

CREATE TABLE IF NOT EXISTS floor (
  floor_id SERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  building_id INT NOT NULL,
  floor_number INT NOT NULL,
  floor_name VARCHAR(80),
  FOREIGN KEY(building_id, hostel_id) REFERENCES building(building_id, hostel_id) ON DELETE RESTRICT,
  UNIQUE(building_id, floor_number),
  UNIQUE(floor_id, hostel_id)
);

INSERT INTO hostel (hostel_code, hostel_name, address, gender_policy) VALUES
  ('MAIN', 'Main Hostel', 'Demonstration address, Main Campus', 'mixed'),
  ('ANNEX', 'Garden Annex', 'Demonstration address, North Campus', 'mixed')
ON CONFLICT (hostel_code) DO NOTHING;

ALTER TABLE room ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);
ALTER TABLE room ADD COLUMN IF NOT EXISTS building_id INT;
ALTER TABLE room ADD COLUMN IF NOT EXISTS floor_id INT;
ALTER TABLE student ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);
ALTER TABLE room_allocation ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);
ALTER TABLE room_allocation ADD COLUMN IF NOT EXISTS bed_id INT;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);
ALTER TABLE outpass ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);
ALTER TABLE attendance_record ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);
ALTER TABLE staff_member ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);
ALTER TABLE inventory_item ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);
ALTER TABLE mess_menu ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);
ALTER TABLE announcement ADD COLUMN IF NOT EXISTS hostel_id INT REFERENCES hostel(hostel_id);

INSERT INTO building (hostel_id, building_name)
SELECT hostel_id, 'Main Building' FROM hostel WHERE hostel_code='MAIN'
ON CONFLICT DO NOTHING;
INSERT INTO floor (hostel_id, building_id, floor_number, floor_name)
SELECT b.hostel_id, b.building_id, 0, 'Ground Floor'
FROM building b JOIN hostel h ON h.hostel_id=b.hostel_id
WHERE h.hostel_code='MAIN'
ON CONFLICT DO NOTHING;

UPDATE room r SET hostel_id=h.hostel_id, building_id=b.building_id, floor_id=f.floor_id
FROM hostel h JOIN building b ON b.hostel_id=h.hostel_id
JOIN floor f ON f.building_id=b.building_id AND f.floor_number=0
WHERE h.hostel_code='MAIN' AND r.hostel_id IS NULL;
UPDATE student SET hostel_id=(SELECT hostel_id FROM hostel WHERE hostel_code='MAIN') WHERE hostel_id IS NULL;
UPDATE room_allocation ra SET hostel_id=r.hostel_id FROM room r WHERE ra.room_id=r.room_id AND ra.hostel_id IS NULL;
UPDATE payment p SET hostel_id=s.hostel_id FROM student s WHERE p.student_id=s.student_id AND p.hostel_id IS NULL;
UPDATE complaint c SET hostel_id=s.hostel_id FROM student s WHERE c.student_id=s.student_id AND c.hostel_id IS NULL;
UPDATE outpass o SET hostel_id=s.hostel_id FROM student s WHERE o.student_id=s.student_id AND o.hostel_id IS NULL;
UPDATE attendance_record a SET hostel_id=s.hostel_id FROM student s WHERE a.student_id=s.student_id AND a.hostel_id IS NULL;
UPDATE staff_member SET hostel_id=(SELECT hostel_id FROM hostel WHERE hostel_code='MAIN') WHERE hostel_id IS NULL;
UPDATE inventory_item SET hostel_id=(SELECT hostel_id FROM hostel WHERE hostel_code='MAIN') WHERE hostel_id IS NULL;
UPDATE mess_menu SET hostel_id=(SELECT hostel_id FROM hostel WHERE hostel_code='MAIN') WHERE hostel_id IS NULL;
UPDATE announcement SET hostel_id=(SELECT hostel_id FROM hostel WHERE hostel_code='MAIN') WHERE hostel_id IS NULL;

CREATE TABLE IF NOT EXISTS bed (
  bed_id SERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  room_id INT NOT NULL REFERENCES room(room_id) ON DELETE CASCADE,
  bed_number VARCHAR(20) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  FOREIGN KEY(room_id) REFERENCES room(room_id) ON DELETE CASCADE,
  UNIQUE(room_id, bed_number),
  UNIQUE(bed_id, room_id, hostel_id)
);

INSERT INTO bed (hostel_id, room_id, bed_number)
SELECT r.hostel_id, r.room_id, n::text
FROM room r CROSS JOIN LATERAL generate_series(1, GREATEST(r.capacity, 0)) AS n
ON CONFLICT (room_id, bed_number) DO NOTHING;

WITH allocation_order AS (
  SELECT allocation_id, room_id, ROW_NUMBER() OVER(PARTITION BY room_id ORDER BY student_id) AS position
  FROM room_allocation
), bed_order AS (
  SELECT bed_id, room_id, ROW_NUMBER() OVER(PARTITION BY room_id ORDER BY bed_number::int NULLS LAST, bed_id) AS position
  FROM bed
)
UPDATE room_allocation ra SET bed_id=bo.bed_id
FROM allocation_order ao JOIN bed_order bo ON bo.room_id=ao.room_id AND bo.position=ao.position
WHERE ra.allocation_id=ao.allocation_id AND ra.bed_id IS NULL;

UPDATE room_allocation SET hostel_id=(SELECT hostel_id FROM room WHERE room_id=room_allocation.room_id) WHERE hostel_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_allocation_bed_once ON room_allocation(bed_id) WHERE bed_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_student_hostel ON student(hostel_id, student_id);
CREATE INDEX IF NOT EXISTS idx_room_hostel ON room(hostel_id, room_id);
CREATE INDEX IF NOT EXISTS idx_payment_hostel_date ON payment(hostel_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_hostel_date ON attendance_record(hostel_id, attendance_date DESC);

CREATE TABLE IF NOT EXISTS user_hostel_access (
  user_id INT NOT NULL REFERENCES app_user(user_id) ON DELETE CASCADE,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE CASCADE,
  granted_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  granted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, hostel_id)
);

INSERT INTO user_hostel_access(user_id, hostel_id)
SELECT u.user_id, h.hostel_id FROM app_user u CROSS JOIN hostel h
JOIN app_user_role ur ON ur.user_id=u.user_id
JOIN app_role ar ON ar.role_id=ur.role_id AND ar.role_key='super_admin'
ON CONFLICT DO NOTHING;
INSERT INTO user_hostel_access(user_id, hostel_id)
SELECT s.user_id, s.hostel_id FROM student s WHERE s.user_id IS NOT NULL AND s.hostel_id IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS audit_log (
  audit_id BIGSERIAL PRIMARY KEY,
  user_id INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  hostel_id INT REFERENCES hostel(hostel_id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(80),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address INET,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_log_hostel_time ON audit_log(hostel_id, created_at DESC);

INSERT INTO building(hostel_id, building_name)
SELECT hostel_id, 'Garden Wing' FROM hostel WHERE hostel_code='ANNEX'
ON CONFLICT DO NOTHING;
INSERT INTO floor(hostel_id, building_id, floor_number, floor_name)
SELECT b.hostel_id,b.building_id,0,'Ground Floor' FROM building b
JOIN hostel h ON h.hostel_id=b.hostel_id WHERE h.hostel_code='ANNEX'
ON CONFLICT DO NOTHING;
INSERT INTO room(room_number, capacity, occupancy, hostel_id, building_id, floor_id)
SELECT 'A-' || n, 4, 0, h.hostel_id, b.building_id, f.floor_id
FROM hostel h JOIN building b ON b.hostel_id=h.hostel_id
JOIN floor f ON f.building_id=b.building_id AND f.floor_number=0
CROSS JOIN generate_series(1, 4) n
WHERE h.hostel_code='ANNEX'
ON CONFLICT DO NOTHING;
INSERT INTO bed(hostel_id, room_id, bed_number)
SELECT r.hostel_id, r.room_id, n::text FROM room r
JOIN hostel h ON h.hostel_id=r.hostel_id AND h.hostel_code='ANNEX'
CROSS JOIN generate_series(1, 4) n
ON CONFLICT (room_id, bed_number) DO NOTHING;
