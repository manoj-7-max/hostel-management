ALTER TABLE private_document ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) NOT NULL DEFAULT 'pending'
  CHECK(verification_status IN ('pending','verified','rejected'));
ALTER TABLE private_document ADD COLUMN IF NOT EXISTS verification_note TEXT;
ALTER TABLE private_document ADD COLUMN IF NOT EXISTS verified_by INT REFERENCES app_user(user_id) ON DELETE SET NULL;
ALTER TABLE private_document ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_private_document_verification
  ON private_document(hostel_id,verification_status,created_at DESC);
