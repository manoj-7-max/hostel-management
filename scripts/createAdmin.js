require('dotenv').config();
const bcrypt=require('bcrypt');
const pool=require('../db');

async function createAdmin(){
  const email=String(process.env.ADMIN_EMAIL||'').trim().toLowerCase();
  const name=String(process.env.ADMIN_NAME||'Hostel Administrator').trim();
  const password=String(process.env.ADMIN_PASSWORD||'');
  if(!/^\S+@\S+\.\S+$/.test(email))throw new Error('Set a valid ADMIN_EMAIL before bootstrapping the public instance');
  if(password.length<12)throw new Error('ADMIN_PASSWORD must contain at least 12 characters');
  const passwordHash=await bcrypt.hash(password,12);
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('hostel.initial.super_admin'))");
    const existing=await client.query(
      `SELECT u.user_id,EXISTS(SELECT 1 FROM app_user_role ur JOIN app_role r ON r.role_id=ur.role_id
        WHERE ur.user_id=u.user_id AND r.role_key='super_admin') AS is_super_admin
       FROM app_user u WHERE LOWER(u.email)=LOWER($1) FOR UPDATE`,[email]
    );
    if(existing.rowCount){
      if(!existing.rows[0].is_super_admin)throw new Error('ADMIN_EMAIL already belongs to a non-administrator account');
      await client.query('COMMIT');
      console.log(`Initial super administrator ${email} already exists; leaving its password unchanged.`);
      return;
    }
    const role=await client.query("SELECT role_id FROM app_role WHERE role_key='super_admin'");
    if(!role.rowCount)throw new Error('Base schema migrations have not created the super_admin role');
    const hostels=await client.query('SELECT hostel_id FROM hostel WHERE is_active=true');
    if(!hostels.rowCount)throw new Error('No active hostel exists; apply the hostel migrations before bootstrapping an administrator');
    const account=await client.query(
      `INSERT INTO app_user(email,display_name,password_hash,is_active,must_reset_password)
       VALUES($1,$2,$3,true,true) RETURNING user_id`,[email,name,passwordHash]
    );
    const userId=account.rows[0].user_id;
    await client.query('INSERT INTO app_user_role(user_id,role_id) VALUES($1,$2)',[userId,role.rows[0].role_id]);
    await client.query(
      `INSERT INTO user_hostel_access(user_id,hostel_id)
       SELECT $1,hostel_id FROM hostel WHERE is_active=true ON CONFLICT DO NOTHING`,[userId]
    );
    await client.query(
      `INSERT INTO admin_user(name,email,password_hash,is_active,user_id)
       VALUES($1,$2,$3,true,$4)`,[name,email,passwordHash,userId]
    );
    await client.query(
      `INSERT INTO audit_log(user_id,action,entity_type,entity_id,details)
       VALUES($1,'user.bootstrap_created','app_user',$2,'{"role":"super_admin"}'::jsonb)`,[userId,String(userId)]
    );
    await client.query('COMMIT');
    console.log(`Created initial super administrator ${email}. The first sign-in requires a password change.`);
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();}
}

createAdmin().catch((error)=>{console.error('Administrator bootstrap failed:',error.message||error);process.exitCode=1;}).finally(()=>pool.end());
