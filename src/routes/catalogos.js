const express = require('express');
const { pool } = require('../db');
const { auth, requireRole } = require('../auth');

const router = express.Router();

// GET /api/catalogos  -> ubicaciones + categorias + operarios (para asignar)
router.get('/', auth, async (req, res) => {
  try {
    const [ubic, cat, oper] = await Promise.all([
      pool.query('SELECT id, tipo, nombre FROM ubicaciones WHERE activo = TRUE ORDER BY tipo, nombre'),
      pool.query('SELECT id, nombre FROM categorias WHERE activo = TRUE ORDER BY nombre'),
      pool.query("SELECT id, nombre FROM usuarios WHERE rol IN ('mantenimiento','jefe_mantenimiento') AND activo = TRUE ORDER BY nombre"),
    ]);
    res.json({ ubicaciones: ubic.rows, categorias: cat.rows, operarios: oper.rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al cargar catálogos' });
  }
});

// --- ABM (solo admin) ---

// Lista completa (incluye inactivos) para el panel admin
router.get('/admin', auth, requireRole('admin'), async (req, res) => {
  const [ubic, cat] = await Promise.all([
    pool.query('SELECT id, tipo, nombre, activo FROM ubicaciones ORDER BY activo DESC, tipo, nombre'),
    pool.query('SELECT id, nombre, activo FROM categorias ORDER BY activo DESC, nombre'),
  ]);
  res.json({ ubicaciones: ubic.rows, categorias: cat.rows });
});

router.post('/ubicaciones', auth, requireRole('admin'), async (req, res) => {
  const { tipo, nombre } = req.body || {};
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre' });
  const { rows } = await pool.query(
    'INSERT INTO ubicaciones (tipo, nombre) VALUES ($1,$2) RETURNING *',
    [tipo || 'habitacion', nombre.trim()]
  );
  res.status(201).json(rows[0]);
});

router.patch('/ubicaciones/:id', auth, requireRole('admin'), async (req, res) => {
  const { nombre, tipo, activo } = req.body || {};
  const sets = [], params = [];
  if (nombre !== undefined) { params.push(nombre.trim()); sets.push(`nombre=$${params.length}`); }
  if (tipo !== undefined)   { params.push(tipo); sets.push(`tipo=$${params.length}`); }
  if (activo !== undefined) { params.push(!!activo); sets.push(`activo=$${params.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  params.push(req.params.id);
  const { rows } = await pool.query(`UPDATE ubicaciones SET ${sets.join(', ')} WHERE id=$${params.length} RETURNING *`, params);
  res.json(rows[0]);
});

router.post('/categorias', auth, requireRole('admin'), async (req, res) => {
  const { nombre } = req.body || {};
  if (!nombre) return res.status(400).json({ error: 'Falta el nombre' });
  const { rows } = await pool.query(
    'INSERT INTO categorias (nombre) VALUES ($1) RETURNING *',
    [nombre.trim()]
  );
  res.status(201).json(rows[0]);
});

router.patch('/categorias/:id', auth, requireRole('admin'), async (req, res) => {
  const { nombre, activo } = req.body || {};
  const sets = [], params = [];
  if (nombre !== undefined) { params.push(nombre.trim()); sets.push(`nombre=$${params.length}`); }
  if (activo !== undefined) { params.push(!!activo); sets.push(`activo=$${params.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  params.push(req.params.id);
  const { rows } = await pool.query(`UPDATE categorias SET ${sets.join(', ')} WHERE id=$${params.length} RETURNING *`, params);
  res.json(rows[0]);
});

// POST /api/catalogos/habitaciones-generar  -> crea habitaciones por piso (101.., 201.., 301..)
// body: { p1, p2, p3 }  cantidad de habitaciones por piso. No duplica las que ya existan.
router.post('/habitaciones-generar', auth, requireRole('admin'), async (req, res) => {
  const counts = [Number(req.body?.p1) || 0, Number(req.body?.p2) || 0, Number(req.body?.p3) || 0];
  if (counts.every((n) => n <= 0)) return res.status(400).json({ error: 'Indicá cuántas habitaciones por piso' });
  let creadas = 0, existentes = 0;
  for (let piso = 1; piso <= 3; piso++) {
    const cant = Math.min(counts[piso - 1], 99); // numeración piso*100 + 1..99
    for (let i = 1; i <= cant; i++) {
      const nombre = `Habitación ${piso * 100 + i}`;
      const ex = await pool.query('SELECT 1 FROM ubicaciones WHERE nombre = $1 LIMIT 1', [nombre]);
      if (ex.rowCount) { existentes++; continue; }
      await pool.query('INSERT INTO ubicaciones (tipo, nombre) VALUES ($1,$2)', ['habitacion', nombre]);
      creadas++;
    }
  }
  res.json({ creadas, existentes, total: creadas + existentes });
});

module.exports = router;
