const pool = require('../db');

exports.allocateRoom = async (req, res) => {
  const { student_id, room_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const room = await client.query('SELECT room_id FROM room WHERE room_id=$1 AND hostel_id=$2 FOR UPDATE', [room_id, req.hostel_id]);
    if (!room.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Room not found' });
    }
    const student = await client.query('SELECT student_id FROM student WHERE student_id=$1 AND hostel_id=$2', [student_id, req.hostel_id]);
    if (!student.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found in this hostel' });
    }
    const bed = await client.query(
      `SELECT b.bed_id FROM bed b
       WHERE b.room_id=$1 AND b.hostel_id=$2 AND b.is_active=true
         AND NOT EXISTS (SELECT 1 FROM room_allocation ra WHERE ra.bed_id=b.bed_id AND ra.checked_out_at IS NULL)
       ORDER BY b.bed_number::int NULLS LAST, b.bed_id FOR UPDATE SKIP LOCKED LIMIT 1`,
      [room_id, req.hostel_id]
    );
    if (!bed.rowCount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Room has no free beds' });
    }
    await client.query(
      'INSERT INTO room_allocation (student_id, room_id, hostel_id, bed_id) VALUES ($1, $2, $3, $4)',
      [student_id, room_id, req.hostel_id, bed.rows[0].bed_id]
    );
    await client.query('UPDATE room SET occupancy=occupancy+1 WHERE room_id=$1', [room_id]);
    await client.query('COMMIT');
    res.json({ message: 'Bed allocated successfully', bed_id: bed.rows[0].bed_id });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
};

exports.history = async (req,res) => {
  const result=await pool.query(
    `SELECT ra.allocation_id,ra.allocation_date,ra.checked_out_at,ra.checkout_note,
            r.room_number,b.bed_number,by_user.display_name AS checked_out_by_name
     FROM room_allocation ra JOIN room r ON r.room_id=ra.room_id
     LEFT JOIN bed b ON b.bed_id=ra.bed_id LEFT JOIN app_user by_user ON by_user.user_id=ra.checked_out_by
     WHERE ra.student_id=$1 AND ra.hostel_id=$2 ORDER BY ra.allocation_date DESC,ra.allocation_id DESC`,
    [req.params.studentId,req.hostel_id]
  );
  res.json(result.rows);
};

exports.transfer=async(req,res)=>{
  const studentId=Number(req.body.student_id), roomId=Number(req.body.room_id);
  if(!Number.isInteger(studentId)||!Number.isInteger(roomId)) return res.status(400).json({error:'Resident and destination room are required'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const resident=await client.query('SELECT student_id FROM student WHERE student_id=$1 AND hostel_id=$2 AND is_active=true FOR UPDATE',[studentId,req.hostel_id]);
    if(!resident.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Active resident not found in this hostel'});}
    const current=await client.query('SELECT allocation_id,room_id FROM room_allocation WHERE student_id=$1 AND hostel_id=$2 AND checked_out_at IS NULL FOR UPDATE',[studentId,req.hostel_id]);
    if(!current.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'Resident has no current bed allocation'});}
    if(Number(current.rows[0].room_id)===roomId){await client.query('ROLLBACK');return res.status(400).json({error:'Choose a different destination room'});}
    const lockedRooms=await client.query('SELECT room_id FROM room WHERE room_id=ANY($1::int[]) AND hostel_id=$2 ORDER BY room_id FOR UPDATE',[[Number(current.rows[0].room_id),roomId],req.hostel_id]);
    if(lockedRooms.rowCount!==2){await client.query('ROLLBACK');return res.status(404).json({error:'Current or destination room was not found in this hostel'});}
    const bed=await client.query(
      `SELECT b.bed_id FROM bed b WHERE b.room_id=$1 AND b.hostel_id=$2 AND b.is_active=true
       AND NOT EXISTS(SELECT 1 FROM room_allocation ra WHERE ra.bed_id=b.bed_id AND ra.checked_out_at IS NULL)
       ORDER BY b.bed_number::int NULLS LAST,b.bed_id FOR UPDATE SKIP LOCKED LIMIT 1`,[roomId,req.hostel_id]
    );
    if(!bed.rowCount){await client.query('ROLLBACK');return res.status(400).json({error:'Destination room has no free beds'});}
    await client.query('UPDATE room_allocation SET checked_out_at=CURRENT_TIMESTAMP,checked_out_by=$1,checkout_note=$2 WHERE allocation_id=$3',[req.user.user_id,`Transferred to room ${roomId}`,current.rows[0].allocation_id]);
    await client.query('UPDATE room SET occupancy=GREATEST(occupancy-1,0) WHERE room_id=$1',[current.rows[0].room_id]);
    const created=await client.query('INSERT INTO room_allocation(student_id,room_id,hostel_id,bed_id) VALUES($1,$2,$3,$4) RETURNING allocation_id,allocation_date',[studentId,roomId,req.hostel_id,bed.rows[0].bed_id]);
    await client.query('UPDATE room SET occupancy=occupancy+1 WHERE room_id=$1',[roomId]);
    await client.query('INSERT INTO audit_log(user_id,hostel_id,action,entity_type,entity_id,details) VALUES($1,$2,\'allocation.transferred\',\'student\',$3,$4::jsonb)',[req.user.user_id,req.hostel_id,String(studentId),JSON.stringify({from_room_id:current.rows[0].room_id,to_room_id:roomId,bed_id:bed.rows[0].bed_id})]);
    await client.query('COMMIT');
    res.json({message:'Resident transferred successfully',allocation_id:created.rows[0].allocation_id,bed_id:bed.rows[0].bed_id});
  }catch(error){await client.query('ROLLBACK').catch(()=>{});res.status(400).json({error:error.message});}
  finally{client.release();}
};

exports.checkout=async(req,res)=>{
  const studentId=Number(req.params.studentId);
  if(!Number.isInteger(studentId))return res.status(400).json({error:'A valid resident ID is required'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const resident=await client.query('SELECT student_id,user_id FROM student WHERE student_id=$1 AND hostel_id=$2 AND is_active=true FOR UPDATE',[studentId,req.hostel_id]);
    if(!resident.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Active resident not found in this hostel'});}
    const allocation=await client.query('SELECT allocation_id,room_id FROM room_allocation WHERE student_id=$1 AND hostel_id=$2 AND checked_out_at IS NULL FOR UPDATE',[studentId,req.hostel_id]);
    if(allocation.rowCount){
      await client.query('UPDATE room_allocation SET checked_out_at=CURRENT_TIMESTAMP,checked_out_by=$1,checkout_note=$2 WHERE allocation_id=$3',[req.user.user_id,req.body.note?.trim()||'Resident checked out',allocation.rows[0].allocation_id]);
      await client.query('UPDATE room SET occupancy=GREATEST(occupancy-1,0) WHERE room_id=$1',[allocation.rows[0].room_id]);
    }
    await client.query('UPDATE student SET is_active=false WHERE student_id=$1',[studentId]);
    if(resident.rows[0].user_id)await client.query('UPDATE app_user SET is_active=false,updated_at=CURRENT_TIMESTAMP WHERE user_id=$1',[resident.rows[0].user_id]);
    const settlement=await client.query(
      `SELECT COALESCE((SELECT SUM(GREATEST(total.total_amount-paid.paid_amount+refund.refunded_amount,0)) FROM invoice i
          CROSS JOIN LATERAL(SELECT COALESCE(SUM(quantity*unit_amount),0) total_amount FROM invoice_item WHERE invoice_id=i.invoice_id) total
          CROSS JOIN LATERAL(SELECT COALESCE(SUM(amount),0) paid_amount FROM payment WHERE invoice_id=i.invoice_id AND status='paid') paid
          CROSS JOIN LATERAL(SELECT COALESCE(SUM(pr.amount),0) refunded_amount FROM payment_refund pr JOIN payment p ON p.payment_id=pr.payment_id WHERE p.invoice_id=i.invoice_id) refund
          WHERE i.student_id=$1 AND i.hostel_id=$2 AND i.status<>'void'),0)::numeric AS balance_due,
        COALESCE((SELECT SUM(p.amount-COALESCE(r.refunded_amount,0)) FROM payment p
          JOIN invoice i ON i.invoice_id=p.invoice_id
          CROSS JOIN LATERAL(SELECT COALESCE(SUM(amount),0) AS refunded_amount FROM payment_refund WHERE payment_id=p.payment_id) r
          WHERE i.student_id=$1 AND i.hostel_id=$2 AND p.status='paid'
            AND EXISTS(SELECT 1 FROM invoice_item ii JOIN fee_type ft ON ft.fee_type_id=ii.fee_type_id
                       WHERE ii.invoice_id=i.invoice_id AND ft.fee_code='security_deposit')),0)::numeric AS refundable_deposit`,[studentId,req.hostel_id]
    );
    await client.query('INSERT INTO audit_log(user_id,hostel_id,action,entity_type,entity_id,details) VALUES($1,$2,\'student.checked_out\',\'student\',$3,$4::jsonb)',[req.user.user_id,req.hostel_id,String(studentId),JSON.stringify(settlement.rows[0])]);
    await client.query('COMMIT');
    res.json({message:'Resident checked out and bed released',student_id:studentId,settlement:settlement.rows[0]});
  }catch(error){await client.query('ROLLBACK').catch(()=>{});res.status(400).json({error:error.message});}
  finally{client.release();}
};
