'use strict';
const express=require('express');
const {pool}=require('../db');
const {auth,requireRole}=require('../auth');
const router=express.Router();
const chief=requireRole('jefe_mantenimiento','admin');
const run=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const str=(x,n=180)=>String(x??'').trim().slice(0,n);
const id=x=>/^\d+$/.test(String(x||''))&&+x>0?+x:null;
const fail=(r,m)=>r.status(400).json({error:m});
const conditions=['excelente','buena','regular','deficiente'];
const states=['disponible','prestada','mantenimiento','baja'];
router.use(auth,requireRole('mantenimiento','jefe_mantenimiento','admin'));
router.get('/',run(async(req,res)=>{
  const q=str(req.query.q,100),a=[],where=[];
  if(q){a.push('%'+q+'%');where.push('(h.nombre ILIKE $'+a.length+' OR h.codigo ILIKE $'+a.length+' OR h.serie ILIKE $'+a.length+')');}
  if(req.query.estado){if(!states.includes(req.query.estado))return fail(res,'Estado inválido');a.push(req.query.estado);where.push('h.estado=$'+a.length);}
  const r=await pool.query(`SELECT h.*,p.id AS prestamo_id,p.prestado_at,u.nombre AS prestado_a
    FROM herramientas h LEFT JOIN prestamos_herramientas p ON p.herramienta_id=h.id AND p.devuelto_at IS NULL
    LEFT JOIN usuarios u ON u.id=p.tecnico_id ${where.length?'WHERE '+where.join(' AND '):''}
    ORDER BY CASE h.estado WHEN 'prestada' THEN 0 WHEN 'mantenimiento' THEN 1 ELSE 2 END,h.nombre LIMIT 1000`,a);
  res.json(r.rows);
}));
router.post('/',chief,run(async(req,res)=>{
  const b=req.body||{},nombre=str(b.nombre);
  if(nombre.length<3)return fail(res,'Nombre de la herramienta inválido');
  const condicion=conditions.includes(b.condicion)?b.condicion:'buena';
  const estado=states.filter(x=>x!=='prestada').includes(b.estado)?b.estado:'disponible';
  const r=await pool.query(`INSERT INTO herramientas(nombre,categoria,marca,modelo,serie,estado,condicion,ubicacion,observaciones)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [nombre,str(b.categoria)||'Herramienta general',str(b.marca),str(b.modelo),str(b.serie),estado,condicion,str(b.ubicacion),str(b.observaciones,500)]);
  res.status(201).json(r.rows[0]);
}));
router.patch('/:id',chief,run(async(req,res)=>{
  if(!id(req.params.id))return fail(res,'Herramienta inválida');
  const b=req.body||{},a=[],set=[];
  for(const [k,max] of Object.entries({nombre:180,categoria:180,marca:180,modelo:180,serie:180,ubicacion:180,observaciones:500}))
    if(b[k]!==undefined){const v=str(b[k],max);if(k==='nombre'&&v.length<3)return fail(res,'Nombre inválido');a.push(v);set.push(k+'=$'+a.length);}
  if(b.condicion!==undefined){if(!conditions.includes(b.condicion))return fail(res,'Condición inválida');a.push(b.condicion);set.push('condicion=$'+a.length);}
  if(b.estado!==undefined){if(!states.includes(b.estado)||b.estado==='prestada')return fail(res,'Usá la entrega para registrar préstamos');
    const active=await pool.query('SELECT 1 FROM prestamos_herramientas WHERE herramienta_id=$1 AND devuelto_at IS NULL',[req.params.id]);
    if(active.rowCount)return res.status(409).json({error:'La herramienta está prestada. Primero registrá su devolución.'});
    a.push(b.estado);set.push('estado=$'+a.length);}
  if(!set.length)return fail(res,'Sin cambios');
  a.push(req.params.id);
  const r=await pool.query(`UPDATE herramientas SET ${set.join(',')} WHERE id=$${a.length} RETURNING *`,a);
  if(!r.rows[0])return res.status(404).json({error:'Herramienta no encontrada'});
  res.json(r.rows[0]);
}));
router.get('/prestamos',run(async(req,res)=>{
  const r=await pool.query(`SELECT p.*,h.codigo,h.nombre AS herramienta,u.nombre AS tecnico,
    x.nombre AS entregado_nombre FROM prestamos_herramientas p
    JOIN herramientas h ON h.id=p.herramienta_id JOIN usuarios u ON u.id=p.tecnico_id
    JOIN usuarios x ON x.id=p.entregado_por ORDER BY p.prestado_at DESC LIMIT 500`);
  res.json(r.rows);
}));
router.post('/:id/prestar',run(async(req,res)=>{
  const hid=id(req.params.id),uid=id(req.body?.tecnico_id)||req.user.id;
  if(!hid)return fail(res,'Herramienta inválida');
  if(uid!==req.user.id&&!['jefe_mantenimiento','admin'].includes(req.user.rol))
    return res.status(403).json({error:'Solo jefatura puede prestar a otra persona'});
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const h=(await c.query('SELECT * FROM herramientas WHERE id=$1 FOR UPDATE',[hid])).rows[0];
    if(!h){await c.query('ROLLBACK');return res.status(404).json({error:'Herramienta no encontrada'});}
    if(h.estado!=='disponible'){await c.query('ROLLBACK');return res.status(409).json({error:'La herramienta no está disponible'});}
    const user=await c.query("SELECT 1 FROM usuarios WHERE id=$1 AND activo=true AND rol IN ('mantenimiento','jefe_mantenimiento','admin')",[uid]);
    if(!user.rowCount){await c.query('ROLLBACK');return fail(res,'Técnico no válido');}
    await c.query("UPDATE herramientas SET estado='prestada' WHERE id=$1",[hid]);
    const p=await c.query(`INSERT INTO prestamos_herramientas(herramienta_id,tecnico_id,entregado_por,observaciones)
      VALUES($1,$2,$3,$4) RETURNING *`,[hid,uid,req.user.id,str(req.body?.observaciones,500)]);
    await c.query('COMMIT');res.status(201).json(p.rows[0]);
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
router.post('/:id/devolver',run(async(req,res)=>{
  const hid=id(req.params.id);if(!hid)return fail(res,'Herramienta inválida');
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const h=(await c.query('SELECT * FROM herramientas WHERE id=$1 FOR UPDATE',[hid])).rows[0];
    const p=(await c.query('SELECT * FROM prestamos_herramientas WHERE herramienta_id=$1 AND devuelto_at IS NULL FOR UPDATE',[hid])).rows[0];
    if(!h||!p){await c.query('ROLLBACK');return res.status(404).json({error:'Sin préstamo activo'});}
    if(Number(p.tecnico_id)!==req.user.id&&!['jefe_mantenimiento','admin'].includes(req.user.rol)){
      await c.query('ROLLBACK');return res.status(403).json({error:'Solo el técnico o jefatura puede devolver'});}
    const damaged=req.body?.requiere_revision===true;
    await c.query('UPDATE prestamos_herramientas SET devuelto_at=now(),recibido_por=$1 WHERE id=$2',[req.user.id,p.id]);
    await c.query('UPDATE herramientas SET estado=$1 WHERE id=$2',[damaged?'mantenimiento':'disponible',hid]);
    await c.query('COMMIT');res.json({ok:true,estado:damaged?'mantenimiento':'disponible'});
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
router.use((e,req,res,next)=>{console.error('[BODEN herramientas]',e);res.status(e.code==='23503'?400:e.code==='23505'?409:500).json({error:'No se pudo completar la operación'});});
module.exports=router;
