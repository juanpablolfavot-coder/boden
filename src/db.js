const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Render exige SSL en conexiones externas; en local no molesta.
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
});

async function query(text, params) {
  return pool.query(text, params);
}

// Corre el esquema (idempotente) y carga datos iniciales si la base está vacía.
async function ensureSchema() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(sql);
  await seedIfEmpty();
  await seedTurnosIfEmpty();
}

// Carga turnos de ejemplo si la tabla está vacía (independiente del seed de usuarios)
async function seedTurnosIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM turnos');
  if (rows[0].n > 0) return;
  const oper = await pool.query("SELECT id, email FROM usuarios WHERE rol IN ('mantenimiento','jefe_mantenimiento')");
  const byEmail = {};
  oper.rows.forEach((u) => { byEmail[u.email] = u.id; });
  const turnos = [
    ['Mañana', '06:00', '14:00', ['diego@boden']],
    ['Tarde', '14:00', '22:00', ['martin@boden']],
    ['Noche', '22:00', '06:00', ['martin@boden', 'diego@boden']],
  ];
  for (const [nombre, ini, fin, emails] of turnos) {
    const t = await pool.query('INSERT INTO turnos (nombre, hora_inicio, hora_fin) VALUES ($1,$2,$3) RETURNING id', [nombre, ini, fin]);
    for (const em of emails) {
      if (byEmail[em]) await pool.query('INSERT INTO turno_usuarios (turno_id, usuario_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [t.rows[0].id, byEmail[em]]);
    }
  }
  console.log('[BODEN] Turnos de ejemplo cargados.');
}

async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
  if (rows[0].n > 0) return;

  console.log('[BODEN] Base vacía: cargando datos iniciales…');
  const hash = (p) => bcrypt.hashSync(p, 10);

  const usuarios = [
    ['Administrador', 'admin@boden',     'boden123', 'admin'],
    ['Jefe Mantenimiento', 'jefe@boden', 'boden123', 'jefe_mantenimiento'],
    ['Diego', 'diego@boden',             'boden123', 'mantenimiento'],
    ['Martín', 'martin@boden',           'boden123', 'mantenimiento'],
    ['Recepción', 'recepcion@boden',     'boden123', 'recepcion'],
    ['Mucama', 'mucama@boden',           'boden123', 'mucama'],
  ];
  for (const [nombre, email, pass, rol] of usuarios) {
    await pool.query(
      'INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ($1,$2,$3,$4)',
      [nombre, email, hash(pass), rol]
    );
  }

  const categorias = [
    'Climatización (AC / calefacción)',
    'Plomería / agua caliente',
    'Electricidad / iluminación',
    'TV / electrónica',
    'Mobiliario / cerrajería',
    'Limpieza técnica / otros',
  ];
  for (const c of categorias) {
    await pool.query('INSERT INTO categorias (nombre) VALUES ($1)', [c]);
  }

  const ubicaciones = [
    ['habitacion', 'Habitación 101'], ['habitacion', 'Habitación 102'],
    ['habitacion', 'Habitación 115'], ['habitacion', 'Habitación 208'],
    ['habitacion', 'Habitación 312'], ['habitacion', 'Habitación 410'],
    ['area', 'Lobby'], ['area', 'Pileta'], ['area', 'Spa · Sauna'],
    ['area', 'Comedor'], ['area', 'Cocina'], ['area', 'Pasillo Piso 3'],
    ['equipo', 'Caldera principal'], ['equipo', 'Grupo electrógeno'],
    ['equipo', 'Bomba de agua'], ['equipo', 'Ascensor'],
  ];
  for (const [tipo, nombre] of ubicaciones) {
    await pool.query('INSERT INTO ubicaciones (tipo, nombre) VALUES ($1,$2)', [tipo, nombre]);
  }

  console.log('[BODEN] Datos iniciales cargados.');
  console.log('[BODEN] Usuario admin: admin@boden / boden123');
}

module.exports = { pool, query, ensureSchema };
