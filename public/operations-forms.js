'use strict';
(function(OS){
const {S,E,I,api,modal,field,textarea,select,opts,status,badge,fdate,dateField,isManager,toast,number}=OS;
const grid=(...xs)=>'<div class="form-grid">'+xs.join('')+'</div>';
const arr=x=>Array.isArray(x)?x:[];
const get=(p)=>api(p);
const post=(p,b)=>api(p,{method:'POST',body:JSON.stringify(b)});
const patch=(p,b)=>api(p,{method:'PATCH',body:JSON.stringify(b)});
const escape=(x)=>E(x||'—');
const optTypes=Object.entries(OS.types);
const typesWork=['correctivo','preventivo','inspeccion','mejora','emergencia'];
const validDate=(x)=>x?dateField(x):new Date().toLocaleDateString('sv-SE',{timeZone:'America/Argentina/Cordoba'});
function requireManager(){if(!isManager())throw Error('La operación requiere un usuario de jefatura o administración');}
async function cat(){return S.cat||(S.cat=await get('/catalogos'));}
const equipOpts=(e)=>opts(e,'Sin equipo asociado');
const alertOpts=(a)=>[['','Sin alerta asociada'],...a.map(x=>[x.id,x.codigo+' · '+x.titulo])];
const valueNum=b=>({...b,equipo_id:b.equipo_id||null,ubicacion_id:b.ubicacion_id||null,responsable_id:b.responsable_id||null,alerta_id:b.alerta_id||null,tecnico_id:b.tecnico_id||null});
const details=(x)=>'<div class="detail"><small>'+E(x[0])+'</small><strong>'+E(x[1]??'—')+'</strong></div>';
async function listEquip(){return arr(await get('/equipos'));}
async function people(){const c=await cat();return arr(c.operarios);}
OS.actions.newEquipment=async()=>{
 requireManager();const c=await cat();
 const fields=grid(field('Nombre del equipo *','nombre','text','','required minlength="3"'),
  select('Familia técnica','tipo',optTypes,'bombas'),
  field('Marca','marca'),field('Modelo','modelo'),
  field('Número de serie','serie'),field('Sector / ubicación interna','sector'),
  select('Ubicación del hotel','ubicacion_id',opts(c.ubicaciones,'Sin ubicación específica')),
  select('Criticidad','criticidad',['alta','media','baja'],'media'),
  select('Estado operativo','estado',['operativo','mantenimiento','fuera_servicio'],'operativo'),
  field('Instalación','fecha_instalacion','date'),field('Garantía hasta','garantia_hasta','date'),
  textarea('Descripción y datos técnicos','descripcion'));
 modal('Registrar equipo / instalación',fields,b=>post('/equipos',valueNum(b)),'Guardar equipo');
};
OS.actions.equipmentDetail=async(id)=>{
 const x=await get('/equipos/'+id);
 const info='<div class="detail-grid">'+[
 ['Código',x.codigo],['Tipo',OS.types[x.tipo]||x.tipo],['Estado',status(x.estado)],['Criticidad',status(x.criticidad)],
 ['Ubicación',x.ubicacion||x.sector],['Marca / Modelo',[x.marca,x.modelo].filter(Boolean).join(' · ')||'—'],
 ['N° de serie',x.serie],['Garantía',fdate(x.garantia_hasta)],['Registrado',fdate(x.created_at)]
 ].map(details).join('')+'</div><div class="overline" style="margin:20px 0 10px">DESCRIPCIÓN TÉCNICA</div><div class="detail-desc">'+escape(x.descripcion)+'</div>'+
 '<div class="overline" style="margin:24px 0 10px">HISTORIAL DE INTERVENCIONES</div>'+
 (x.trabajos?.length?x.trabajos.map(t=>'<div class="activity"><div class="activity-symbol">'+I('wrench')+'</div><div class="activity-main"><strong>'+E(t.titulo)+'</strong><small>'+E(t.tecnico)+' · '+E(status(t.tipo))+' · '+E(fdate(t.fecha,true))+'</small></div></div>').join(''):'<p class="muted small">Este equipo todavía no tiene trabajos registrados.</p>')+
 '<div class="overline" style="margin:24px 0 10px">PLANES PREVENTIVOS</div>'+
 (x.preventivos?.length?x.preventivos.map(p=>'<div class="alert-line"><strong>'+E(p.titulo)+'</strong><small>'+E(fdate(p.proxima_fecha))+'</small></div>').join(''):'<p class="muted small">No hay planes asignados.</p>')+
 '<div class="row-actions" style="margin-top:22px">'+(isManager()?'<button class="btn btn-primary" data-action="editEquipment" data-id="'+id+'">Editar ficha</button>':'')+'<button class="btn btn-soft" data-action="newWorkFor" data-id="'+id+'">Registrar trabajo</button></div>';
 modal(x.nombre,info,null);
};
OS.actions.editEquipment=async(id)=>{
 requireManager();const x=await get('/equipos/'+id),c=await cat();OS.close();
 const fields=grid(field('Nombre *','nombre','text',x.nombre,'required minlength="3"'),
 select('Familia técnica','tipo',optTypes,x.tipo),field('Marca','marca','text',x.marca),
 field('Modelo','modelo','text',x.modelo),field('Serie','serie','text',x.serie),
 field('Sector','sector','text',x.sector),select('Ubicación','ubicacion_id',opts(c.ubicaciones,'Sin ubicación'),x.ubicacion_id||''),
 select('Criticidad','criticidad',['alta','media','baja'],x.criticidad),
 select('Estado','estado',['operativo','mantenimiento','fuera_servicio','baja'],x.estado),
 field('Fecha de instalación','fecha_instalacion','date',dateField(x.fecha_instalacion)),
 field('Garantía','garantia_hasta','date',dateField(x.garantia_hasta)),
 textarea('Información técnica','descripcion',x.descripcion));
 modal('Editar '+x.codigo,fields,b=>patch('/equipos/'+id,valueNum(b)),'Guardar cambios');
};
OS.actions.newPreventive=async()=>{
 requireManager();const [eq,users]=await Promise.all([listEquip(),people()]);
 if(!eq.length)throw Error('Primero registrá un equipo para asociarle un plan preventivo');
 const fields=grid(select('Equipo / instalación *','equipo_id',eq.map(x=>[x.id,x.codigo+' · '+x.nombre])),
 field('Tarea programada *','titulo','text','','required minlength="3"'),
 field('Frecuencia cada (días) *','frecuencia_dias','number','30','required min="1" max="3650"'),
 field('Próxima ejecución *','proxima_fecha','date',validDate(),'required'),
 select('Responsable','responsable_id',opts(users,'Sin asignar')),
 textarea('Instrucciones y puntos a revisar','instrucciones'));
 modal('Programar mantenimiento preventivo',fields,b=>post('/preventivos',valueNum(b)),'Crear plan');
};
OS.actions.editPreventive=async(id)=>{
 requireManager();const p=arr(S.data.preventivos).find(x=>String(x.id)===String(id));
 if(!p)throw Error('No se encontró el plan');
 const users=await people();
 const fields=grid(field('Tarea *','titulo','text',p.titulo,'required minlength="3"'),
 field('Frecuencia (días)','frecuencia_dias','number',p.frecuencia_dias,'required min="1"'),
 field('Próxima fecha','proxima_fecha','date',dateField(p.proxima_fecha),'required'),
 select('Responsable','responsable_id',opts(users,'Sin asignar'),p.responsable_id||''),
 select('Plan activo','activo',[['true','Sí, activo'],['false','No, pausar']],String(p.activo)),
 textarea('Instrucciones','instrucciones',p.instrucciones));
 modal('Editar plan preventivo',fields,b=>patch('/preventivos/'+id,{...valueNum(b),activo:b.activo==='true'}),'Actualizar plan');
};
OS.actions.finishPreventive=async(id)=>{
 const p=arr(S.data.preventivos).find(x=>String(x.id)===String(id));if(!p)throw Error('Plan inexistente');
 const fields='<p class="muted small">Se generará un parte de trabajo y se reprogramará automáticamente la próxima ejecución.</p>'+
 grid(field('Tarea realizada','titulo','text',p.titulo,'required minlength="3"'),
 field('Duración total (minutos)','duracion_min','number','30','min="0" required'),
 textarea('Descripción de la intervención','descripcion',p.instrucciones||''),
 textarea('Resultado / observaciones','resultado'));
 modal('Completar preventivo',fields,b=>post('/preventivos/'+id+'/completar',b),'Completar y reprogramar');
};
OS.actions.newWorkFor=async(id)=>{OS.close();return OS.actions.newWork(id)};
OS.actions.newWork=async(preset='')=>{
 const [equipos,alerts]=await Promise.all([listEquip(),get('/alertas')]);
 const fields=grid(field('Trabajo realizado *','titulo','text','','required minlength="3"'),
 select('Tipo de trabajo','tipo',typesWork,'correctivo'),
 select('Equipo vinculado','equipo_id',equipOpts(equipos),preset),
 select('Alerta vinculada','alerta_id',alertOpts(arr(alerts))),
 select('Estado','estado',['realizado','en_curso','pendiente'],'realizado'),
 field('Tiempo empleado (min)','duracion_min','number','30','min="0" max="14400"'),
 textarea('Descripción de las tareas ejecutadas','descripcion'),
 textarea('Resultado, mediciones y pendientes','resultado'));
 modal('Registrar parte de trabajo',fields,b=>post('/trabajos',valueNum(b)),'Guardar intervención');
};
OS.actions.workDetail=async(id)=>{
 const x=arr(S.data.trabajos).find(w=>String(w.id)===String(id));
 if(!x)throw Error('Trabajo no encontrado');
 const fields='<div class="detail-grid">'+[
 ['Intervención',x.titulo],['Técnico',x.tecnico],['Fecha',fdate(x.fecha,true)],
 ['Tipo',status(x.tipo)],['Estado',status(x.estado)],['Duración',number(x.duracion_min)+' minutos'],
 ['Equipo',x.equipo||'—'],['Alerta vinculada',x.alerta_codigo||'—']
 ].map(details).join('')+'</div><div class="overline" style="margin:12px 0">TRABAJO REALIZADO</div>'+
 '<div class="detail-desc">'+escape(x.descripcion)+'</div><div class="overline" style="margin:20px 0 10px">RESULTADO</div><div class="detail-desc">'+escape(x.resultado)+'</div>'+
 ((Number(x.tecnico_id)===S.user.id||isManager())?'<div class="row-actions" style="margin-top:20px"><button class="btn btn-primary" data-action="editWork" data-id="'+id+'">Editar parte</button></div>':'');
 modal('Parte de trabajo #'+id,fields,null);
};
OS.actions.editWork=async(id)=>{
 const x=arr(S.data.trabajos).find(w=>String(w.id)===String(id));if(!x)throw Error('Trabajo no encontrado');
 OS.close();
 const fields=grid(field('Título','titulo','text',x.titulo,'required minlength="3"'),
 select('Tipo','tipo',typesWork,x.tipo),
 select('Estado','estado',['pendiente','en_curso','realizado'],x.estado),
 field('Duración (min)','duracion_min','number',x.duracion_min,'min="0"'),
 textarea('Descripción','descripcion',x.descripcion),
 textarea('Resultado','resultado',x.resultado));
 modal('Editar parte #'+id,fields,b=>patch('/trabajos/'+id,b),'Guardar cambios');
};
OS.actions.newStock=async()=>{
 requireManager();
 const fields=grid(field('Repuesto / material *','nombre','text','','required minlength="3"'),
 field('SKU / código','sku'),field('Categoría','categoria','text','Repuestos'),
 field('Unidad','unidad','text','unidad'),field('Cantidad inicial','cantidad_inicial','number','0','required min="0" step="0.01"'),
 field('Punto mínimo','minimo','number','1','required min="0" step="0.01"'),field('Ubicación en depósito','ubicacion'),
 field('Proveedor','proveedor'),textarea('Observaciones','observaciones'));
 modal('Registrar repuesto en almacén',fields,b=>post('/stock',b),'Guardar artículo');
};
OS.actions.editStock=async(id)=>{
 requireManager();const x=arr(S.data.stock).find(w=>String(w.id)===String(id));if(!x)throw Error('Repuesto inexistente');
 const fields=grid(field('Nombre','nombre','text',x.nombre,'required minlength="3"'),
 field('SKU','sku','text',x.sku||''),field('Categoría','categoria','text',x.categoria),
 field('Unidad','unidad','text',x.unidad),field('Punto mínimo','minimo','number',x.minimo,'required min="0" step="0.01"'),
 field('Ubicación','ubicacion','text',x.ubicacion),field('Proveedor','proveedor','text',x.proveedor),
 textarea('Observaciones','observaciones',x.observaciones));
 modal('Editar '+x.nombre,fields,b=>patch('/stock/'+id,b),'Actualizar artículo');
};
OS.actions.stockMove=async(id)=>{
 const x=arr(S.data.stock).find(w=>String(w.id)===String(id));if(!x)throw Error('Repuesto no encontrado');
 const [equipos,trabajos]=await Promise.all([listEquip(),get('/trabajos')]);
 const fields='<p class="muted small">Existencia actual: <strong>'+number(x.cantidad)+' '+E(x.unidad)+'</strong>. Cada movimiento queda registrado con usuario y fecha.</p>'+
 grid(select('Movimiento *','tipo',[['entrada','Ingreso / compra'],['salida','Consumo / salida'],['ajuste_positivo','Corrección positiva'],['ajuste_negativo','Corrección negativa']],'salida'),
 field('Cantidad * ('+x.unidad+')','cantidad','number','1','required min="0.01" step="0.01"'),
 select('Equipo vinculado','equipo_id',equipOpts(equipos)),
 select('Trabajo vinculado','trabajo_id',opts(arr(trabajos),'Sin parte asociado','titulo')),
 textarea('Motivo / comprobante','motivo'));
 modal('Movimiento de stock · '+x.nombre,fields,b=>post('/stock/movimientos',{...valueNum(b),repuesto_id:id}),'Registrar movimiento');
};
OS.actions.stockHistory=async()=>{
 const records=await get('/stock/movimientos');
 const html=records.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Fecha</th><th>Repuesto</th><th>Movimiento</th><th>Saldo</th><th>Registrado por</th></tr></thead><tbody>'+
 records.map(x=>'<tr><td>'+E(fdate(x.created_at,true))+'</td><td><strong>'+E(x.repuesto)+'</strong></td><td>'+E(status(x.tipo))+' · '+number(x.cantidad)+'</td><td>'+number(x.saldo)+'</td><td>'+E(x.usuario)+'</td></tr>').join('')+'</tbody></table></div>':
 '<p class="muted">Todavía no se realizaron movimientos.</p>';
 modal('Kardex · Movimientos de inventario',html,null);
};
OS.actions.newTool=async()=>{
 requireManager();
 const fields=grid(field('Nombre de herramienta *','nombre','text','','required minlength="3"'),
 field('Familia / categoría','categoria','text','Herramientas generales'),field('Marca','marca'),
 field('Modelo','modelo'),field('Número de serie','serie'),
 select('Condición','condicion',['excelente','buena','regular','deficiente'],'buena'),
 select('Situación','estado',['disponible','mantenimiento','baja'],'disponible'),
 field('Ubicación de guarda','ubicacion'),textarea('Identificación y observaciones','observaciones'));
 modal('Registrar herramienta',fields,b=>post('/herramientas',b),'Guardar herramienta');
};
OS.actions.editTool=async(id)=>{
 requireManager();const x=arr(S.data.herramientas).find(w=>String(w.id)===String(id));if(!x)throw Error('Herramienta no encontrada');
 const states=x.estado==='prestada'?[['','Primero registrar devolución']]:['disponible','mantenimiento','baja'];
 const fields=grid(field('Nombre','nombre','text',x.nombre,'required minlength="3"'),
 field('Categoría','categoria','text',x.categoria),field('Marca','marca','text',x.marca),
 field('Modelo','modelo','text',x.modelo),field('Serie','serie','text',x.serie),
 select('Condición','condicion',['excelente','buena','regular','deficiente'],x.condicion),
 (x.estado==='prestada'?'<div class="field"><label>Estado</label><input value="Prestada · registrar devolución para modificar" disabled></div>':select('Estado','estado',states,x.estado)),
 field('Ubicación','ubicacion','text',x.ubicacion),
 textarea('Observaciones','observaciones',x.observaciones));
 modal('Editar '+x.codigo,fields,b=>patch('/herramientas/'+id,b),'Guardar cambios');
};
OS.actions.loanTool=async(id)=>{
 const x=arr(S.data.herramientas).find(w=>String(w.id)===String(id));if(!x)throw Error('Herramienta no encontrada');
 let f;
 if(isManager()){const ppl=await people();const pool=[{id:S.user.id,nombre:S.user.nombre},...ppl.filter(p=>Number(p.id)!==S.user.id)];f=select('Entregar a técnico','tecnico_id',pool.map(p=>[p.id,p.nombre]),S.user.id);}
 else f='<p class="muted small">La herramienta quedará registrada bajo tu responsabilidad.</p>';
 modal('Entregar · '+x.nombre,grid(f,textarea('Observaciones de entrega','observaciones')),(b)=>post('/herramientas/'+id+'/prestar',b),'Confirmar entrega');
};
OS.actions.returnTool=async(id)=>{
 const x=arr(S.data.herramientas).find(w=>String(w.id)===String(id));if(!x)throw Error('Herramienta no encontrada');
 modal('Devolver · '+x.nombre,'<p class="muted small">Responsable actual: <strong>'+E(x.prestado_a||'—')+'</strong></p>'+
 grid(select('Condición de devolución','requiere_revision',[['false','Devuelta en condiciones'],['true','Requiere revisión / reparación']],'false')),
 b=>post('/herramientas/'+id+'/devolver',{requiere_revision:b.requiere_revision==='true'}),'Confirmar devolución');
};
OS.actions.loanHistory=async()=>{
 const rs=await get('/herramientas/prestamos');
 const html=rs.length?'<div class="table-wrap"><table class="data-table"><thead><tr><th>Herramienta</th><th>Técnico</th><th>Entrega</th><th>Devolución</th></tr></thead><tbody>'+
 rs.map(x=>'<tr><td>'+E(x.codigo)+'<span class="cell-sub">'+E(x.herramienta)+'</span></td><td>'+E(x.tecnico)+'</td><td>'+E(fdate(x.prestado_at,true))+'</td><td>'+E(fdate(x.devuelto_at,true))+'</td></tr>').join('')+'</tbody></table></div>': '<p class="muted">No hay préstamos registrados.</p>';
 modal('Historial de custodia de herramientas',html,null);
};
OS.actions.newAlert=async()=>{
 const catalog=await cat();
 const fields=grid(field('Título del problema *','titulo','text','','required minlength="3"'),
 select('Prioridad','prioridad',['urgente','alta','media','baja'],'media'),
 select('Sector / habitación *','ubicacion_id',arr(catalog.ubicaciones).map(x=>[x.id,x.nombre])),
 select('Categoría','categoria_id',opts(catalog.categorias,'Sin categoría')),
 textarea('Describí el problema','descripcion'));
 modal('Reportar incidencia',fields,b=>post('/alertas',b),'Crear alerta');
};
OS.actions.alertTake=async(id)=>{await patch('/alertas/'+id+'/tomar',{});toast('Alerta tomada correctamente');await OS.navigate('alertas');};
OS.actions.alertDetail=async(id)=>{
 const a=arr(S.data.alertas).find(x=>String(x.id)===String(id));if(!a)throw Error('Alerta no encontrada');
 const detailsHtml='<div class="detail-grid">'+[
 ['Código',a.codigo],['Estado',status(a.estado)],['Prioridad',status(a.prioridad)],['Ubicación',a.ubicacion],
 ['Reportó',a.reportado_nombre],['Responsable',a.asignado_nombre],['Fecha de creación',fdate(a.created_at,true)]
 ].map(details).join('')+'</div><div class="detail-desc">'+escape(a.descripcion)+'</div><div class="row-actions" style="margin-top:24px">'+
 (isMaint()&&a.estado==='nueva'?'<button class="btn btn-primary" data-action="alertTake" data-id="'+id+'">Tomar alerta</button>':'')+
 (isMaint()&&['nueva','asignada'].includes(a.estado)?'<button class="btn btn-primary" data-action="alertStart" data-id="'+id+'">Iniciar trabajo</button>':'')+
 (isMaint()&&['en_proceso','asignada'].includes(a.estado)?'<button class="btn btn-primary" data-action="alertResolve" data-id="'+id+'">Marcar resuelta</button>':'')+
 (isManager()&&a.estado==='resuelta'?'<button class="btn btn-primary" data-action="alertClose" data-id="'+id+'">Cerrar y verificar</button>':'')+
 (isMaint()&&['resuelta','cerrada'].includes(a.estado)?'<button class="btn btn-soft" data-action="alertReopen" data-id="'+id+'">Reabrir</button>':'')+
 (isMaint()?'<button class="btn btn-soft" data-action="newWorkForAlert" data-id="'+id+'">Registrar intervención</button>':'')+'</div>';
 modal(a.codigo+' · '+a.titulo,detailsHtml,null);
};
const alterAlert=(name,state)=>OS.actions[name]=async(id)=>{
 OS.close();
 modal('Cambiar estado · '+status(state),grid(textarea('Nota de seguimiento','nota')),
 async b=>patch('/alertas/'+id+'/estado',{estado:state,nota:b.nota}),'Confirmar '+status(state).toLowerCase());
};
alterAlert('alertStart','en_proceso');alterAlert('alertClose','cerrada');alterAlert('alertReject','rechazar');alterAlert('alertReopen','reabrir');
OS.actions.alertResolve=async(id)=>{
 OS.close();
 modal('Enviar a verificación',grid(
  textarea('Trabajo realizado y resultado *','nota'),
  '<div class="field span2"><label>Fotografía de evidencia *</label><input type="file" name="archivo_foto" accept="image/*" capture="environment" required></div>'
 ),async(b,form)=>{
  const file=form.querySelector('input[name="archivo_foto"]')?.files?.[0];
  if(!file||!file.type.startsWith('image/'))throw Error('Adjuntá una fotografía de evidencia');
  if(file.size>2500000)throw Error('La fotografía supera 2,5 MB');
  const foto=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(Error('No se pudo leer la fotografía'));r.readAsDataURL(file);});
  return patch('/alertas/'+id+'/estado',{estado:'resuelta',nota:b.nota,foto});
 },'Enviar a supervisión');
};
OS.actions.newWorkForAlert=async(id)=>{
 OS.close();await OS.actions.newWork();
 const form=document.getElementById('dialog-form');if(form?.elements.alerta_id)form.elements.alerta_id.value=id;
};
})(window.OS);
