CREATE UNIQUE INDEX IF NOT EXISTS idx_meal_subscription_one_active_per_student
  ON meal_subscription(hostel_id, student_id) WHERE status='active';

CREATE INDEX IF NOT EXISTS idx_meal_attendance_student_date
  ON meal_attendance(hostel_id,student_id,meal_date DESC);
