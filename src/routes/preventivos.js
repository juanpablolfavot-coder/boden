'use strict';
const express=require('express');
const {pool}=require('../db');
const {auth,requireRole}=require('../auth');
const {listAnnualPlan,syncAnnualMaintenance}=require('../annual-maintenance');
const {listRecurringPlan,syncRecurringMaintenance}=require('../recurring-maintenance');
const router=express.Router();
const admin=requireRole('jefe_mantenimiento','admin');
const run=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const id=v=>/^\d+$/.test(String(v||''))&&+v>0?+v:null;
const str=(v,max=1000)=>String(v??'').trim().slice(0,max);
const invalid=(res,msg)=>res.status(400).json({error:msg});
router.use(auth,requireRole('mantenimiento','jefe_mantenimiento','admin'));
router.get('/anual',run(async(req,res)=>{
  await syncAnnualMaintenance();
  res.json(await listAnnualPlan(req.query.anio));
}));
router.get('/rutinas',run(async(req,res)=>{
  await syncRecurringMaintenance();
  res.json(await listRecurringPlan());
}));
router.get('/',run(async(req,res)=>{
  const a=[];let f='WHERE 1=1';
  if(req.query.equipo_id){if(!id(req.query.equipo_id))return invalid(res,'Equipo inválido');a.push(req.query.equipo_id);f+=' AND p.equipo_id=$'+a.length;}
  if(req.query.activos==='1')f+=' AND p.activo=true';
  const r=await pool.query(`SELECT p.*,e.codigo AS equipo_codigo,e.nombre AS equipo, e.tipo AS equipo_tipo,u.nombre AS responsable
    FROM preventivos p JOIN equipos e ON e.id=p.equipo_id LEFT JOIN usuarios u ON u.id=p.responsable_id ${f}
    ORDER BY p.activo DESC,p.proxima_fecha ASC LIMIT 1000`,a);
  res.json(r.rows);
}));
router.post('/',admin,run(async(req,res)=>{
  const b=req.body||{},equipo=id(b.equipo_id),titulo=str(b.titulo,180),freq=Number(b.frecuencia_dias);
  if(!equipo||titulo.length<3||!Number.isInteger(freq)||freq<1||freq>3650||!/^\d{4}-\d{2}-\d{2}$/.test(b.proxima_fecha||'')||Number.isNaN(Date.parse(b.proxima_fecha)))
    return invalid(res,'Equipo, tarea, frecuencia (1-3650 días) y próxima fecha son obligatorios');
  const r=await pool.query(`INSERT INTO preventivos(equipo_id,titulo,instrucciones,frecuencia_dias,proxima_fecha,responsable_id,created_by)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [equipo,titulo,str(b.instrucciones,5000),freq,b.proxima_fecha,id(b.responsable_id),req.user.id]);
  res.status(201).json(r.rows[0]);
}));
router.patch('/:id',admin,run(async(req,res)=>{
  if(!id(req.params.id))return invalid(res,'Plan inválido');
  const b=req.body||{},sets=[],a=[];
  if(b.titulo!==undefined){const s=str(b.titulo,180);if(s.length<3)return invalid(res,'Título inválido');a.push(s);sets.push('titulo=$'+a.length);}
  if(b.instrucciones!==undefined){a.push(str(b.instrucciones,5000));sets.push('instrucciones=$'+a.length);}
  if(b.frecuencia_dias!==undefined){const n=Number(b.frecuencia_dias);if(!Number.isInteger(n)||n<1||n>3650)return invalid(res,'Frecuencia inválida');a.push(n);sets.push('frecuencia_dias=$'+a.length);}
  if(b.proxima_fecha!==undefined){if(!/^\d{4}-\d{2}-\d{2}$/.test(b.proxima_fecha)||Number.isNaN(Date.parse(b.proxima_fecha)))return invalid(res,'Fecha inválida');a.push(b.proxima_fecha);sets.push('proxima_fecha=$'+a.length);}
  if(b.activo!==undefined){a.push(b.activo===true);sets.push('activo=$'+a.length);}
  if(b.responsable_id!==undefined){if(b.responsable_id&&!id(b.responsable_id))return invalid(res,'Responsable inválido');a.push(id(b.responsable_id));sets.push('responsable_id=$'+a.length);}
  if(!sets.length)return invalid(res,'Sin cambios');
  a.push(req.params.id);
  const r=await pool.query(`UPDATE preventivos SET ${sets.join(',')} WHERE id=$${a.length} RETURNING *`,a);
  if(!r.rows.length)return res.status(404).json({error:'Plan no encontrado'});
  res.json(r.rows[0]);
}));
// Completar registra una intervención auditable, actualiza fecha y evita doble ejecución simultánea.
router.post('/:id/completar',run(async(req,res)=>{
  if(!id(req.params.id))return invalid(res,'Plan inválido');
  const b=req.body||{},minutes=Number(b.duracion_min??0);
  if(!Number.isInteger(minutes)||minutes<0||minutes>14400)return invalid(res,'Duración inválida');
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const q=await client.query('SELECT * FROM preventivos WHERE id=$1 FOR UPDATE',[req.params.id]);
    const p=q.rows[0];
    if(!p||!p.activo){await client.query('ROLLBACK');return res.status(404).json({error:'Plan no disponible'});}
    const title=str(b.titulo||p.titulo,180);
    const trabajo=await client.query(`INSERT INTO trabajos(titulo,descripcion,tipo,estado,equipo_id,preventivo_id,tecnico_id,duracion_min,resultado)
       VALUES($1,$2,'preventivo','realizado',$3,$4,$5,$6,$7) RETURNING *`,
       [title,str(b.descripcion||p.instrucciones,4000),p.equipo_id,p.id,req.user.id,minutes,str(b.resultado,3000)]);
    const plan=await client.query(`UPDATE preventivos SET ultimo_realizado=now(),proxima_fecha=(CURRENT_DATE+$1::int) WHERE id=$2 RETURNING *`,[p.frecuencia_dias,p.id]);
    await client.query('COMMIT');
    res.status(201).json({trabajo:trabajo.rows[0],preventivo:plan.rows[0]});
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}));
router.use((e,req,res,next)=>{console.error('[BODEN preventivos]',e);res.status(e.code==='23503'?400:500).json({error:e.code==='23503'?'Referencia inexistente':'No se pudo procesar el plan preventivo'});});
module.exports=router;

