const { randomUUID } = require('crypto');
const pool = require('../db');

const INVOICE_SELECT = `SELECT i.*, s.name AS student_name,
  COALESCE(items.total_amount,0)::numeric AS total_amount,
  COALESCE(paid.paid_amount,0)::numeric AS paid_amount,
  COALESCE(refunds.refunded_amount,0)::numeric AS refunded_amount,
  GREATEST(COALESCE(items.total_amount,0)-COALESCE(paid.paid_amount,0)+COALESCE(refunds.refunded_amount,0),0)::numeric AS balance_due,
  COALESCE(items.lines,'[]'::json) AS items
FROM invoice i JOIN student s ON s.student_id=i.student_id
LEFT JOIN LATERAL (
  SELECT SUM(ii.quantity*ii.unit_amount) AS total_amount,
         json_agg(json_build_object('description',ii.description,'quantity',ii.quantity,'unit_amount',ii.unit_amount,'line_total',ii.quantity*ii.unit_amount)) AS lines
  FROM invoice_item ii WHERE ii.invoice_id=i.invoice_id
) items ON true
LEFT JOIN LATERAL (SELECT SUM(p.amount) AS paid_amount FROM payment p WHERE p.invoice_id=i.invoice_id AND p.status='paid') paid ON true
LEFT JOIN LATERAL (SELECT SUM(pr.amount) AS refunded_amount FROM payment_refund pr JOIN payment p ON p.payment_id=pr.payment_id WHERE p.invoice_id=i.invoice_id) refunds ON true`;

function hasPeriod(value) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value || ''); }

