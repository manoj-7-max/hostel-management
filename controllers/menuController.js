const pool = require('../db');

// Get mess menu
exports.getMenu = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM mess_menu WHERE hostel_id=$1 ORDER BY menu_id DESC', [req.hostel_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.addMenuItem = async (req, res) => {
  const { day, meal_type, description } = req.body;
  if (!day || !meal_type || !description) {
    return res.status(400).json({ error: 'Day, meal type, and description are required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO mess_menu (day, meal_type, description, hostel_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [day, meal_type, description.trim(), req.hostel_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to add menu item.' });
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM mess_menu WHERE menu_id=$1 AND hostel_id=$2 RETURNING menu_id', [req.params.id, req.hostel_id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ message: 'Menu item deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to delete menu item.' });
  }
};
