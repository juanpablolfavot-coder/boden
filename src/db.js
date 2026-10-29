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
  // En una instalación existente, preservar el estado previo antes de sumar
  // la revisión gerencial de preventivos por equipo.
  await ensureWorkflowBackup();
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

async function ensureWorkflowBackup() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('boden-preventivos-supervision-20261029'))");
    const ready = await client.query(`SELECT
      to_regclass('public.preventivos') AS preventivos,
      to_regclass('public.trabajos') AS trabajos,
      to_regclass('public.auditoria') AS auditoria`);
    if (!ready.rows[0].preventivos || !ready.rows[0].trabajos) {
      await client.query('COMMIT');
      return;
    }
    await client.query('CREATE SCHEMA IF NOT EXISTS boden_backup_20261029');
    const existing = await client.query("SELECT to_regclass('boden_backup_20261029.manifest') AS name");
    if (!existing.rows[0].name) {
      for (const table of ['alertas','preventivos','trabajos','adjuntos']) {
        await client.query(`CREATE TABLE boden_backup_20261029.${table} AS TABLE public.${table} WITH DATA`);
      }
      if (ready.rows[0].auditoria) {
        await client.query('CREATE TABLE boden_backup_20261029.auditoria AS TABLE public.auditoria WITH DATA');
      }
      await client.query(`CREATE TABLE boden_backup_20261029.manifest (
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        motivo TEXT NOT NULL,
        conteos JSONB NOT NULL
      )`);
      const counts = await client.query(`SELECT jsonb_build_object(
        'alertas',(SELECT count(*) FROM alertas),
        'preventivos',(SELECT count(*) FROM preventivos),
        'trabajos',(SELECT count(*) FROM trabajos),
        'adjuntos',(SELECT count(*) FROM adjuntos)
      ) AS value`);
      await client.query(
        'INSERT INTO boden_backup_20261029.manifest(motivo,conteos) VALUES($1,$2)',
        ['Antes de exigir evidencia y aprobación gerencial en preventivos por equipo', counts.rows[0].value]
      );
      console.log('[BODEN] Respaldo previo creado en boden_backup_20261029.');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function seedHotelRooms() {
  // Números entregados en la hoja "Check list": 101-108 ... 601-608.
  // La inserción es idempotente y no altera ubicaciones existentes.
  let created = 0;
  for (let floor = 1; floor <= 6; floor++) {
    for (let room = 1; room <= 8; room++) {
      const name = `Habitación ${floor * 100 + room}`;
      const result = await pool.query(
        `INSERT INTO ubicaciones(tipo,nombre)
         SELECT 'habitacion',$1
         WHERE NOT EXISTS (SELECT 1 FROM ubicaciones WHERE lower(nombre)=lower($1))`,
        [name]
      );
      created += result.rowCount;
    }
  }
  if (created) console.log(`[BODEN] Plan preventivo: ${created} habitaciones incorporadas desde la planilla.`);
}

async function ensurePlanBackup() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('boden-plan-preventivo-20261028'))");
    await client.query('CREATE SCHEMA IF NOT EXISTS boden_backup_20261028');
    const existing = await client.query("SELECT to_regclass('boden_backup_20261028.manifest') AS name");
    if (!existing.rows[0].name) {
      for (const table of ['usuarios','ubicaciones','alertas','notificaciones','auditoria']) {
        await client.query(`CREATE TABLE boden_backup_20261028.${table} AS TABLE public.${table} WITH DATA`);
      }
      await client.query(`CREATE TABLE boden_backup_20261028.manifest (
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        motivo TEXT NOT NULL,
        conteos JSONB NOT NULL
      )`);
      const counts = await client.query(`SELECT jsonb_build_object(
        'usuarios',(SELECT count(*) FROM usuarios),
        'ubicaciones',(SELECT count(*) FROM ubicaciones),
        'alertas',(SELECT count(*) FROM alertas),
        'notificaciones',(SELECT count(*) FROM notificaciones),
        'auditoria',(SELECT count(*) FROM auditoria)
      ) AS value`);
      await client.query(
        'INSERT INTO boden_backup_20261028.manifest(motivo,conteos) VALUES($1,$2)',
        ['Antes de integrar Plan de mantenimiento preventivo.xlsx', counts.rows[0].value]
      );
      console.log('[BODEN] Respaldo previo creado en boden_backup_20261028.');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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

module.exports = { pool, query, ensureSchema, seedHotelRooms, ensurePlanBackup, ensureWorkflowBackup };

