'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { RECURRING_PLAN, GENERATOR_CHECKLIST } = require('../src/recurring-plan');

test('conserva las ocho rutinas entregadas en la hoja mensual', () => {
  assert.equal(RECURRING_PLAN.length, 8);
  assert.equal(RECURRING_PLAN.filter(x => x.frequency === 'semanal').length, 1);
  assert.equal(RECURRING_PLAN.filter(x => x.frequency === 'mensual').length, 7);
});

test('el chequeo semanal del generador incluye los seis controles informados', () => {
  const generator = RECURRING_PLAN.find(x => x.key === 'chequeo-generador');
  assert.deepEqual(generator.checklist, GENERATOR_CHECKLIST);
  assert.equal(GENERATOR_CHECKLIST.length, 6);
});

test('las claves del plan recurrente no se repiten', () => {
  assert.equal(new Set(RECURRING_PLAN.map(x => x.key)).size, RECURRING_PLAN.length);
});

