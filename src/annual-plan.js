'use strict';

// Calendario entregado por Böden. Los meses son 1=enero ... 12=diciembre.
const ANNUAL_PLAN = Object.freeze([
  { key: 'generador', title: 'Mantenimiento del generador', months: [3] },
  { key: 'extintores', title: 'Recarga de extintores', months: [12] },
  { key: 'calderas', title: 'Mantenimiento de calderas', months: [6] },
  { key: 'estanque-agua', title: 'Limpieza del estanque de agua', months: [9] },
  { key: 'analisis-agua', title: 'Análisis físico-químico del agua', months: [9] },
  { key: 'inventario-equipamiento', title: 'Inventario de equipamiento', months: [3] },
  { key: 'estanqueidad-gas', title: 'Informe de estanqueidad de la red de gas', months: [10] },
  { key: 'cerraduras-habitaciones', title: 'Mantenimiento de cerraduras de habitaciones', months: [5, 11] },
  { key: 'termografia', title: 'Termografía', months: [1] },
  { key: 'llaves-paso', title: 'Control de llaves de paso', months: [5] },
  { key: 'filtros-fancoil', title: 'Limpieza de filtros Fancoil', months: [2, 4, 6, 8, 10, 12] },
]);

const MONTHS = Object.freeze(['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']);

module.exports = { ANNUAL_PLAN, MONTHS };

