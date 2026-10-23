'use strict';
const express=require('express');
const {pool}=require('../db');
const {auth,requireRole}=require('../auth');
const router=express.Router();
const run=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const id=v=>/^\d+$/.test(String(v||''))&&+v>0?+v:null;
const s=(v,n=4000)=>String(v??'').trim().slice(0,n);
const types=['correctivo','preventivo','inspeccion','mejora','emergencia'];
const states=['pendiente','en_curso','realizado'];
const fail=(res,m)=>res.status(400).json({error:m});
router.use(auth,requireRole('mantenimiento','jefe_mantenimiento','admin'));
// Parte diario: cada técnico carga su propio trabajo y queda autor identificado.
router.get('/',run(async(req,res)=>{
  const a=[],filters=[];
  for(const k of ['equipo_id','tecnico_id','alerta_id']){
    if(req.query[k]){if(!id(req.query[k]))return fail(res,'Filtro inválido');a.push(req.query[k]);filters.push('t.'+k+'=$'+a.length);}
  }
  if(req.query.estado){if(!states.includes(req.query.estado))return fail(res,'Estado inválido');a.push(req.query.estado);filters.push('t.estado=$'+a.length);}
  const r=await pool.query(`SELECT t.*,u.nombre AS tecnico,e.nombre AS equipo,e.codigo AS equipo_codigo,
    ('BODEN-' || LPAD(a.numero::text,4,'0')) AS alerta_codigo
    FROM trabajos t JOIN usuarios u ON u.id=t.tecnico_id
    LEFT JOIN equipos e ON e.id=t.equipo_id LEFT JOIN alertas a ON a.id=t.alerta_id
    ${filters.length?'WHERE '+filters.join(' AND '):''}
    ORDER BY t.fecha DESC,t.id DESC LIMIT 500`,a);
  res.json(r.rows);
}));
router.post('/',run(async(req,res)=>{
  const b=req.body||{},titulo=s(b.titulo,180),duracion=Number(b.duracion_min??0);
  if(titulo.length<3)return fail(res,'Describí la tarea (mínimo 3 caracteres)');
  if(!Number.isInteger(duracion)||duracion<0||duracion>14400)return fail(res,'Duración inválida');
  if(b.equipo_id&&!id(b.equipo_id)||b.alerta_id&&!id(b.alerta_id))return fail(res,'Equipo o alerta inválida');
  const tipo=types.includes(b.tipo)?b.tipo:'correctivo',estado=states.includes(b.estado)?b.estado:'realizado';
  const fecha=b.fecha?new Date(b.fecha):new Date();
  if(Number.isNaN(fecha.getTime()))return fail(res,'Fecha inválida');
  const r=await pool.query(`INSERT INTO trabajos(titulo,descripcion,tipo,estado,equipo_id,alerta_id,tecnico_id,fecha,duracion_min,resultado)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
   [titulo,s(b.descripcion),tipo,estado,id(b.equipo_id),id(b.alerta_id),req.user.id,fecha,duracion,s(b.resultado,3000)]);
  res.status(201).json(r.rows[0]);
}));
router.patch('/:id',run(async(req,res)=>{
  if(!id(req.params.id))return fail(res,'Trabajo inválido');
  const t=(await pool.query('SELECT tecnico_id FROM trabajos WHERE id=$1',[req.params.id])).rows[0];
  if(!t)return res.status(404).json({error:'Trabajo no encontrado'});
  if(Number(t.tecnico_id)!==req.user.id&&!['admin','jefe_mantenimiento'].includes(req.user.rol))
    return res.status(403).json({error:'Solo el autor o jefe puede editar'});
  const b=req.body||{},a=[],sets=[];
  for(const [k,n] of Object.entries({titulo:180,descripcion:4000,resultado:3000}))
    if(b[k]!==undefined){const v=s(b[k],n);if(k==='titulo'&&v.length<3)return fail(res,'Título inválido');a.push(v);sets.push(k+'=$'+a.length);}
  if(b.estado!==undefined){if(!states.includes(b.estado))return fail(res,'Estado inválido');a.push(b.estado);sets.push('estado=$'+a.length);}
  if(b.tipo!==undefined){if(!types.includes(b.tipo))return fail(res,'Tipo inválido');a.push(b.tipo);sets.push('tipo=$'+a.length);}
  if(b.duracion_min!==undefined){let n=Number(b.duracion_min);if(!Number.isInteger(n)||n<0||n>14400)return fail(res,'Duración inválida');a.push(n);sets.push('duracion_min=$'+a.length);}
  if(!sets.length)return fail(res,'Sin cambios');
  a.push(req.params.id);
  res.json((await pool.query(`UPDATE trabajos SET ${sets.join(',')},updated_at=now() WHERE id=$${a.length} RETURNING *`,a)).rows[0]);
}));
router.use((e,req,res,next)=>{console.error('[BODEN trabajos]',e);res.status(e.code==='23503'?400:500).json({error:e.code==='23503'?'Equipo o alerta no existe':'No se pudo registrar el trabajo'});});
module.exports=router;
