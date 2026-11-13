DO $$
DECLARE constraint_name text;
BEGIN
  SELECT c.conname INTO constraint_name
  FROM pg_constraint c
  WHERE c.conrelid='inventory_item'::regclass AND c.contype='u'
    AND pg_get_constraintdef(c.oid)='UNIQUE (item_name)'
  LIMIT 1;
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE inventory_item DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_item_hostel_name ON inventory_item(hostel_id, item_name);
