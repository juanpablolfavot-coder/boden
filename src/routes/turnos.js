const express = require('express');
const { pool } = require('../db');
const { auth, requireRole } = require('../auth');

const router = express.Router();

// minutos del día (hora local de Argentina) ahora
function nowARminutes() {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Argentina/Cordoba', hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const [h, m] = f.format(new Date()).split(':').map(Number);
  return h * 60 + m;
}
function toMin(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + (m || 0);
}
// ¿el minuto "now" cae dentro del rango ini-fin? (soporta cruce de medianoche)
function dentro(now, ini, fin) {
  if (ini === fin) return true;
  if (ini < fin) return now >= ini && now < fin;
  return now >= ini || now < fin; // cruza medianoche (ej 22:00-06:00)
}

async function turnoConUsuarios(t) {
  const u = await pool.query(
    `SELECT us.id, us.nombre FROM turno_usuarios tu JOIN usuarios us ON us.id = tu.usuario_id WHERE tu.turno_id = $1 ORDER BY us.nombre`,
    [t.id]
  );
  return { ...t, usuarios: u.rows };
}

// GET /api/turnos/activo  -> turno que corresponde a la hora actual
router.get('/activo', auth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM turnos WHERE activo = TRUE');
  const now = nowARminutes();
  const match = rows.find((t) => dentro(now, toMin(t.hora_inicio), toMin(t.hora_fin)));
  if (!match) return res.json({ turno: null });
  res.json({ turno: await turnoConUsuarios(match) });
});

// GET /api/turnos  (admin) -> todos con sus personas
router.get('/', auth, requireRole('admin'), async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM turnos ORDER BY hora_inicio');
  const out = [];
  for (const t of rows) out.push(await turnoConUsuarios(t));
  res.json(out);
});

// POST /api/turnos  (admin)
router.post('/', auth, requireRole('admin'), async (req, res) => {
  const { nombre, hora_inicio, hora_fin, usuarios } = req.body || {};
  if (!nombre || !hora_inicio || !hora_fin) return res.status(400).json({ error: 'Faltan datos del turno' });
  const ids = Array.isArray(usuarios) ? usuarios.slice(0, 3) : [];
  const t = await pool.query('INSERT INTO turnos (nombre, hora_inicio, hora_fin) VALUES ($1,$2,$3) RETURNING *', [nombre.trim(), hora_inicio, hora_fin]);
  for (const id of ids) {
    await pool.query('INSERT INTO turno_usuarios (turno_id, usuario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [t.rows[0].id, id]);
  }
  res.status(201).json(await turnoConUsuarios(t.rows[0]));
});

// PATCH /api/turnos/:id  (admin) -> editar datos y/o personas
router.patch('/:id', auth, requireRole('admin'), async (req, res) => {
  const { nombre, hora_inicio, hora_fin, activo, usuarios } = req.body || {};
  const sets = [], params = [];
  if (nombre !== undefined) { params.push(nombre.trim()); sets.push(`nombre=$${params.length}`); }
  if (hora_inicio !== undefined) { params.push(hora_inicio); sets.push(`hora_inicio=$${params.length}`); }
  if (hora_fin !== undefined) { params.push(hora_fin); sets.push(`hora_fin=$${params.length}`); }
  if (activo !== undefined) { params.push(!!activo); sets.push(`activo=$${params.length}`); }
  if (sets.length) {
    params.push(req.params.id);
    await pool.query(`UPDATE turnos SET ${sets.join(', ')} WHERE id=$${params.length}`, params);
  }
  if (Array.isArray(usuarios)) {
    await pool.query('DELETE FROM turno_usuarios WHERE turno_id=$1', [req.params.id]);
    for (const id of usuarios.slice(0, 3)) {
      await pool.query('INSERT INTO turno_usuarios (turno_id, usuario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.params.id, id]);
    }
  }
  const t = await pool.query('SELECT * FROM turnos WHERE id=$1', [req.params.id]);
  if (!t.rows[0]) return res.status(404).json({ error: 'Turno no encontrado' });
  res.json(await turnoConUsuarios(t.rows[0]));
});

// DELETE /api/turnos/:id  (admin)
router.delete('/:id', auth, requireRole('admin'), async (req, res) => {
  await pool.query('DELETE FROM turnos WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
