'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {canWorkOnAlert,validateTransition}=require('../src/maintenance-policy');
const manager={id:1,rol:'jefe_mantenimiento'},tech={id:2,rol:'mantenimiento'},other={id:3,rol:'mantenimiento'};
test('solo el técnico asignado o supervisión puede ejecutar',()=>{const a={asignado_a:2,estado:'asignada'};assert.equal(canWorkOnAlert(tech,a),true);assert.equal(canWorkOnAlert(other,a),false);assert.equal(canWorkOnAlert(manager,a),true);});
test('resolver exige nota y fotografía',()=>{const a={asignado_a:2,estado:'en_proceso'};assert.equal(validateTransition(tech,a,'resuelta',{nota:'Reparado'}).ok,false);assert.equal(validateTransition(tech,a,'resuelta',{nota:'Reparado y probado',foto:'data:image/jpeg;base64,AA=='}).ok,true);});
test('solo supervisión aprueba o rechaza',()=>{const a={asignado_a:2,estado:'resuelta'};assert.equal(validateTransition(tech,a,'aprobar',{}).status,403);assert.equal(validateTransition(manager,a,'aprobar',{}).ok,true);assert.equal(validateTransition(manager,a,'rechazar',{nota:'Falta verificar funcionamiento'}).ok,true);});
test('no permite saltar estados',()=>{assert.equal(validateTransition(manager,{asignado_a:2,estado:'nueva'},'aprobar',{}).status,409);});
