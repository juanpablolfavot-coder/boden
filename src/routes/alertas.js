const express = require('express');
const { pool } = require('../db');
const { auth, requireRole } = require('../auth');
const { notifyUsers, maintenanceUserIds } = require('../push');

const router = express.Router();

const PRIOS = ['urgente', 'alta', 'media', 'baja'];

// SELECT con joins y código formateado BODEN-0001
const SELECT_ALERTA = `
  SELECT a.*,
         ('BODEN-' || LPAD(a.numero::text, 4, '0')) AS codigo,
         c.nombre  AS categoria,
         u.nombre  AS ubicacion,
         u.tipo    AS ubicacion_tipo,
         ur.nombre AS reportado_nombre,
         ua.nombre AS asignado_nombre
  FROM alertas a
  LEFT JOIN categorias c  ON c.id = a.categoria_id
  LEFT JOIN ubicaciones u ON u.id = a.ubicacion_id
  LEFT JOIN usuarios ur   ON ur.id = a.reportado_por
  LEFT JOIN usuarios ua   ON ua.id = a.asignado_a
`;

async function registrarHistorial(alertaId, evento, usuarioId, nota) {
  await pool.query(
    'INSERT INTO alerta_historial (alerta_id, evento, usuario_id, nota) VALUES ($1,$2,$3,$4)',
    [alertaId, evento, usuarioId, nota || null]
  );
}

async function getAlerta(id) {
  const { rows } = await pool.query(`${SELECT_ALERTA} WHERE a.id = $1`, [id]);
  return rows[0];
}

// GET /api/alertas?estado=&prioridad=&asignado=&mias=
router.get('/', auth, async (req, res) => {
  try {
    const { estado, prioridad, asignado, mias, abiertas } = req.query;
    const where = [];
    const params = [];
    if (estado)    { params.push(estado);    where.push(`a.estado = $${params.length}`); }
    if (prioridad) { params.push(prioridad);  where.push(`a.prioridad = $${params.length}`); }
    if (asignado)  { params.push(asignado);   where.push(`a.asignado_a = $${params.length}`); }
    if (mias === '1')     { params.push(req.user.id); where.push(`a.asignado_a = $${params.length}`); }
    if (abiertas === '1') { where.push(`a.estado NOT IN ('cerrada','cancelada')`); }
    if (req.query.vip === '1') { where.push(`a.vip = TRUE`); }

    // Los que solo reportan ven únicamente lo suyo.
    if (['recepcion', 'mucama', 'personal'].includes(req.user.rol)) {
      params.push(req.user.id);
      where.push(`a.reportado_por = $${params.length}`);
    }

    const sql = `${SELECT_ALERTA} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY
        CASE a.prioridad WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
        a.created_at DESC`;
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al listar alertas' });
  }
});

