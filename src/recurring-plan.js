'use strict';

// Fuente: "Plan de mantenimiento preventivo.xlsx", hojas Mensual y Generador.
// No se importan marcas, hoteles ni vínculos externos presentes en la plantilla.
const GENERATOR_CHECKLIST = Object.freeze([
  'Nivel y estado del agua/refrigerante del radiador',
  'Resistencia de precalentamiento',
  'Batería: nivel y limpieza',
  'Combustible: tanque al 85% o más',
  'Nivel de aceite del cárter',
  'Accionamiento del motor',
]);

const RECURRING_PLAN = Object.freeze([
  { key: 'chequeo-generador', title: 'Chequeo del generador', frequency: 'semanal', checklist: GENERATOR_CHECKLIST },
  { key: 'mantenimiento-ascensores', title: 'Mantenimiento de ascensores', frequency: 'mensual' },
  { key: 'mantenimiento-keyter-aero-geo', title: 'Mantenimiento Keyter, Aero y Geo', frequency: 'mensual' },
  { key: 'chequeo-central-incendios', title: 'Chequeo de la central de incendios', frequency: 'mensual' },
  { key: 'inspeccion-extintores', title: 'Inspección de extintores', frequency: 'mensual' },
  { key: 'fumigacion', title: 'Fumigación', frequency: 'mensual' },
  { key: 'limpieza-fancoil', title: 'Limpieza de Fancoil', frequency: 'mensual' },
  { key: 'limpieza-pileta-patio', title: 'Limpieza de la pileta de patio', frequency: 'mensual' },
]);

module.exports = { RECURRING_PLAN, GENERATOR_CHECKLIST };

