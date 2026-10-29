'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('el tablero integra preventivos por equipo, plan anual y rutinas', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'routes', 'centro.js'), 'utf8');

  assert.match(source, /FROM preventivos p/);
  assert.match(source, /FROM mantenimiento_anual_ejecuciones/);
  assert.match(source, /FROM mantenimiento_rutina_ejecuciones/);
  assert.match(source, /a\.estado NOT IN \('cerrada','cancelada'\)/);
  assert.match(source, /agenda\.proxima_fecha<=hoy\.fecha\+14/);
});

