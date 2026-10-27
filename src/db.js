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
  // Módulos CMMS v2: migraciones aditivas sin eliminar tablas ni registros.
  const operationsSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'operations.sql'), 'utf8');
  await pool.query(operationsSql);
  // La migración simple solo se habilita después de verificar un respaldo de producción.
  if (process.env.BODEN_SIMPLE_MIGRATION === '1') {
    const simpleSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'simple-maintenance.sql'), 'utf8');
    await pool.query(simpleSql);
  }
  await seedIfEmpty();
}

async function seedIfEmpty() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM usuarios');
  if (rows[0].n > 0) return;

  console.log('[BODEN] Base vacía: cargando datos iniciales…');
  const hash = (p) => bcrypt.hashSync(p, 10);

  // En instalaciones nuevas crear solo un administrador, nunca usuarios de prueba
  // con contraseñas publicadas en el repositorio.
  const adminPassword = process.env.BODEN_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 16) {
    throw new Error('Configurar BODEN_ADMIN_PASSWORD con al menos 16 caracteres');
  }
  const usuarios = [
    ['Administrador', 'admin@boden', adminPassword, 'admin'],
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

  console.log('[BODEN] Datos iniciales cargados.');
  console.log('[BODEN] Cuenta de administrador creada (credenciales configuradas de forma privada).');
}

module.exports = { pool, query, ensureSchema };
