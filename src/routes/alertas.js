const express = require('express');
const { pool } = require('../db');
const { auth, requireRole } = require('../auth');
const { maintenanceUserIds } = require('../push');
const { notify, audit } = require('../notifications');
const { validateTransition } = require('../maintenance-policy');

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
         ua.nombre AS asignado_nombre,
         e.nombre AS equipo_nombre,
         e.codigo AS equipo_codigo,
         uv.nombre AS verificado_nombre
  FROM alertas a
  LEFT JOIN categorias c  ON c.id = a.categoria_id
  LEFT JOIN ubicaciones u ON u.id = a.ubicacion_id
  LEFT JOIN usuarios ur   ON ur.id = a.reportado_por
  LEFT JOIN usuarios ua   ON ua.id = a.asignado_a
  LEFT JOIN equipos e     ON e.id = a.equipo_id
  LEFT JOIN usuarios uv   ON uv.id = a.verificada_por
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

function canSeeAlert(user, alerta) {
  return !['recepcion', 'mucama', 'personal'].includes(user.rol) || Number(alerta.reportado_por) === Number(user.id);
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
  const { titulo, descripcion, categoria_id, ubicacion_id, equipo_id, prioridad, foto, vip } = req.body || {};
  if (!titulo || !ubicacion_id) {
    return res.status(400).json({ error: 'Faltan título y ubicación' });
  }
  const prio = PRIOS.includes(prioridad) ? prioridad : 'media';
  try {
    const num = (await pool.query("SELECT nextval('alerta_numero_seq') AS n")).rows[0].n;
    const { rows } = await pool.query(
      `INSERT INTO alertas (numero, titulo, descripcion, categoria_id, ubicacion_id, equipo_id, prioridad, reportado_por, vip)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [num, titulo.trim(), descripcion || null, categoria_id || null, ubicacion_id, equipo_id || null, prio, req.user.id, !!vip]
    );
    const id = rows[0].id;
    await registrarHistorial(id, 'Alerta creada', req.user.id, `Prioridad ${prio}`);
    if (foto && typeof foto === 'string' && foto.startsWith('data:image')) {
      await pool.query('INSERT INTO adjuntos (alerta_id, url, tipo) VALUES ($1,$2,$3)', [id, foto, 'problema']);
    }
    const alerta = await getAlerta(id);

    // Push a mantenimiento + jefe
    const ids = await maintenanceUserIds();
    await notify(ids, {
      key: `alerta-nueva-${id}`,
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
  if (!canSeeAlert(req.user, alerta)) return res.status(403).json({ error: 'No tenés acceso a esta alerta' });
  const adj = await pool.query(
    'SELECT url, tipo, created_at FROM adjuntos WHERE alerta_id = $1 ORDER BY created_at',
    [req.params.id]
  );
  alerta.adjuntos = adj.rows;
  res.json(alerta);
});

// GET /api/alertas/:id/historial
router.get('/:id/historial', auth, async (req, res) => {
  const alerta = await getAlerta(req.params.id);
  if (!alerta) return res.status(404).json({ error: 'Alerta no encontrada' });
  if (!canSeeAlert(req.user, alerta)) return res.status(403).json({ error: 'No tenés acceso a esta alerta' });
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
  if (alerta.estado !== 'nueva' || alerta.asignado_a) {
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
  const { asignado_a, vence_at } = req.body || {};
  if (!asignado_a) return res.status(400).json({ error: 'Falta el operario' });
  const alerta = await getAlerta(req.params.id);
  if (!alerta) return res.status(404).json({ error: 'No encontrada' });
  const tecnico = await pool.query("SELECT id FROM usuarios WHERE id=$1 AND activo AND rol IN ('mantenimiento','jefe_mantenimiento')", [asignado_a]);
  if (!tecnico.rowCount) return res.status(400).json({ error: 'Seleccioná un técnico activo' });
  if (vence_at && Number.isNaN(Date.parse(vence_at))) return res.status(400).json({ error: 'Vencimiento inválido' });

  await pool.query(
    `UPDATE alertas SET asignado_a=$1,vence_at=$2,estado='asignada',tomada_at=COALESCE(tomada_at,now()),verificada_por=NULL,verificada_at=NULL,verificacion_nota=NULL WHERE id=$3`,
    [asignado_a, vence_at || null, alerta.id]
  );
  const upd = await getAlerta(alerta.id);
  await registrarHistorial(alerta.id, 'Asignada', req.user.id, `A ${upd.asignado_nombre}`);
  await audit(pool,'alerta',alerta.id,'asignada',req.user.id,{asignado_a:Number(asignado_a),vence_at:vence_at||null});
  await notify([Number(asignado_a)], {
    key: `alerta-asignada-${alerta.id}-${asignado_a}`,
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

  const action = estado === 'cerrada' ? 'aprobar' : estado;
  const check = validateTransition(req.user, alerta, action, { nota, foto });
  if (!check.ok) return res.status(check.status).json({ error: check.error });
  const transiciones = {
    en_proceso: { set: `estado='en_proceso'`, ev: 'Trabajo iniciado' },
    pausar:     { from: ['en_proceso'], set: `estado='asignada'`, ev: 'Pausada' },
    resuelta:   { set: `estado='resuelta', resuelta_at=now()`, ev: 'Enviada a verificación' },
    aprobar:    { set: `estado='cerrada',cerrada_at=now(),verificada_por=${Number(req.user.id)},verificada_at=now(),verificacion_nota=$2`, ev: 'Cierre aprobado por supervisión' },
    rechazar:   { set: `estado='en_proceso',resuelta_at=NULL,verificada_por=${Number(req.user.id)},verificada_at=now(),verificacion_nota=$2`, ev: 'Cierre rechazado por supervisión' },
    cancelada:  { set: `estado='cancelada'`, ev: 'Cancelada' },
    reabrir:    { set: `estado='en_proceso', cerrada_at=NULL`, ev: 'Reabierta' },
  };
  const t = transiciones[action];

  const params=[alerta.id];if(['aprobar','rechazar'].includes(action))params.push(nota||null);
  await pool.query(`UPDATE alertas SET ${t.set} WHERE id = $1`, params);
  await registrarHistorial(alerta.id, t.ev, req.user.id, nota || null);
  await audit(pool,'alerta',alerta.id,action,req.user.id,{nota:nota||null});
  if (estado === 'resuelta' && foto && typeof foto === 'string' && foto.startsWith('data:image')) {
    await pool.query('INSERT INTO adjuntos (alerta_id, url, tipo) VALUES ($1,$2,$3)', [alerta.id, foto, 'solucion']);
  }
  if (action === 'rechazar') {
    await notify([Number(alerta.asignado_a)], { key:`alerta-rechazada-${alerta.id}-${Date.now()}`, title: 'Trabajo rechazado por supervisión', body: `${alerta.codigo} · ${nota}`, url: '/' });
  }
  if (action === 'aprobar') {
    await notify([Number(alerta.reportado_por), Number(alerta.asignado_a)], { key:`alerta-aprobada-${alerta.id}`, title: 'Cierre aprobado', body: `${alerta.codigo} · ${alerta.titulo}`, url: '/' });
  }
  res.json(await getAlerta(alerta.id));
});

module.exports = router;
