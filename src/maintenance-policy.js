'use strict';
const MANAGER_ROLES=new Set(['jefe_mantenimiento','admin']);
function isManager(role){return MANAGER_ROLES.has(role);}
function canWorkOnAlert(user,alert){return isManager(user.rol)||(user.rol==='mantenimiento'&&Number(alert.asignado_a)===Number(user.id));}
function validateTransition(user,alert,action,evidence={}){
 const transitions={en_proceso:['asignada'],pausar:['en_proceso'],resuelta:['en_proceso'],aprobar:['resuelta'],rechazar:['resuelta'],cancelada:['nueva','asignada','en_proceso','resuelta'],reabrir:['cerrada']};
 if(!transitions[action])return{ok:false,status:400,error:'Acción inválida'};
 if(!transitions[action].includes(alert.estado))return{ok:false,status:409,error:`No se puede ejecutar ${action} desde ${alert.estado}`};
 if(['aprobar','rechazar','cancelada','reabrir'].includes(action)&&!isManager(user.rol))return{ok:false,status:403,error:'Solo supervisión puede verificar o cancelar'};
 if(['en_proceso','pausar','resuelta'].includes(action)&&!canWorkOnAlert(user,alert))return{ok:false,status:403,error:'La tarea debe estar asignada a este técnico'};
 if(action==='resuelta'){const note=String(evidence.nota||'').trim(),hasPhoto=typeof evidence.foto==='string'&&evidence.foto.startsWith('data:image/');if(note.length<5)return{ok:false,status:400,error:'Documentá el trabajo realizado y el resultado'};if(!hasPhoto)return{ok:false,status:400,error:'Adjuntá una fotografía como evidencia del trabajo'};}
 if(action==='rechazar'&&String(evidence.nota||'').trim().length<5)return{ok:false,status:400,error:'Indicá el motivo del rechazo'};
 return{ok:true};
}
module.exports={isManager,canWorkOnAlert,validateTransition};
