'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePreventiveCompletion } = require('../src/preventive-policy');

test('un preventivo exige resultado y fotografía', () => {
  assert.equal(validatePreventiveCompletion({ resultado: 'Revisado' }).ok, false);
  assert.equal(validatePreventiveCompletion({ foto: 'data:image/jpeg;base64,AA==' }).ok, false);
  assert.equal(validatePreventiveCompletion({ resultado: 'Revisado y probado', foto: 'data:image/jpeg;base64,AA==' }).ok, true);
});

test('rechaza evidencia excesiva', () => {
  assert.equal(validatePreventiveCompletion({ resultado: 'Revisado', foto: `data:image/jpeg;base64,${'A'.repeat(3500000)}` }).ok, false);
});

