'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

test('la tabla de rutinas entrega un arreglo de filas al componente de tabla', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'operations-views.js'), 'utf8');
  const start = source.indexOf('function recurringPanel(data)');
  const end = source.indexOf('\nconst upcoming=', start);

  assert.notEqual(start, -1, 'No se encontró recurringPanel');
  assert.notEqual(end, -1, 'No se pudo delimitar recurringPanel');

  const recurringPanel = source.slice(start, end);
  assert.match(recurringPanel, /const rows=plans\.map\(plan=>\{/);
  assert.doesNotMatch(recurringPanel, /\}\)\.join\(''\);/);
  assert.match(recurringPanel, /table\(\['Actividad','Frecuencia','Período actual',''\],rows\)/);
});

