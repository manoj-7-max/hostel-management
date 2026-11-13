const fs = require('fs/promises');
const path = require('path');
const pool = require('../db');

const PRIVATE_DIRECTORY = path.join(__dirname, '..', 'private_uploads');
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

exports.uploadApplicationDocument = async (req, res) => {
  const { file_name, content_type, file_base64 } = req.body;
  if (!file_name || !ALLOWED_TYPES.has(content_type) || typeof file_base64 !== 'string') {
    return res.status(400).json({ error: 'Provide a PDF, JPG, or PNG file' });
  }
  const data = file_base64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(data, 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Document size must be between 1 byte and 5 MB' });
  const signatures = {
    'application/pdf': buffer.subarray(0, 5).toString() === '%PDF-',
    'image/jpeg': buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    'image/png': buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  };
  if (!signatures[content_type]) return res.status(400).json({ error: 'File content does not match the selected file type' });
  const safeName = path.basename(file_name).replace(/[^a-zA-Z0-9._-]/g, '_').slice(-180);
  const storageKey = require('crypto').randomUUID();
  const target = path.join(PRIVATE_DIRECTORY, storageKey);
  try {
    const application = await pool.query('SELECT application_id FROM admission_application WHERE application_id=$1 AND hostel_id=$2', [req.params.id, req.hostel_id]);
    if (!application.rowCount) return res.status(404).json({ error: 'Application not found in this hostel' });
    await fs.mkdir(PRIVATE_DIRECTORY, { recursive: true });
    await fs.writeFile(target, buffer, { flag: 'wx' });
    const result = await pool.query(
      `INSERT INTO private_document(hostel_id, application_id, uploaded_by, storage_key, file_name, content_type, byte_size)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING document_id, file_name, content_type, byte_size, created_at`,
      [req.hostel_id, req.params.id, req.user.user_id, storageKey, safeName, content_type, buffer.length]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await fs.unlink(target).catch(() => {});
    res.status(400).json({ error: error.message });
  }
};

exports.download = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT storage_key, file_name, content_type FROM private_document WHERE document_id=$1 AND hostel_id=$2`,
      [req.params.id, req.hostel_id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Document not found' });
    const document = result.rows[0];
    const target = path.join(PRIVATE_DIRECTORY, document.storage_key);
    res.type(document.content_type);
    res.setHeader('Content-Disposition', `attachment; filename="${document.file_name.replace(/"/g, '')}"`);
    res.sendFile(target, (error) => { if (error && !res.headersSent) res.status(404).end(); });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.setVerificationStatus = async (req,res) => {
  const { status, note }=req.body;
  if(!['pending','verified','rejected'].includes(status))return res.status(400).json({error:'Choose pending, verified, or rejected'});
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const result=await client.query(
      `UPDATE private_document SET verification_status=$1,verification_note=$2,
        verified_by=CASE WHEN $6::boolean THEN NULL ELSE $3::integer END,
        verified_at=CASE WHEN $6 THEN NULL ELSE CURRENT_TIMESTAMP END
       WHERE document_id=$4 AND hostel_id=$5 RETURNING document_id,file_name,verification_status,verification_note,verified_at`,
      [status,note?.trim()||null,req.user.user_id,req.params.id,req.hostel_id,status==='pending']
    );
    if(!result.rowCount){await client.query('ROLLBACK');return res.status(404).json({error:'Document not found in this hostel'});}
    await client.query('INSERT INTO audit_log(user_id,hostel_id,action,entity_type,entity_id,details) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[
      req.user.user_id,req.hostel_id,`document.${status}`,'private_document',String(req.params.id),JSON.stringify({verification_note:note?.trim()||null})
    ]);
    await client.query('COMMIT');res.json(result.rows[0]);
  }catch(error){await client.query('ROLLBACK').catch(()=>{});res.status(400).json({error:error.message});}
  finally{client.release();}
};
