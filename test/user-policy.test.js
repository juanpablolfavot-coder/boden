'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canManageUsers, canManageTarget, canAssignRole } = require('../src/user-policy');

test('administración y jefatura pueden gestionar personal', () => {
  assert.equal(canManageUsers('admin'), true);
  assert.equal(canManageUsers('jefe_mantenimiento'), true);
  assert.equal(canManageUsers('mantenimiento'), false);
});

test('jefatura administra empleados y técnicos, no roles privilegiados', () => {
  assert.equal(canManageTarget('jefe_mantenimiento', 'mantenimiento'), true);
  assert.equal(canManageTarget('jefe_mantenimiento', 'recepcion'), true);
  assert.equal(canManageTarget('jefe_mantenimiento', 'jefe_mantenimiento'), false);
  assert.equal(canManageTarget('jefe_mantenimiento', 'admin'), false);
});

test('solo administración asigna roles privilegiados', () => {
  assert.equal(canAssignRole('jefe_mantenimiento', 'mantenimiento'), true);
  assert.equal(canAssignRole('jefe_mantenimiento', 'admin'), false);
  assert.equal(canAssignRole('admin', 'admin'), true);
});

