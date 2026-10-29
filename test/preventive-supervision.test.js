'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('la migración respalda antes de agregar la revisión de preventivos', () => {
  const db = read('src/db.js');
  assert.ok(db.indexOf('await ensureWorkflowBackup()') < db.indexOf("readFileSync(path.join(__dirname, '..', 'db', 'operations.sql')"));
  assert.match(read('db/operations.sql'), /alertas ADD COLUMN IF NOT EXISTS preventivo_id/);
});

test('el preventivo espera aprobación antes de reprogramarse', () => {
  const preventive = read('src/routes/preventivos.js');
  const alerts = read('src/routes/alertas.js');
  assert.match(preventive, /'resuelta'/);
  assert.match(preventive, /Preventivo enviado a verificación/);
  assert.doesNotMatch(preventive, /UPDATE preventivos SET ultimo_realizado/);
  assert.match(alerts, /action === 'aprobar' && alerta\.preventivo_id/);
  assert.match(alerts, /aprobado_y_reprogramado/);
});

