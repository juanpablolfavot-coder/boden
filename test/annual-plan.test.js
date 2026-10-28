'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ANNUAL_PLAN } = require('../src/annual-plan');

test('el plan anual conserva las once actividades entregadas', () => {
  assert.equal(ANNUAL_PLAN.length, 11);
  assert.deepEqual(ANNUAL_PLAN.find(x => x.key === 'generador').months, [3]);
  assert.deepEqual(ANNUAL_PLAN.find(x => x.key === 'cerraduras-habitaciones').months, [5, 11]);
  assert.deepEqual(ANNUAL_PLAN.find(x => x.key === 'filtros-fancoil').months, [2, 4, 6, 8, 10, 12]);
});

test('todos los meses programados son válidos y no se repiten por actividad', () => {
  for (const item of ANNUAL_PLAN) {
    assert.ok(item.months.every(month => Number.isInteger(month) && month >= 1 && month <= 12));
    assert.equal(new Set(item.months).size, item.months.length);
  }
});

