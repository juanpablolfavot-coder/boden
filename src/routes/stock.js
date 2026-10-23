'use strict';
const express=require('express');
const {pool}=require('../db');
const {auth,requireRole}=require('../auth');
const router=express.Router();
const chief=requireRole('jefe_mantenimiento','admin');
const run=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const str=(x,max=180)=>String(x??'').trim().slice(0,max);
const id=x=>/^\d+$/.test(String(x||''))&&+x>0?+x:null;
const num=x=>{const n=Number(x);return Number.isFinite(n)&&n>=0&&n<=99999999?Math.round(n*100)/100:null;};
const fail=(res,msg)=>res.status(400).json({error:msg});
router.use(auth,requireRole('mantenimiento','jefe_mantenimiento','admin'));
router.get('/',run(async(req,res)=>{
  const term=str(req.query.q,100),onlyLow=req.query.bajo==='1',args=[],where=['activo=true'];
  if(term){args.push('%'+term+'%');where.push('(nombre ILIKE $'+args.length+' OR sku ILIKE $'+args.length+' OR categoria ILIKE $'+args.length+')');}
  if(onlyLow)where.push('cantidad<=minimo');
  res.json((await pool.query(`SELECT * FROM repuestos WHERE ${where.join(' AND ')} ORDER BY CASE WHEN cantidad<=minimo THEN 0 ELSE 1 END,nombre LIMIT 1000`,args)).rows);
}));
router.post('/',chief,run(async(req,res)=>{
  const b=req.body||{},nombre=str(b.nombre),minimo=num(b.minimo??0),inicio=num(b.cantidad_inicial??0);
  if(nombre.length<3||minimo===null||inicio===null)return fail(res,'Nombre, mínimo o cantidad inicial inválidos');
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const r=await c.query(`INSERT INTO repuestos(sku,nombre,categoria,unidad,cantidad,minimo,ubicacion,proveedor,observaciones)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [str(b.sku,80)||null,nombre,str(b.categoria)||'General',str(b.unidad,40)||'unidad',inicio,minimo,str(b.ubicacion),str(b.proveedor),str(b.observaciones,500)]);
    if(inicio>0)await c.query(`INSERT INTO movimientos_stock(repuesto_id,tipo,cantidad,saldo,motivo,usuario_id)
      VALUES($1,'entrada',$2,$2,'Stock inicial', $3)`,[r.rows[0].id,inicio,req.user.id]);
    await c.query('COMMIT');res.status(201).json(r.rows[0]);
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
router.patch('/:id',chief,run(async(req,res)=>{
  if(!id(req.params.id))return fail(res,'Repuesto inválido');
  const b=req.body||{},a=[],set=[];
  for(const [k,max] of Object.entries({nombre:180,sku:80,categoria:180,unidad:40,ubicacion:180,proveedor:180,observaciones:500})){
    if(b[k]!==undefined){const v=str(b[k],max);if(k==='nombre'&&v.length<3)return fail(res,'Nombre inválido');a.push(k==='sku'?(v||null):v);set.push(k+'=$'+a.length);}
  }
  if(b.minimo!==undefined){const n=num(b.minimo);if(n===null)return fail(res,'Mínimo inválido');a.push(n);set.push('minimo=$'+a.length);}
  if(b.activo!==undefined){a.push(b.activo===true);set.push('activo=$'+a.length);}
  if(!set.length)return fail(res,'Sin cambios');
  a.push(req.params.id);
  const r=await pool.query(`UPDATE repuestos SET ${set.join(',')} WHERE id=$${a.length} RETURNING *`,a);
  if(!r.rows[0])return res.status(404).json({error:'Repuesto no encontrado'});
  res.json(r.rows[0]);
}));
router.get('/movimientos',run(async(req,res)=>{
  const rid=id(req.query.repuesto_id),a=rid?[rid]:[];
  const r=await pool.query(`SELECT m.*,r.nombre AS repuesto,r.unidad,u.nombre AS usuario,
    t.titulo AS trabajo FROM movimientos_stock m JOIN repuestos r ON r.id=m.repuesto_id
    JOIN usuarios u ON u.id=m.usuario_id LEFT JOIN trabajos t ON t.id=m.trabajo_id
    ${rid?'WHERE m.repuesto_id=$1':''} ORDER BY m.created_at DESC,m.id DESC LIMIT 300`,a);
  res.json(r.rows);
}));
// Movimiento auditable y atómico: nunca permite consumir stock negativo.
router.post('/movimientos',run(async(req,res)=>{
  const b=req.body||{},rid=id(b.repuesto_id),cantidad=num(b.cantidad);
  const tipos=['entrada','salida','ajuste_positivo','ajuste_negativo'],tipo=b.tipo;
  if(!rid||cantidad===null||cantidad<=0||!tipos.includes(tipo))return fail(res,'Movimiento inválido');
  if(b.trabajo_id&&!id(b.trabajo_id)||b.equipo_id&&!id(b.equipo_id))return fail(res,'Referencia inválida');
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const row=(await c.query('SELECT * FROM repuestos WHERE id=$1 AND activo=true FOR UPDATE',[rid])).rows[0];
    if(!row){await c.query('ROLLBACK');return res.status(404).json({error:'Repuesto no encontrado'});}
    const signo=['entrada','ajuste_positivo'].includes(tipo)?1:-1;
    const saldo=Math.round((Number(row.cantidad)+signo*cantidad)*100)/100;
    if(saldo<0){await c.query('ROLLBACK');return res.status(409).json({error:'Stock insuficiente. Disponible: '+row.cantidad+' '+row.unidad});}
    await c.query('UPDATE repuestos SET cantidad=$1 WHERE id=$2',[saldo,rid]);
    const r=await c.query(`INSERT INTO movimientos_stock(repuesto_id,tipo,cantidad,saldo,trabajo_id,equipo_id,motivo,usuario_id)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [rid,tipo,cantidad,saldo,id(b.trabajo_id),id(b.equipo_id),str(b.motivo,500),req.user.id]);
    await c.query('COMMIT');
    res.status(201).json(r.rows[0]);
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}));
router.use((e,req,res,next)=>{console.error('[BODEN stock]',e);const conflict=e.code==='23505',fk=e.code==='23503';res.status(conflict?409:fk?400:500).json({error:conflict?'SKU ya existe':fk?'Referencia inexistente':'No se pudo registrar el stock'});});
module.exports=router;
