'use strict';
const express=require('express');
const {pool}=require('../db');
const {auth,requireRole}=require('../auth');
const {notify,audit}=require('../notifications');
const {validatePreventiveCompletion}=require('../preventive-policy');
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
// Completar registra evidencia y envía la ejecución a supervisión. El plan se
// reprograma únicamente cuando el gerente aprueba el cierre de la alerta.
router.post('/:id/completar',run(async(req,res)=>{
  if(!id(req.params.id))return invalid(res,'Plan inválido');
  const b=req.body||{},minutes=Number(b.duracion_min??0);
  if(!Number.isInteger(minutes)||minutes<0||minutes>14400)return invalid(res,'Duración inválida');
  const evidence=validatePreventiveCompletion(b);
  if(!evidence.ok)return invalid(res,evidence.error);
  const client=await pool.connect();
  let payload;
  try{
    await client.query('BEGIN');
    const q=await client.query('SELECT * FROM preventivos WHERE id=$1 FOR UPDATE',[req.params.id]);
    const p=q.rows[0];
    if(!p||!p.activo){await client.query('ROLLBACK');return res.status(404).json({error:'Plan no disponible'});}
    const pending=await client.query("SELECT id FROM alertas WHERE preventivo_id=$1 AND estado NOT IN ('cerrada','cancelada') LIMIT 1",[p.id]);
    if(pending.rows[0]){await client.query('ROLLBACK');return res.status(409).json({error:'Este preventivo ya está esperando revisión de supervisión'});}
    const title=str(b.titulo||p.titulo,180);
    const alert=await client.query(`INSERT INTO alertas(
       numero,titulo,descripcion,equipo_id,preventivo_id,prioridad,estado,reportado_por,asignado_a,resuelta_at,vence_at)
       VALUES(nextval('alerta_numero_seq'),$1,$2,$3,$4,'media','resuelta',$5,$5,now(),
         ($6::date::timestamp AT TIME ZONE 'America/Argentina/Cordoba'))
       RETURNING id,numero,titulo,estado`,
      [title,str(b.resultado,3000),p.equipo_id,p.id,req.user.id,p.proxima_fecha]);
    const trabajo=await client.query(`INSERT INTO trabajos(titulo,descripcion,tipo,estado,equipo_id,preventivo_id,tecnico_id,duracion_min,resultado)
       VALUES($1,$2,'preventivo','realizado',$3,$4,$5,$6,$7) RETURNING *`,
       [title,str(b.descripcion||p.instrucciones,4000),p.equipo_id,p.id,req.user.id,minutes,str(b.resultado,3000)]);
    await client.query('UPDATE trabajos SET alerta_id=$1 WHERE id=$2',[alert.rows[0].id,trabajo.rows[0].id]);
    await client.query("INSERT INTO adjuntos(alerta_id,url,tipo) VALUES($1,$2,'solucion')",[alert.rows[0].id,b.foto]);
    await client.query("INSERT INTO alerta_historial(alerta_id,evento,usuario_id,nota) VALUES($1,'Preventivo enviado a verificación',$2,$3)",[alert.rows[0].id,req.user.id,str(b.resultado,3000)]);
    await audit(client,'preventivo',p.id,'enviado_a_verificacion',req.user.id,{alerta_id:alert.rows[0].id,trabajo_id:trabajo.rows[0].id});
    await client.query('COMMIT');
    payload={trabajo:{...trabajo.rows[0],alerta_id:alert.rows[0].id},preventivo:p,alerta:alert.rows[0]};
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
  const managers=await pool.query("SELECT id FROM usuarios WHERE activo AND rol IN ('jefe_mantenimiento','admin')");
  await notify(managers.rows.map(x=>x.id),{key:`preventivo-revision-${payload.alerta.id}`,title:'Preventivo listo para verificar',body:payload.alerta.titulo,url:`/?alerta=${payload.alerta.id}`});
  res.status(201).json(payload);
}));
router.use((e,req,res,next)=>{console.error('[BODEN preventivos]',e);res.status(e.code==='23503'?400:500).json({error:e.code==='23503'?'Referencia inexistente':'No se pudo procesar el plan preventivo'});});
module.exports=router;

