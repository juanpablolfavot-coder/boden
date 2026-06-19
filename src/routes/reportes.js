const express = require('express');
const { pool } = require('../db');
const { auth, requireRole } = require('../auth');

const router = express.Router();

// Horas de SLA por prioridad (para contar vencidas)
const SLA = { urgente: 1, alta: 2, media: 24, baja: 72 };

// GET /api/reportes/header  -> KPIs cortos para la tarjeta superior (todo mantenimiento)
router.get('/header', auth, requireRole('mantenimiento', 'jefe_mantenimiento', 'admin'), async (req, res) => {
  try {
    const abiertas = (await pool.query("SELECT COUNT(*)::int n FROM alertas WHERE estado NOT IN ('cerrada','cancelada')")).rows[0].n;
    const sinTomar = (await pool.query("SELECT COUNT(*)::int n FROM alertas WHERE estado = 'nueva'")).rows[0].n;
    let vencidas = 0;
    for (const [prio, horas] of Object.entries(SLA)) {
      const r = await pool.query(
        `SELECT COUNT(*)::int n FROM alertas WHERE estado NOT IN ('cerrada','cancelada') AND prioridad=$1 AND created_at < now() - ($2 || ' hours')::interval`,
        [prio, horas]
      );
      vencidas += r.rows[0].n;
    }
    const prom = (await pool.query(
      `SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (resuelta_at - created_at)) / 60))::int, 0) AS min FROM alertas WHERE resuelta_at IS NOT NULL`
    )).rows[0].min;
    res.json({ abiertas, sin_tomar: sinTomar, vencidas, prom_resolucion_min: prom });
  } catch (e) {
    console.error(e); res.status(500).json({ error: 'Error' });
  }
});

// GET /api/reportes/resumen
router.get('/resumen', auth, requireRole('jefe_mantenimiento', 'admin'), async (req, res) => {
  try {
    const abiertas = (await pool.query(
      "SELECT COUNT(*)::int n FROM alertas WHERE estado NOT IN ('cerrada','cancelada')"
    )).rows[0].n;
    const sinTomar = (await pool.query("SELECT COUNT(*)::int n FROM alertas WHERE estado = 'nueva'")).rows[0].n;

    // Vencidas SLA: abiertas cuyo tiempo desde creación supera el SLA de su prioridad
    let vencidas = 0;
    for (const [prio, horas] of Object.entries(SLA)) {
      const r = await pool.query(
        `SELECT COUNT(*)::int n FROM alertas
         WHERE estado NOT IN ('cerrada','cancelada')
           AND prioridad = $1
           AND created_at < now() - ($2 || ' hours')::interval`,
        [prio, horas]
      );
      vencidas += r.rows[0].n;
    }

    const prom = (await pool.query(
      `SELECT COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (resuelta_at - created_at)) / 60))::int, 0) AS min
       FROM alertas WHERE resuelta_at IS NOT NULL`
    )).rows[0].min;

    const cerradasSemana = (await pool.query(
      "SELECT COUNT(*)::int n FROM alertas WHERE estado = 'cerrada' AND cerrada_at > now() - interval '7 days'"
    )).rows[0].n;

    const ranking = (await pool.query(
      `SELECT u.nombre,
              COUNT(*) FILTER (WHERE a.estado IN ('resuelta','cerrada'))::int AS resueltas,
              COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (a.resuelta_at - a.created_at)) / 60))::int, 0) AS prom_min
       FROM usuarios u
       JOIN alertas a ON a.asignado_a = u.id
       WHERE u.rol IN ('mantenimiento','jefe_mantenimiento')
       GROUP BY u.id, u.nombre
       ORDER BY resueltas DESC`
    )).rows;

    res.json({
      abiertas,
      sin_tomar: sinTomar,
      vencidas,
      prom_resolucion_min: prom,
      cerradas_semana: cerradasSemana,
      ranking,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al armar el resumen' });
  }
});

module.exports = router;
