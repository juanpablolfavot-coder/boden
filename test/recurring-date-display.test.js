'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('las rutinas guardan fechas estables y la interfaz humaniza registros anteriores', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'src', 'recurring-maintenance.js'), 'utf8');
  const client = fs.readFileSync(path.join(__dirname, '..', 'public', 'operations.js'), 'utf8');
  const views = fs.readFileSync(path.join(__dirname, '..', 'public', 'operations-views.js'), 'utf8');
  const alerts = fs.readFileSync(path.join(__dirname, '..', 'public', 'operations-alerts.js'), 'utf8');

  assert.match(server, /dateKey\(period\)/);
  assert.match(client, /Coordinated Universal Time/);
  assert.match(client, /período\\s\+/);
  assert.match(views, /OS\.humanText\(x\.descripcion\)/);
  assert.match(alerts, /humanText\(a\.descripcion\)/);
});
