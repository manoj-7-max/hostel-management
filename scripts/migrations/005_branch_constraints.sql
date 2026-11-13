DO $$
DECLARE constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  WHERE c.conrelid='room'::regclass AND c.contype='u'
    AND pg_get_constraintdef(c.oid)='UNIQUE (room_number)'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE room DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_room_floor_number ON room(floor_id, room_number);
ALTER TABLE room ADD CONSTRAINT fk_room_building_hostel
  FOREIGN KEY(building_id, hostel_id) REFERENCES building(building_id, hostel_id) ON DELETE RESTRICT;
ALTER TABLE room ADD CONSTRAINT fk_room_floor_hostel
  FOREIGN KEY(floor_id, hostel_id) REFERENCES floor(floor_id, hostel_id) ON DELETE RESTRICT;

ALTER TABLE room ALTER COLUMN hostel_id SET NOT NULL;
ALTER TABLE student ALTER COLUMN hostel_id SET NOT NULL;
ALTER TABLE room_allocation ALTER COLUMN hostel_id SET NOT NULL;
ALTER TABLE payment ALTER COLUMN hostel_id SET NOT NULL;
ALTER TABLE complaint ALTER COLUMN hostel_id SET NOT NULL;
ALTER TABLE outpass ALTER COLUMN hostel_id SET NOT NULL;
ALTER TABLE attendance_record ALTER COLUMN hostel_id SET NOT NULL;
ALTER TABLE staff_member ALTER COLUMN hostel_id SET NOT NULL;
ALTER TABLE inventory_item ALTER COLUMN hostel_id SET NOT NULL;
ALTER TABLE mess_menu ALTER COLUMN hostel_id SET NOT NULL;
ALTER TABLE announcement ALTER COLUMN hostel_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_hostel_access_hostel ON user_hostel_access(hostel_id, user_id);
