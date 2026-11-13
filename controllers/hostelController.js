const pool = require('../db');

exports.listHostels = async (req, res) => {
  const result = await pool.query(
    `SELECT h.hostel_id, h.hostel_code, h.hostel_name, h.address, h.contact_phone, h.gender_policy, h.is_active
     FROM hostel h WHERE h.hostel_id=ANY($1::int[]) ORDER BY h.hostel_name`,
    [req.accessible_hostel_ids]
  );
  res.json(result.rows);
};

exports.createHostel = async (req, res) => {
  const { hostel_code, hostel_name, address, contact_phone, gender_policy='mixed' } = req.body;
  if (!hostel_code?.trim() || !hostel_name?.trim() || !['male','female','mixed'].includes(gender_policy)) {
    return res.status(400).json({ error: 'A branch code, name, and valid gender policy are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hostel = await client.query(
      `INSERT INTO hostel(hostel_code, hostel_name, address, contact_phone, gender_policy)
       VALUES (UPPER($1), $2, $3, $4, $5) RETURNING *`,
      [hostel_code.trim(), hostel_name.trim(), address || null, contact_phone || null, gender_policy]
    );
    const building = await client.query(
      `INSERT INTO building(hostel_id, building_name) VALUES ($1, 'Main Building') RETURNING building_id`,
      [hostel.rows[0].hostel_id]
    );
    await client.query(
      `INSERT INTO floor(hostel_id, building_id, floor_number, floor_name)
       VALUES ($1, $2, 0, 'Ground Floor')`,
      [hostel.rows[0].hostel_id, building.rows[0].building_id]
    );
    await client.query(
      `INSERT INTO user_hostel_access(user_id, hostel_id, granted_by)
       SELECT ur.user_id, $1, $2 FROM app_user_role ur JOIN app_role r ON r.role_id=ur.role_id
       WHERE r.role_key='super_admin' ON CONFLICT DO NOTHING`,
      [hostel.rows[0].hostel_id, req.user.user_id]
    );
    await client.query('COMMIT');
    res.status(201).json(hostel.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.listLocations = async (req, res) => {
  const result = await pool.query(
    `SELECT b.building_id, b.building_name,
            COALESCE(json_agg(json_build_object('floor_id', f.floor_id, 'floor_number', f.floor_number, 'floor_name', f.floor_name)
              ORDER BY f.floor_number) FILTER (WHERE f.floor_id IS NOT NULL), '[]'::json) AS floors
     FROM building b LEFT JOIN floor f ON f.building_id=b.building_id
     WHERE b.hostel_id=$1 GROUP BY b.building_id ORDER BY b.building_name`,
    [req.hostel_id]
  );
  res.json(result.rows);
};

exports.addBuilding = async (req, res) => {
  const buildingName = req.body.building_name?.trim();
  if (!buildingName) return res.status(400).json({ error: 'Building name is required' });
  try {
    const result = await pool.query(
      'INSERT INTO building(hostel_id, building_name) VALUES ($1, $2) RETURNING *',
      [req.hostel_id, buildingName]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

exports.addFloor = async (req, res) => {
  const floorNumber = Number(req.body.floor_number);
  if (!Number.isInteger(floorNumber) || !Number.isInteger(Number(req.body.building_id))) {
    return res.status(400).json({ error: 'A building and whole-number floor are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO floor(hostel_id, building_id, floor_number, floor_name)
       SELECT $1, building_id, $3, $4 FROM building WHERE building_id=$2 AND hostel_id=$1 RETURNING *`,
      [req.hostel_id, Number(req.body.building_id), floorNumber, req.body.floor_name || null]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Building not found in this hostel' });
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
