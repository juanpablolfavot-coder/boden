'use strict';
const express=require('express');
const {pool}=require('../db');
const {auth,requireRole}=require('../auth');
const router=express.Router();
const run=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
router.use(auth,requireRole('mantenimiento','jefe_mantenimiento','admin'));
router.get('/verificacion-plan',requireRole('jefe_mantenimiento','admin'),run(async(req,res)=>{
  const backup=await pool.query('SELECT created_at,motivo,conteos FROM boden_backup_20261028.manifest LIMIT 1');
  const current=await pool.query(`SELECT
    (SELECT count(*)::int FROM mantenimiento_anual WHERE activo) AS plan_anual,
    (SELECT count(*)::int FROM mantenimiento_rutinas WHERE activo) AS rutinas,
    (SELECT count(*)::int FROM mantenimiento_rutina_ejecuciones) AS ejecuciones_rutinas,
    (SELECT count(*)::int FROM ubicaciones WHERE tipo='habitacion' AND nombre ~ '^Habitación [1-6]0[1-8]$') AS habitaciones_plan,
    (SELECT count(*)::int FROM usuarios WHERE activo) AS usuarios_activos,
    (SELECT count(*)::int FROM notificaciones) AS notificaciones,
    (SELECT count(*)::int FROM auditoria) AS auditoria`);
  res.json({backup:backup.rows[0],actual:current.rows[0]});
}));
router.get('/',run(async(req,res)=>{
  const q=[
    pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE estado='fuera_servicio')::int fuera,COUNT(*) FILTER(WHERE estado='mantenimiento')::int reparacion,COUNT(*) FILTER(WHERE criticidad='alta')::int criticos FROM equipos WHERE estado!='baja'"),
    pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE activo AND proxima_fecha<CURRENT_DATE)::int vencidos,COUNT(*) FILTER(WHERE activo AND proxima_fecha BETWEEN CURRENT_DATE AND CURRENT_DATE+7)::int semana FROM preventivos WHERE activo=true"),
    pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE cantidad<=minimo)::int bajos FROM repuestos WHERE activo=true"),
    pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE estado='prestada')::int prestadas,COUNT(*) FILTER(WHERE estado='mantenimiento')::int reparacion FROM herramientas"),
    pool.query("SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE fecha>=CURRENT_DATE)::int hoy,COUNT(*) FILTER(WHERE fecha>=CURRENT_DATE-7)::int semana FROM trabajos"),
    pool.query("SELECT COUNT(*) FILTER(WHERE estado NOT IN ('cerrada','cancelada'))::int abiertas,COUNT(*) FILTER(WHERE prioridad='urgente' AND estado NOT IN ('cerrada','cancelada'))::int urgentes,COUNT(*) FILTER(WHERE estado='resuelta')::int por_verificar,COUNT(*) FILTER(WHERE vence_at<now() AND estado NOT IN ('cerrada','cancelada'))::int vencidas FROM alertas"),
    pool.query(`SELECT t.id,t.titulo,t.tipo,t.estado,t.fecha,u.nombre AS tecnico,e.nombre AS equipo
      FROM trabajos t JOIN usuarios u ON u.id=t.tecnico_id LEFT JOIN equipos e ON e.id=t.equipo_id ORDER BY t.fecha DESC LIMIT 6`),
    pool.query(`SELECT p.id,p.titulo,p.proxima_fecha,e.nombre AS equipo,e.codigo
      FROM preventivos p JOIN equipos e ON e.id=p.equipo_id WHERE p.activo AND p.proxima_fecha<=CURRENT_DATE+14 ORDER BY p.proxima_fecha LIMIT 6`),
    pool.query(`SELECT id,nombre,unidad,cantidad,minimo FROM repuestos WHERE activo AND cantidad<=minimo ORDER BY cantidad ASC LIMIT 6`),
    pool.query(`SELECT DATE(fecha) AS dia,COUNT(*)::int cantidad FROM trabajos
      WHERE fecha>=CURRENT_DATE-6 GROUP BY DATE(fecha) ORDER BY dia`)
  ];
  const r=await Promise.all(q);
  res.json({equipos:r[0].rows[0],preventivos:r[1].rows[0],stock:r[2].rows[0],
    herramientas:r[3].rows[0],trabajos:r[4].rows[0],alertas:r[5].rows[0],
    ultimos_trabajos:r[6].rows,proximos_preventivos:r[7].rows,stock_critico:r[8].rows,tendencia:r[9].rows});
}));
router.use((e,req,res,next)=>{console.error('[BODEN centro]',e);res.status(500).json({error:'No se pudo cargar el centro de control'});});
module.exports=router;

