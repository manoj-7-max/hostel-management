require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');

const adminName = process.env.ADMIN_NAME || 'Hostel Admin';
const adminEmail = (process.env.ADMIN_EMAIL || 'admin@hostel.com').toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
const studentPassword = process.env.DEFAULT_STUDENT_PASSWORD || 'student123';
const demoStudents = [
  { id: 1, name: 'Kimiko', email: 'kimiko@example.com', phone: '1234567890', gender: 'Female', dob: '2002-01-01', address: '123 Main St', room: '1' },
  { id: 2, name: 'Frenchie', email: 'frenchie@example.com', phone: '2345678901', gender: 'Male', dob: '2001-05-12', address: '456 Oak Ave', room: '2' },
  { id: 3, name: 'Butcher', email: 'butcher@example.com', phone: '3456789012', gender: 'Male', dob: '2003-03-15', address: '789 Pine Rd', room: '2' },
  { id: 4, name: 'Diana', email: 'diana@example.com', phone: '4567890123', gender: 'Female', dob: '2002-07-22', address: '321 Maple St', room: '1' },
  { id: 5, name: 'Becca', email: 'becca@example.com', phone: '5678901234', gender: 'Female', dob: '2001-11-30', address: '654 Cedar Blvd', room: '3' }
];

async function prepareDatabase() {
  const adminHash = await bcrypt.hash(adminPassword, 10);
  const studentHash = await bcrypt.hash(studentPassword, 10);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const admin = await client.query(
      `INSERT INTO admin_user(name, email, password_hash, is_active)
       VALUES ($1, $2, $3, true)
       ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name, password_hash=EXCLUDED.password_hash, is_active=true
       RETURNING admin_id, email, name`,
      [adminName, adminEmail, adminHash]
    );

    const main = await client.query(
      `INSERT INTO hostel(hostel_code, hostel_name, gender_policy)
       VALUES ('MAIN', 'Main Hostel', 'mixed')
       ON CONFLICT(hostel_code) DO UPDATE SET is_active=true
       RETURNING hostel_id`
    );
    const hostelId = main.rows[0].hostel_id;
    const building = await client.query(
      `INSERT INTO building(hostel_id, building_name) VALUES ($1, 'Main Building')
       ON CONFLICT(hostel_id, building_name) DO UPDATE SET building_name=EXCLUDED.building_name
       RETURNING building_id`,
      [hostelId]
    );
    const floor = await client.query(
      `INSERT INTO floor(hostel_id, building_id, floor_number, floor_name)
       VALUES ($1, $2, 0, 'Ground Floor')
       ON CONFLICT(building_id, floor_number) DO UPDATE SET floor_name=EXCLUDED.floor_name
       RETURNING floor_id`,
      [hostelId, building.rows[0].building_id]
    );

    const adminIdentity = await client.query(
      `INSERT INTO app_user(email, display_name, password_hash, is_active)
       VALUES (LOWER($1), $2, $3, true)
       ON CONFLICT(email) DO UPDATE SET display_name=EXCLUDED.display_name, password_hash=EXCLUDED.password_hash, is_active=true
       RETURNING user_id`,
      [adminEmail, adminName, adminHash]
    );
    const adminUserId = adminIdentity.rows[0].user_id;
    await client.query('UPDATE admin_user SET user_id=$1 WHERE admin_id=$2', [adminUserId, admin.rows[0].admin_id]);
    await client.query(`INSERT INTO app_user_role(user_id, role_id)
      SELECT $1, role_id FROM app_role WHERE role_key='super_admin' ON CONFLICT DO NOTHING`, [adminUserId]);
    await client.query(
      `INSERT INTO user_hostel_access(user_id, hostel_id, granted_by)
       SELECT ur.user_id, h.hostel_id, $1 FROM app_user_role ur
       JOIN app_role r ON r.role_id=ur.role_id AND r.role_key='super_admin'
       CROSS JOIN hostel h WHERE ur.user_id=$1 AND h.is_active=true ON CONFLICT DO NOTHING`,
      [adminUserId]
    );

    const rooms = await client.query(
      `INSERT INTO room(room_number, capacity, occupancy, hostel_id, building_id, floor_id)
       SELECT n::text, 2, 0, $1, $2, $3 FROM generate_series(1, 12) n
       ON CONFLICT(floor_id, room_number) DO UPDATE SET capacity=GREATEST(room.capacity, EXCLUDED.capacity)
       RETURNING room_id, room_number, capacity`,
      [hostelId, building.rows[0].building_id, floor.rows[0].floor_id]
    );
    await client.query(
      `INSERT INTO bed(hostel_id, room_id, bed_number)
       SELECT $1, r.room_id, n::text FROM room r CROSS JOIN LATERAL generate_series(1, r.capacity) n
       WHERE r.hostel_id=$1 ON CONFLICT(room_id, bed_number) DO NOTHING`,
      [hostelId]
    );

    for (const demo of demoStudents) {
      const result = await client.query(
        `UPDATE student SET name=$1, email=LOWER($2), phone=$3, gender=$4, dob=$5, address=$6,
                            password_hash=$7, is_active=true, must_reset_password=true, hostel_id=$8
         WHERE student_id=$9 RETURNING student_id, user_id`,
        [demo.name, demo.email, demo.phone, demo.gender, demo.dob, demo.address, studentHash, hostelId, demo.id]
      );
      if (!result.rowCount) continue;
      const student = result.rows[0];
      const identity = await client.query(
        `INSERT INTO app_user(email, display_name, password_hash, is_active, must_reset_password)
         VALUES (LOWER($1), $2, $3, true, true)
         ON CONFLICT(email) DO UPDATE SET display_name=EXCLUDED.display_name, password_hash=EXCLUDED.password_hash,
                                          is_active=true, must_reset_password=true
         RETURNING user_id`,
        [demo.email, demo.name, studentHash]
      );
      const userId = identity.rows[0].user_id;
      await client.query('UPDATE student SET user_id=$1 WHERE student_id=$2', [userId, student.student_id]);
      await client.query(`INSERT INTO app_user_role(user_id, role_id)
        SELECT $1, role_id FROM app_role WHERE role_key='student' ON CONFLICT DO NOTHING`, [userId]);
      await client.query('INSERT INTO user_hostel_access(user_id, hostel_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, hostelId]);

      const roomId = await client.query('SELECT room_id FROM room WHERE hostel_id=$1 AND room_number=$2', [hostelId, demo.room]);
      if (roomId.rowCount) {
        await client.query(
          `INSERT INTO room_allocation(student_id, room_id, hostel_id, bed_id)
           SELECT $1, $2, $3, b.bed_id FROM bed b
           WHERE b.room_id=$2 AND NOT EXISTS (SELECT 1 FROM room_allocation ra WHERE ra.bed_id=b.bed_id AND ra.checked_out_at IS NULL)
             AND NOT EXISTS (SELECT 1 FROM room_allocation ra WHERE ra.student_id=$1 AND ra.checked_out_at IS NULL)
           ORDER BY b.bed_number::int LIMIT 1
           `,
          [student.student_id, roomId.rows[0].room_id, hostelId]
        );
      }
    }

    await client.query(
      `UPDATE room r SET occupancy=(SELECT COUNT(*)::int FROM room_allocation ra WHERE ra.room_id=r.room_id AND ra.checked_out_at IS NULL)
       WHERE r.hostel_id=$1`,
      [hostelId]
    );
    await client.query(
      `INSERT INTO staff_member(name, job_title, email, phone, shift, hostel_id) VALUES
       ('Ravi Kumar', 'Warden', 'ravi.warden@hostel.com', '9876500001', 'Day', $1),
       ('Meena Das', 'Kitchen Manager', 'meena.kitchen@hostel.com', '9876500002', 'Day', $1),
       ('Arjun Rao', 'Maintenance', 'arjun.maintenance@hostel.com', '9876500003', 'Evening', $1)
       ON CONFLICT(email) DO NOTHING`,
      [hostelId]
    );
    await client.query(
      `INSERT INTO inventory_item(item_name, category, quantity, unit, reorder_level, location, hostel_id) VALUES
       ('Study desk', 'Furniture', 18, 'units', 4, 'Storage room A', $1),
       ('LED bulb', 'Electrical', 36, 'units', 10, 'Maintenance store', $1),
       ('Cleaning liquid', 'Housekeeping', 12, 'litres', 4, 'Housekeeping store', $1)
       ON CONFLICT(hostel_id, item_name) DO NOTHING`,
      [hostelId]
    );
    await client.query('COMMIT');
    console.log('Demo data prepared without removing existing allocations.');
    console.log(`Admin login: ${adminEmail} / ${adminPassword}`);
    console.log(`Student login: ID 1 / ${studentPassword}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

prepareDatabase().catch((error) => {
  console.error('Database preparation failed:', error.message || error);
  process.exitCode = 1;
});