// POST /api/alertas  (reportar)
router.post('/', auth, async (req, res) => {
  const { titulo, descripcion, categoria_id, ubicacion_id, prioridad, foto, vip } = req.body || {};
  if (!titulo || !ubicacion_id) {
    return res.status(400).json({ error: 'Faltan título y ubicación' });
  }
  const prio = PRIOS.includes(prioridad) ? prioridad : 'media';
  try {
    const num = (await pool.query("SELECT nextval('alerta_numero_seq') AS n")).rows[0].n;
    const { rows } = await pool.query(
      `INSERT INTO alertas (numero, titulo, descripcion, categoria_id, ubicacion_id, prioridad, reportado_por, vip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [num, titulo.trim(), descripcion || null, categoria_id || null, ubicacion_id, prio, req.user.id, !!vip]
    );
    const id = rows[0].id;
    await registrarHistorial(id, 'Alerta creada', req.user.id, `Prioridad ${prio}`);
    if (foto && typeof foto === 'string' && foto.startsWith('data:image')) {
      await pool.query('INSERT INTO adjuntos (alerta_id, url, tipo) VALUES ($1,$2,$3)', [id, foto, 'problema']);
    }
    const alerta = await getAlerta(id);

    // Push a mantenimiento + jefe
    const ids = await maintenanceUserIds();
    await notifyUsers(ids, {
      title: prio === 'urgente' ? '🔴 Alerta URGENTE' : 'Nueva alerta',
      body: `${alerta.codigo} · ${alerta.titulo} (${alerta.ubicacion})`,
      url: '/',
    });

    res.status(201).json(alerta);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error al crear la alerta' });
  }
});

// GET /api/alertas/:id
router.get('/:id', auth, async (req, res) => {
  const alerta = await getAlerta(req.params.id);
  if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' });
  const adj = await pool.query(
    'SELECT url, tipo, created_at FROM adjuntos WHERE alerta_id = $1 ORDER BY created_at',
    [req.params.id]
  );
  alerta.adjuntos = adj.rows;
  res.json(alerta);
});

// GET /api/alertas/:id/historial
router.get('/:id/historial', auth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT h.*, u.nombre AS usuario_nombre
     FROM alerta_historial h LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.alerta_id = $1 ORDER BY h.created_at ASC`,
    [req.params.id]
  );
  res.json(rows);
});

// PATCH /api/alertas/:id/tomar  (operario se la asigna y arranca)
router.patch('/:id/tomar', auth, requireRole('mantenimiento', 'jefe_mantenimiento', 'admin'), async (req, res) => {
  const alerta = await getAlerta(req.params.id);
  if (!alerta) return res.status(404).json({ error: 'No encontrada' });
  if (!['nueva', 'asignada'].includes(alerta.estado)) {
    return res.status(409).json({ error: 'Esta alerta ya fue tomada' });
  }
  await pool.query(
    `UPDATE alertas SET asignado_a = $1, estado = 'asignada', tomada_at = now() WHERE id = $2`,
    [req.user.id, alerta.id]
  );
  await registrarHistorial(alerta.id, 'Tomó la alerta', req.user.id, null);
  res.json(await getAlerta(alerta.id));
});

// PATCH /api/alertas/:id/asignar  (jefe asigna a alguien)
router.patch('/:id/asignar', auth, requireRole('jefe_mantenimiento', 'admin'), async (req, res) => {
  const { asignado_a } = req.body || {};
  if (!asignado_a) return res.status(400).json({ error: 'Falta el operario' });
  const alerta = await getAlerta(req.params.id);
  if (!alerta) return res.status(404).json({ error: 'No encontrada' });

  await pool.query(
    `UPDATE alertas SET asignado_a = $1, estado = 'asignada', tomada_at = COALESCE(tomada_at, now()) WHERE id = $2`,
    [asignado_a, alerta.id]
  );
  const upd = await getAlerta(alerta.id);
  await registrarHistorial(alerta.id, 'Asignada', req.user.id, `A ${upd.asignado_nombre}`);
  await notifyUsers([Number(asignado_a)], {
    title: 'Te asignaron una alerta',
    body: `${upd.codigo} · ${upd.titulo} (${upd.ubicacion})`,
    url: '/',
  });
  res.json(upd);
});

// PATCH /api/alertas/:id/estado  (en_proceso | resuelta | cerrada | cancelada | reabrir)
router.patch('/:id/estado', auth, requireRole('mantenimiento', 'jefe_mantenimiento', 'admin'), async (req, res) => {
  const { estado, nota, foto } = req.body || {};
  const alerta = await getAlerta(req.params.id);
  if (!alerta) return res.status(404).json({ error: 'No encontrada' });

  const transiciones = {
    en_proceso: { from: ['asignada', 'nueva'], set: `estado='en_proceso'`, ev: 'En proceso' },
    pausar:     { from: ['en_proceso'], set: `estado='asignada'`, ev: 'Pausada' },
    resuelta:   { from: ['en_proceso', 'asignada'], set: `estado='resuelta', resuelta_at=now()`, ev: 'Resuelta' },
    cerrada:    { from: ['resuelta'], set: `estado='cerrada', cerrada_at=now()`, ev: 'Cerrada y verificada', jefe: true },
    cancelada:  { from: ['nueva', 'asignada', 'en_proceso', 'resuelta'], set: `estado='cancelada'`, ev: 'Cancelada' },
    reabrir:    { from: ['resuelta', 'cerrada'], set: `estado='en_proceso', cerrada_at=NULL`, ev: 'Reabierta' },
  };
  const t = transiciones[estado];
  if (!t) return res.status(400).json({ error: 'Estado inválido' });
  if (t.jefe && !['jefe_mantenimiento', 'admin'].includes(req.user.rol)) {
    return res.status(403).json({ error: 'Solo el jefe puede cerrar' });
  }
  if (!t.from.includes(alerta.estado)) {
    return res.status(409).json({ error: `No se puede pasar de ${alerta.estado} a ${estado}` });
  }

  await pool.query(`UPDATE alertas SET ${t.set} WHERE id = $1`, [alerta.id]);
  await registrarHistorial(alerta.id, t.ev, req.user.id, nota || null);
  if (estado === 'resuelta' && foto && typeof foto === 'string' && foto.startsWith('data:image')) {
    await pool.query('INSERT INTO adjuntos (alerta_id, url, tipo) VALUES ($1,$2,$3)', [alerta.id, foto, 'solucion']);
  }
  res.json(await getAlerta(alerta.id));
});

module.exports = router;
