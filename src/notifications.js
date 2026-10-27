'use strict';
const {pool}=require('./db');const {notifyUsers}=require('./push');
async function createNotification(client,usuarioId,payload){if(!usuarioId)return null;const q=await client.query(`INSERT INTO notificaciones(usuario_id,clave,titulo,cuerpo,url) VALUES($1,$2,$3,$4,$5) ON CONFLICT (usuario_id,clave) WHERE clave IS NOT NULL DO NOTHING RETURNING *`,[usuarioId,payload.key||null,payload.title,payload.body||'',payload.url||'/']);return q.rows[0]||null;}
async function notify(usuarioIds,payload,client=pool){
 const ids=[...new Set((usuarioIds||[]).map(Number).filter(Boolean))],created=[];
 try{for(const usuarioId of ids)if(await createNotification(client,usuarioId,payload))created.push(usuarioId);}
 catch(e){if(e.code!=='42P01')throw e;}
 await notifyUsers(created.length?created:ids,payload);return created;
}
async function audit(client,entity,entityId,action,userId,detail={}){
 try{await client.query('INSERT INTO auditoria(entidad,entidad_id,accion,usuario_id,detalle) VALUES($1,$2,$3,$4,$5::jsonb)',[entity,String(entityId),action,userId||null,JSON.stringify(detail)]);}
 catch(e){if(e.code!=='42P01')throw e;}
}
async function sweepDueNotifications(){const overdue=await pool.query(`SELECT id,numero,titulo,asignado_a FROM alertas WHERE vence_at IS NOT NULL AND vence_at<now() AND estado NOT IN ('cerrada','cancelada')`);const managers=await pool.query("SELECT id FROM usuarios WHERE activo AND rol IN ('jefe_mantenimiento','admin')");for(const a of overdue.rows){const code='BODEN-'+String(a.numero).padStart(4,'0');await notify([a.asignado_a,...managers.rows.map(x=>x.id)],{key:`alerta-vencida-${a.id}`,title:'Tarea vencida',body:`${code} · ${a.titulo}`,url:`/?alerta=${a.id}`});}}
module.exports={notify,audit,sweepDueNotifications};
