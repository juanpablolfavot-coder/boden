const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { auth, requireRole } = require('../auth');

const router = express.Router();

const ROLES_VALIDOS = ['recepcion', 'mucama', 'personal', 'mantenimiento', 'jefe_mantenimiento', 'admin'];

// GET /api/usuarios  (lista completa)
router.get('/', auth, requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, nombre, email, rol, activo FROM usuarios ORDER BY activo DESC, nombre'
  );
  res.json(rows);
});

// POST /api/usuarios  (crear)
router.post('/', auth, requireRole('admin'), async (req, res) => {
  const { nombre, email, password, rol } = req.body || {};
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Faltan nombre, email o contraseña' });
  }
  if (!ROLES_VALIDOS.includes(rol)) {
    return res.status(400).json({ error: 'Rol inválido' });
  }
  try {
    const hash = bcrypt.hashSync(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1,$2,$3,$4) RETURNING id, nombre, email, rol, activo',
      [nombre.trim(), email.trim().toLowerCase(), hash, rol]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
    console.error(e);
    res.status(500).json({ error: 'No se pudo crear el usuario' });
  }
});

// PATCH /api/usuarios/:id  (editar nombre / rol / activo)
router.patch('/:id', auth, requireRole('admin'), async (req, res) => {
  const { nombre, rol, activo } = req.body || {};
  const sets = [];
  const params = [];
  if (nombre !== undefined) { params.push(nombre.trim()); sets.push(`nombre = $${params.length}`); }
  if (rol !== undefined) {
    if (!ROLES_VALIDOS.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
    params.push(rol); sets.push(`rol = $${params.length}`);
  }
  if (activo !== undefined) { params.push(!!activo); sets.push(`activo = $${params.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'Nada para actualizar' });
  params.push(req.params.id);
  const { rows } = await pool.query(
    `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id, nombre, email, rol, activo`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(rows[0]);
});

// POST /api/usuarios/:id/password  (resetear contraseña)
router.post('/:id/password', auth, requireRole('admin'), async (req, res) => {
  const { password } = req.body || {};
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres' });
  }
  const hash = bcrypt.hashSync(password, 10);
  const { rowCount } = await pool.query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [hash, req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json({ ok: true });
});

module.exports = router;