exports.list = async (req, res) => {
  try {
    const studentFilter = req.user.role === 'student' ? 'AND i.student_id=$2' : '';
    const params = req.user.role === 'student' ? [req.hostel_id, req.user.student_id] : [req.hostel_id];
    const result = await pool.query(`${INVOICE_SELECT} WHERE i.hostel_id=$1 ${studentFilter} ORDER BY i.due_date DESC LIMIT 500`, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.listFeeTypes = async (req, res) => {
  const result = await pool.query(
    `SELECT ft.fee_type_id, ft.fee_code, ft.fee_name, ft.is_recurring, fr.amount, fr.effective_from, fr.effective_until
     FROM fee_type ft LEFT JOIN LATERAL (
       SELECT amount,effective_from,effective_until FROM fee_rate WHERE fee_type_id=ft.fee_type_id
       ORDER BY effective_from DESC LIMIT 1
     ) fr ON true WHERE ft.hostel_id=$1 AND ft.is_active=true ORDER BY ft.fee_name`,
    [req.hostel_id]
  );
  res.json(result.rows);
};

exports.setRate = async (req, res) => {
  const feeTypeId = Number(req.params.id); const amount = Number(req.body.amount);
  if (!Number.isInteger(feeTypeId) || !Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'A fee type and non-negative amount are required' });
  const result = await pool.query(
    `INSERT INTO fee_rate(hostel_id,fee_type_id,amount,effective_from)
     SELECT $1,fee_type_id,$3,COALESCE($4::date,CURRENT_DATE) FROM fee_type WHERE fee_type_id=$2 AND hostel_id=$1
     RETURNING *`,
    [req.hostel_id, feeTypeId, amount, req.body.effective_from || null]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Fee category not found in this hostel' });
  res.status(201).json(result.rows[0]);
};

exports.create = async (req, res) => {
  const { student_id, billing_period, due_date, items, notes } = req.body;
  if (!Number.isInteger(Number(student_id)) || !hasPeriod(billing_period) || !/^\d{4}-\d{2}-\d{2}$/.test(due_date || '') || !Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Resident, billing month, due date, and invoice lines are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resident = await client.query('SELECT student_id FROM student WHERE student_id=$1 AND hostel_id=$2', [student_id, req.hostel_id]);
    if (!resident.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Resident not found in this hostel' }); }
    const branch = await client.query('SELECT hostel_code FROM hostel WHERE hostel_id=$1', [req.hostel_id]);
    const invoiceNumber = `INV-${branch.rows[0].hostel_code.slice(0,8)}-${billing_period}-${student_id}-${randomUUID().slice(0,4).toUpperCase()}`;
    const invoice = await client.query(
      `INSERT INTO invoice(invoice_number,hostel_id,student_id,billing_period,due_date,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [invoiceNumber, req.hostel_id, student_id, billing_period, due_date, notes || null, req.user.user_id]
    );
    for (const item of items) {
      const quantity = Number(item.quantity || 1); const unitAmount = Number(item.unit_amount);
      if (!item.description?.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitAmount) || unitAmount < 0) throw new Error('Invoice lines need a description, positive quantity, and non-negative price');
      if (item.fee_type_id) {
        const feeType = await client.query('SELECT fee_type_id FROM fee_type WHERE fee_type_id=$1 AND hostel_id=$2', [item.fee_type_id, req.hostel_id]);
        if (!feeType.rowCount) throw new Error('Fee category belongs to another hostel or does not exist');
      }
      await client.query(
        `INSERT INTO invoice_item(invoice_id,fee_type_id,description,quantity,unit_amount)
         VALUES ($1,$2,$3,$4,$5)`,
        [invoice.rows[0].invoice_id, item.fee_type_id || null, item.description.trim(), quantity, unitAmount]
      );
    }
    await client.query(
      `INSERT INTO app_notification(user_id,hostel_id,notification_type,title,message,target_url)
       SELECT user_id,$1,'invoice','New hostel invoice',$2,'/student' FROM student WHERE student_id=$3 AND user_id IS NOT NULL`,
      [req.hostel_id, `Invoice ${invoiceNumber} is ready.`, student_id]
    );
    await client.query('COMMIT');
    res.status(201).json(invoice.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.generateMonthly = async (req, res) => {
  const { billing_period, due_date } = req.body;
  if (!hasPeriod(billing_period) || !/^\d{4}-\d{2}-\d{2}$/.test(due_date || '')) return res.status(400).json({ error: 'Provide a billing month as YYYY-MM and a due date as YYYY-MM-DD' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const branch = await client.query('SELECT hostel_code FROM hostel WHERE hostel_id=$1', [req.hostel_id]);
    const residents = await client.query('SELECT student_id FROM student WHERE hostel_id=$1 AND is_active=true ORDER BY student_id', [req.hostel_id]);
    const rates = await client.query(
      `SELECT DISTINCT ON (ft.fee_type_id) ft.fee_type_id, ft.fee_name, fr.amount
       FROM fee_type ft JOIN fee_rate fr ON fr.fee_type_id=ft.fee_type_id AND fr.hostel_id=ft.hostel_id
       WHERE ft.hostel_id=$1 AND ft.is_active=true AND ft.is_recurring=true
         AND fr.effective_from <= ((($2 || '-01')::date + INTERVAL '1 month') - INTERVAL '1 day')::date
         AND (fr.effective_until IS NULL OR fr.effective_until >= ($2 || '-01')::date)
       ORDER BY ft.fee_type_id, fr.effective_from DESC`,
      [req.hostel_id, billing_period]
    );
    if (!rates.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'No recurring fee rates are configured for that month' }); }
    let created = 0;
    for (const resident of residents.rows) {
      const invoiceNumber = `INV-${branch.rows[0].hostel_code.slice(0,8)}-${billing_period}-${resident.student_id}`;
      const invoice = await client.query(
        `INSERT INTO invoice(invoice_number,hostel_id,student_id,billing_period,due_date,created_by)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT(student_id,billing_period) DO NOTHING RETURNING invoice_id`,
        [invoiceNumber, req.hostel_id, resident.student_id, billing_period, due_date, req.user.user_id]
      );
      if (!invoice.rowCount) continue;
      for (const rate of rates.rows) {
        await client.query(
          'INSERT INTO invoice_item(invoice_id,fee_type_id,description,quantity,unit_amount) VALUES ($1,$2,$3,1,$4)',
          [invoice.rows[0].invoice_id, rate.fee_type_id, rate.fee_name, rate.amount]
        );
      }
      await client.query(
        `INSERT INTO app_notification(user_id,hostel_id,notification_type,title,message,target_url)
         SELECT user_id,$1,'invoice','New hostel invoice',$2,'/student' FROM student WHERE student_id=$3 AND user_id IS NOT NULL`,
        [req.hostel_id, `Invoice ${invoiceNumber} is ready. Due ${due_date}.`, resident.student_id]
      );
      created += 1;
    }
    await client.query('COMMIT');
    res.status(201).json({ created, skipped: residents.rowCount-created, billing_period });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.recordPayment = async (req, res) => {
  const amount = Number(req.body.amount); const method = String(req.body.payment_method || '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || !method) return res.status(400).json({ error: 'A positive amount and payment method are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const invoice = await client.query(
      `SELECT * FROM invoice WHERE invoice_id=$1 AND hostel_id=$2 FOR UPDATE`,
      [req.params.id, req.hostel_id]
    );
    if (!invoice.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Invoice not found in this hostel' }); }
    if (invoice.rows[0].status === 'void') { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Voided invoices cannot accept payments' }); }
    const balanceResult = await client.query(
      `SELECT COALESCE((SELECT SUM(quantity*unit_amount) FROM invoice_item WHERE invoice_id=$1),0)
       - COALESCE((SELECT SUM(amount) FROM payment WHERE invoice_id=$1 AND status='paid'),0)
       + COALESCE((SELECT SUM(pr.amount) FROM payment_refund pr JOIN payment p ON p.payment_id=pr.payment_id WHERE p.invoice_id=$1),0) AS balance`,
      [invoice.rows[0].invoice_id]
    );
    const balance = Number(balanceResult.rows[0].balance);
    if (amount > balance) { await client.query('ROLLBACK'); return res.status(400).json({ error: `Payment exceeds the remaining balance of ${balance.toFixed(2)}` }); }
    const payment = await client.query(
      `INSERT INTO payment(student_id,amount,purpose,status,payment_date,hostel_id,invoice_id,payment_method,transaction_reference)
       VALUES ($1,$2,'invoice','paid',CURRENT_DATE,$3,$4,$5,$6) RETURNING *`,
      [invoice.rows[0].student_id, amount, req.hostel_id, invoice.rows[0].invoice_id, method, req.body.transaction_reference || `RCPT-${randomUUID().slice(0,8).toUpperCase()}`]
    );
    const newBalance = balance - amount;
    await client.query('UPDATE invoice SET status=$1 WHERE invoice_id=$2', [newBalance <= 0 ? 'paid' : 'partial', invoice.rows[0].invoice_id]);
    await client.query(
      `INSERT INTO app_notification(user_id,hostel_id,notification_type,title,message,target_url)
       SELECT user_id,$1,'payment','Payment received',$2,'/student' FROM student WHERE student_id=$3 AND user_id IS NOT NULL`,
      [req.hostel_id, `A payment of Rs. ${amount.toFixed(2)} was recorded for invoice ${invoice.rows[0].invoice_number}.`, invoice.rows[0].student_id]
    );
    await client.query('COMMIT');
    res.status(201).json({ payment: payment.rows[0], balance_due: newBalance });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};

exports.refundPayment = async (req, res) => {
  const amount = Number(req.body.amount); const reason = String(req.body.reason || '').trim();
  if (!Number.isFinite(amount) || amount <= 0 || reason.length < 3) return res.status(400).json({ error: 'A positive refund amount and a reason are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const payment = await client.query('SELECT * FROM payment WHERE payment_id=$1 AND hostel_id=$2 AND status=\'paid\' FOR UPDATE', [req.params.id, req.hostel_id]);
    if (!payment.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Paid payment not found in this hostel' }); }
    const previous = await client.query('SELECT COALESCE(SUM(amount),0) AS total FROM payment_refund WHERE payment_id=$1', [payment.rows[0].payment_id]);
    if (Number(previous.rows[0].total) + amount > Number(payment.rows[0].amount)) {
      await client.query('ROLLBACK'); return res.status(400).json({ error: 'Refund exceeds the remaining refundable amount' });
    }
    const reference = `RF-${randomUUID().replaceAll('-', '').slice(0,16).toUpperCase()}`;
    const refund = await client.query(
      `INSERT INTO payment_refund(refund_reference,payment_id,hostel_id,amount,reason,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [reference, payment.rows[0].payment_id, req.hostel_id, amount, reason, req.user.user_id]
    );
    if (payment.rows[0].invoice_id) {
      const balance = await client.query(
        `SELECT COALESCE(SUM(ii.quantity*ii.unit_amount),0)-COALESCE((SELECT SUM(p.amount) FROM payment p WHERE p.invoice_id=i.invoice_id AND p.status='paid'),0)
           + COALESCE((SELECT SUM(pr.amount) FROM payment_refund pr JOIN payment p ON p.payment_id=pr.payment_id WHERE p.invoice_id=i.invoice_id),0) AS balance
         FROM invoice i LEFT JOIN invoice_item ii ON ii.invoice_id=i.invoice_id WHERE i.invoice_id=$1 GROUP BY i.invoice_id`,
        [payment.rows[0].invoice_id]
      );
      const netPaid = await client.query(
        `SELECT COALESCE((SELECT SUM(p.amount) FROM payment p WHERE p.invoice_id=$1 AND p.status='paid'),0)
              -COALESCE((SELECT SUM(pr.amount) FROM payment_refund pr JOIN payment p ON p.payment_id=pr.payment_id WHERE p.invoice_id=$1),0) AS amount`,
        [payment.rows[0].invoice_id]
      );
      const status = Number(balance.rows[0].balance) <= 0 ? 'paid' : Number(netPaid.rows[0].amount) <= 0 ? 'open' : 'partial';
      await client.query('UPDATE invoice SET status=$1 WHERE invoice_id=$2', [status, payment.rows[0].invoice_id]);
    }
    await client.query('COMMIT');
    res.status(201).json(refund.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(400).json({ error: error.message });
  } finally {
    client.release();
  }
};
