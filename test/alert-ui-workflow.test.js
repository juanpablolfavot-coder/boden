'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('la revisión muestra evidencia, historial y acciones compatibles con cada estado', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'operations-forms.js'), 'utf8');
  const start = source.indexOf('OS.actions.alertDetail=async(id)=>{');
  const end = source.indexOf('\nconst alterAlert=', start);
  const detail = source.slice(start, end);

  assert.match(detail, /get\('\/alertas\/'\+id\+'\/historial'\)/);
  assert.match(detail, /EVIDENCIA/);
  assert.match(detail, /TRAZABILIDAD/);
  assert.match(detail, /a\.estado==='asignada'.*alertStart/);
  assert.match(detail, /a\.estado==='en_proceso'.*alertResolve/);
  assert.match(detail, /alertClose/);
  assert.match(detail, /alertReject/);
});

