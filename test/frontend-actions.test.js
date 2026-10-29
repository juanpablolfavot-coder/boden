'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('todos los botones declarados tienen una acción implementada', () => {
  const dir = path.join(__dirname, '..', 'public');
  const files = fs.readdirSync(dir).filter((name) => /^operations.*\.js$/.test(name));
  const source = files.map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join('\n');
  const declared = new Set([...source.matchAll(/data-action="([A-Za-z0-9_]+)"/g)].map((x) => x[1]));
  const implemented = new Set([
    ...[...source.matchAll(/OS\.actions\.([A-Za-z0-9_]+)\s*=/g)].map((x) => x[1]),
    ...[...source.matchAll(/alterAlert\('([A-Za-z0-9_]+)'/g)].map((x) => x[1]),
    'close', 'logout', 'menu', 'retry',
  ]);
  const missing = [...declared].filter((name) => !implemented.has(name));
  assert.deepEqual(missing, []);
});

