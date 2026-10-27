'use strict';
const express=require('express');const {pool}=require('../db');const {auth}=require('../auth');const {sweepDueNotifications}=require('../notifications');const router=express.Router();
router.use(auth);
router.get('/',async(req,res,next)=>{try{if(process.env.BODEN_SIMPLE_MIGRATION!=='1')return res.json([]);await sweepDueNotifications();const {rows}=await pool.query('SELECT id,titulo,cuerpo,url,leida_at,created_at FROM notificaciones WHERE usuario_id=$1 ORDER BY created_at DESC LIMIT 50',[req.user.id]);res.json(rows);}catch(e){next(e);}});
router.patch('/:id/leida',async(req,res,next)=>{try{const {rows}=await pool.query('UPDATE notificaciones SET leida_at=COALESCE(leida_at,now()) WHERE id=$1 AND usuario_id=$2 RETURNING id,leida_at',[req.params.id,req.user.id]);if(!rows[0])return res.status(404).json({error:'Notificación no encontrada'});res.json(rows[0]);}catch(e){next(e);}});
router.use((e,req,res,next)=>{console.error('[BODEN notificaciones]',e);res.status(500).json({error:'No se pudieron cargar las notificaciones'});});
module.exports=router;
