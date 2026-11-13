CREATE TABLE IF NOT EXISTS fee_type (
  fee_type_id SERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  fee_code VARCHAR(40) NOT NULL,
  fee_name VARCHAR(100) NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(hostel_id, fee_code),
  UNIQUE(fee_type_id, hostel_id)
);

CREATE TABLE IF NOT EXISTS fee_rate (
  fee_rate_id BIGSERIAL PRIMARY KEY,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  fee_type_id INT NOT NULL REFERENCES fee_type(fee_type_id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK(amount >= 0),
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK(effective_until IS NULL OR effective_until > effective_from),
  FOREIGN KEY(fee_type_id, hostel_id) REFERENCES fee_type(fee_type_id, hostel_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_fee_rate_effective ON fee_rate(hostel_id, fee_type_id, effective_from DESC);

CREATE TABLE IF NOT EXISTS invoice (
  invoice_id BIGSERIAL PRIMARY KEY,
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  student_id INT NOT NULL REFERENCES student(student_id) ON DELETE RESTRICT,
  billing_period CHAR(7) NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open','partial','paid','void')),
  notes TEXT,
  created_by INT REFERENCES app_user(user_id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, billing_period)
);
CREATE INDEX IF NOT EXISTS idx_invoice_hostel_period ON invoice(hostel_id, billing_period DESC, due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_student ON invoice(student_id, issue_date DESC);

CREATE TABLE IF NOT EXISTS invoice_item (
  invoice_item_id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoice(invoice_id) ON DELETE CASCADE,
  fee_type_id INT REFERENCES fee_type(fee_type_id) ON DELETE SET NULL,
  description VARCHAR(160) NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1 CHECK(quantity > 0),
  unit_amount NUMERIC(12,2) NOT NULL CHECK(unit_amount >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invoice_item_invoice ON invoice_item(invoice_id);

ALTER TABLE payment ADD COLUMN IF NOT EXISTS invoice_id BIGINT REFERENCES invoice(invoice_id) ON DELETE SET NULL;
ALTER TABLE payment ADD COLUMN IF NOT EXISTS payment_method VARCHAR(40);
ALTER TABLE payment ADD COLUMN IF NOT EXISTS transaction_reference VARCHAR(120);
CREATE INDEX IF NOT EXISTS idx_payment_invoice ON payment(invoice_id, payment_date DESC);

CREATE TABLE IF NOT EXISTS payment_refund (
  refund_id BIGSERIAL PRIMARY KEY,
  refund_reference VARCHAR(50) NOT NULL UNIQUE,
  payment_id INT NOT NULL REFERENCES payment(payment_id) ON DELETE RESTRICT,
  hostel_id INT NOT NULL REFERENCES hostel(hostel_id) ON DELETE RESTRICT,
  amount NUMERIC(12,2) NOT NULL CHECK(amount > 0),
  reason TEXT NOT NULL,
  refunded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES app_user(user_id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_refund_payment ON payment_refund(payment_id, refunded_at DESC);

INSERT INTO fee_type(hostel_id, fee_code, fee_name, is_recurring)
SELECT h.hostel_id, f.fee_code, f.fee_name, f.is_recurring
FROM hostel h CROSS JOIN (VALUES
  ('hostel_rent','Hostel rent',true),
  ('mess','Mess fee',true),
  ('security_deposit','Security deposit',false),
  ('laundry','Laundry',false)
) AS f(fee_code, fee_name, is_recurring)
ON CONFLICT(hostel_id, fee_code) DO NOTHING;

INSERT INTO fee_rate(hostel_id, fee_type_id, amount, effective_from)
SELECT ft.hostel_id, ft.fee_type_id,
       CASE ft.fee_code WHEN 'hostel_rent' THEN 5000 WHEN 'mess' THEN 3000 WHEN 'security_deposit' THEN 10000 ELSE 500 END,
       CURRENT_DATE
FROM fee_type ft
WHERE NOT EXISTS(SELECT 1 FROM fee_rate fr WHERE fr.fee_type_id=ft.fee_type_id)
ON CONFLICT DO NOTHING;
