const pool = require('../db');

exports.addRoom = async (req, res) => {
  const { room_number, capacity } = req.body;
  const numericCapacity = Number(capacity);
  if (!room_number || !Number.isInteger(numericCapacity) || numericCapacity < 1 || numericCapacity > 20) {
    return res.status(400).json({ error: 'A room number and capacity between 1 and 20 are required' });
  }

  const floorResult = req.body.floor_id
    ? await pool.query('SELECT floor_id, building_id FROM floor WHERE floor_id=$1 AND hostel_id=$2', [req.body.floor_id, req.hostel_id])
    : await pool.query('SELECT f.floor_id, f.building_id FROM floor f WHERE f.hostel_id=$1 ORDER BY f.floor_id LIMIT 1', [req.hostel_id]);
  if (!floorResult.rowCount) return res.status(400).json({ error: 'Select a floor belonging to the active hostel' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      'INSERT INTO room (room_number, capacity, occupancy, hostel_id, building_id, floor_id) VALUES ($1, $2, 0, $3, $4, $5) RETURNING *',
      [room_number.trim(), numericCapacity, req.hostel_id, floorResult.rows[0].building_id, floorResult.rows[0].floor_id]
    );
    await client.query(
      'INSERT INTO bed (hostel_id, room_id, bed_number) SELECT $1, $2, n::text FROM generate_series(1, $3) n',
      [req.hostel_id, result.rows[0].room_id, numericCapacity]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.getRooms = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, COUNT(ra.student_id)::int AS current_occupancy,
              h.hostel_name, b.building_name, f.floor_number
       FROM room r
       JOIN hostel h ON h.hostel_id=r.hostel_id
       LEFT JOIN building b ON b.building_id=r.building_id
       LEFT JOIN floor f ON f.floor_id=r.floor_id
       LEFT JOIN room_allocation ra ON ra.room_id=r.room_id
       WHERE r.hostel_id=$1
       GROUP BY r.room_id, h.hostel_name, b.building_name, f.floor_number
       ORDER BY CASE WHEN r.room_number ~ '^[0-9]+$' THEN r.room_number::int END NULLS LAST, r.room_number`,
      [req.hostel_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
