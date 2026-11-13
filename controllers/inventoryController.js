const pool = require('../db');

exports.listInventory = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM inventory_item WHERE hostel_id=$1 ORDER BY category, item_name', [req.hostel_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load inventory.' });
  }
};

exports.addInventoryItem = async (req, res) => {
  const { item_name, category, quantity, unit, reorder_level, location } = req.body;
  const qty = Number(quantity);
  const minQty = Number(reorder_level || 0);
  if (!item_name || !category || !unit || !Number.isFinite(qty) || qty < 0 || !Number.isFinite(minQty) || minQty < 0) {
    return res.status(400).json({ error: 'Enter an item, category, unit, and non-negative quantities' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO inventory_item (item_name, category, quantity, unit, reorder_level, location, hostel_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [item_name.trim(), category.trim(), qty, unit.trim(), minQty, location || null, req.hostel_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to add inventory item.' });
  }
};

exports.adjustInventory = async (req, res) => {
  const delta = Number(req.body.delta);
  if (!Number.isInteger(delta) || delta === 0) return res.status(400).json({ error: 'A non-zero whole-number delta is required' });

  try {
    const result = await pool.query(
      `UPDATE inventory_item SET quantity = quantity + $1, updated_at = CURRENT_TIMESTAMP
       WHERE inventory_id = $2 AND hostel_id=$3 AND quantity + $1 >= 0 RETURNING *`,
      [delta, req.params.id, req.hostel_id]
    );
    if (!result.rowCount) return res.status(400).json({ error: 'Item not found or quantity cannot go below zero' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to update inventory.' });
  }
};
