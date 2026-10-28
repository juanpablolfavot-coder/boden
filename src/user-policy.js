'use strict';

const ROLES_VALIDOS = ['recepcion', 'mucama', 'personal', 'mantenimiento', 'jefe_mantenimiento', 'admin'];
const ROLES_PRIVILEGIADOS = new Set(['jefe_mantenimiento', 'admin']);

function canManageUsers(role) {
  return role === 'admin' || role === 'jefe_mantenimiento';
}

function canManageTarget(actorRole, targetRole) {
  return actorRole === 'admin' || (actorRole === 'jefe_mantenimiento' && !ROLES_PRIVILEGIADOS.has(targetRole));
}

function canAssignRole(actorRole, role) {
  return ROLES_VALIDOS.includes(role) && (actorRole === 'admin' || !ROLES_PRIVILEGIADOS.has(role));
}

module.exports = { ROLES_VALIDOS, canManageUsers, canManageTarget, canAssignRole };

