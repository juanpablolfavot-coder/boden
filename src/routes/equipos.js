'use strict';
const express = require('express');
const { pool } = require('../db');
const { auth, requireRole } = require('../auth');
const router = express.Router();
const chief = requireRole('jefe_mantenimiento','admin');
const allowed = new Set(['climatizacion','bombas','calderas','agua','electricidad','grupo_electrogeno','ascensores','incendio','piscina','spa','cocina','lavanderia','habitaciones','refrigeracion','seguridad','infraestructura','otros']);
const states = ['operativo','mantenimiento','fuera_servicio','baja'];
const priorities = ['alta','media','baja'];
const run = (fn) => (req,res,next) => Promise.resolve(fn(req,res)).catch(next);
const str = (v,n=250) => String(v ?? '').trim().slice(0,n);
const id = (v) => /^\d+$/.test(String(v||'')) && Number(v)>0 ? Number(v) : null;
const date = (v) => !v ? null : (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : false);
const err = (res,message) => res.status(400).json({error:message});
router.use(auth, requireRole('mantenimiento','jefe_mantenimiento','admin'));

// Equipos e instalaciones: censo real, sin inventar activos hoteleros.
router.get('/', run(async (req,res) => {
  const term = str(req.query.q,100), tipo=str(req.query.tipo,60), estado=str(req.query.estado,40);
  const args=[], filters=[];
  if(term) {args.push('%'+term+'%');filters.push('(e.nombre ILIKE $'+args.length+' OR e.codigo ILIKE $'+args.length+' OR e.serie ILIKE $'+args.length+' OR e.sector ILIKE $'+args.length+')');}
  if(tipo) {args.push(tipo); filters.push('e.tipo=$'+args.length);}
  if(estado) {args.push(estado); filters.push('e.estado=$'+args.length);}
  const q=`SELECT e.*,u.nombre AS ubicacion, (SELECT MIN(p.proxima_fecha) FROM preventivos p WHERE p.equipo_id=e.id AND p.activo) AS proximo_preventivo,
    (SELECT COUNT(*)::int FROM trabajos t WHERE t.equipo_id=e.id) AS intervenciones
    FROM equipos e LEFT JOIN ubicaciones u ON u.id=e.ubicacion_id
    ${filters.length?'WHERE '+filters.join(' AND '):''}
    ORDER BY CASE e.estado WHEN 'fuera_servicio' THEN 0 WHEN 'mantenimiento' THEN 1 ELSE 2 END, e.nombre LIMIT 1000`;
  res.json((await pool.query(q,args)).rows);
}));
router.post('/', chief, run(async (req,res) => {
  const b=req.body||{}, nombre=str(b.nombre,180);
  if(nombre.length<3) return err(res,'Nombre del equipo: mínimo 3 caracteres');
  const tipo=allowed.has(b.tipo)?b.tipo:'otros';
  const estado=states.includes(b.estado)?b.estado:'operativo';
  const criticidad=priorities.includes(b.criticidad)?b.criticidad:'media';
  const instalacion=date(b.fecha_instalacion),garantia=date(b.garantia_hasta);
  if(instalacion===false||garantia===false) return err(res,'Fecha inválida');
  const p=[nombre,tipo,str(b.marca,100),str(b.modelo,100),str(b.serie,150),str(b.sector,160),id(b.ubicacion_id),estado,criticidad,instalacion,garantia,str(b.descripcion,3000),req.user.id];
  const q=`INSERT INTO equipos(nombre,tipo,marca,modelo,serie,sector,ubicacion_id,estado,criticidad,fecha_instalacion,garantia_hasta,descripcion,created_by)
   VALUES(${p.map((_,i)=>'$'+(i+1)).join(',')}) RETURNING *`;
  res.status(201).json((await pool.query(q,p)).rows[0]);
}));
router.get('/:id',run(async(req,res)=>{
  if(!id(req.params.id))return err(res,'Equipo inválido');
  const r=await pool.query('SELECT e.*,u.nombre AS ubicacion FROM equipos e LEFT JOIN ubicaciones u ON u.id=e.ubicacion_id WHERE e.id=$1',[req.params.id]);
  if(!r.rows.length)return res.status(404).json({error:'Equipo no encontrado'});
  const [trabajos,planes]=await Promise.all([
    pool.query('SELECT t.*,us.nombre AS tecnico FROM trabajos t JOIN usuarios us ON us.id=t.tecnico_id WHERE t.equipo_id=$1 ORDER BY t.fecha DESC LIMIT 50',[req.params.id]),
    pool.query('SELECT * FROM preventivos WHERE equipo_id=$1 ORDER BY proxima_fecha',[req.params.id])
  ]);
  res.json({...r.rows[0],trabajos:trabajos.rows,preventivos:planes.rows});
}));
router.patch('/:id',chief,run(async(req,res)=>{
  if(!id(req.params.id))return err(res,'Equipo inválido');
  const b=req.body||{}, p=[],sets=[];
  const fields={nombre:180,marca:100,modelo:100,serie:150,sector:160,descripcion:3000};
  for(const [k,n] of Object.entries(fields))if(b[k]!==undefined){
    const v=str(b[k],n);if(k==='nombre'&&v.length<3)return err(res,'Nombre inválido');
    p.push(v);sets.push(k+'=$'+p.length);
  }
  if(b.tipo!==undefined){if(!allowed.has(b.tipo))return err(res,'Tipo inválido');p.push(b.tipo);sets.push('tipo=$'+p.length);}
  if(b.estado!==undefined){if(!states.includes(b.estado))return err(res,'Estado inválido');p.push(b.estado);sets.push('estado=$'+p.length);}
  if(b.criticidad!==undefined){if(!priorities.includes(b.criticidad))return err(res,'Criticidad inválida');p.push(b.criticidad);sets.push('criticidad=$'+p.length);}
  if(b.ubicacion_id!==undefined){if(b.ubicacion_id && !id(b.ubicacion_id))return err(res,'Ubicación inválida');p.push(id(b.ubicacion_id));sets.push('ubicacion_id=$'+p.length);}
  for(const k of ['fecha_instalacion','garantia_hasta'])if(b[k]!==undefined){
    const v=date(b[k]);if(v===false)return err(res,'Fecha inválida');p.push(v);sets.push(k+'=$'+p.length);
  }
  if(!sets.length)return err(res,'Sin cambios');
  p.push(req.params.id);
  const r=await pool.query(`UPDATE equipos SET ${sets.join(',')}, updated_at=now() WHERE id=$${p.length} RETURNING *`,p);
  if(!r.rows.length)return res.status(404).json({error:'Equipo no encontrado'});
  res.json(r.rows[0]);
}));
router.use((e,req,res,next)=>{console.error('[BODEN equipos]',e);res.status(e.code==='23503'?400:500).json({error:e.code==='23503'?'Referencia inexistente':'No se pudo procesar el equipo'});});
module.exports=router;
