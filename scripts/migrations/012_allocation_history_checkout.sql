ALTER TABLE room_allocation ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP;
ALTER TABLE room_allocation ADD COLUMN IF NOT EXISTS checked_out_by INT REFERENCES app_user(user_id) ON DELETE SET NULL;
ALTER TABLE room_allocation ADD COLUMN IF NOT EXISTS checkout_note TEXT;

ALTER TABLE room_allocation DROP CONSTRAINT IF EXISTS room_allocation_student_id_key;
ALTER TABLE room_allocation DROP CONSTRAINT IF EXISTS room_allocation_room_id_student_id_key;
DROP INDEX IF EXISTS idx_room_allocation_bed_once;

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_allocation_one_active_student
  ON room_allocation(student_id) WHERE checked_out_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_allocation_bed_once
  ON room_allocation(bed_id) WHERE bed_id IS NOT NULL AND checked_out_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_room_allocation_history
  ON room_allocation(hostel_id,student_id,allocation_date DESC);
