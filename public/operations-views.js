'use strict';
(function(OS){
const {S,I,E,fdate,dateField,number,status,badge,api,isManager,isMaint,pageHead,btn,empty,table}=OS;
const el=()=>document.getElementById('screen');
const types={climatizacion:'Climatización',bombas:'Bombas y presurización',calderas:'Calderas y vapor',agua:'Agua y sanitarios',electricidad:'Electricidad',grupo_electrogeno:'Grupos electrógenos',ascensores:'Ascensores',incendio:'Protección contra incendios',piscina:'Piscina',spa:'Spa y wellness',cocina:'Cocinas',lavanderia:'Lavandería',habitaciones:'Habitaciones',refrigeracion:'Refrigeración',seguridad:'Seguridad',infraestructura:'Infraestructura',otros:'Otros'};
const T=k=>types[k]||status(k);
const search=(hint)=>'<div class="searchbox">'+I('search')+'<input data-search type="search" placeholder="'+E(hint)+'" aria-label="Buscar"></div>';
const filter=(values,hint)=>'<select class="filter" data-filter aria-label="Filtrar"><option value="">'+E(hint)+'</option>'+values.map(k=>'<option value="'+E(k)+'">'+E(status(k))+'</option>').join('')+'</select>';
const toolbar=(label,filterMarkup='')=>'<div class="toolbar">'+search(label)+'<div class="filters">'+filterMarkup+'</div></div>';
function filtered(list,keys,field='estado'){
 return (list||[]).filter(x=>(!S.filter||String(x[field])===S.filter)&&(!S.q||keys.some(k=>String(x[k]??'').toLowerCase().includes(S.q))));
}
function showResults(markup){const target=document.getElementById('results');if(target)target.innerHTML=markup;}
const action=(text,name,id,sty='btn-soft')=>'<button class="btn btn-sm '+sty+'" data-action="'+name+'" data-id="'+E(id)+'">'+E(text)+'</button>';
const muted=(text)=>'<span class="cell-sub">'+E(text||'—')+'</span>';
const summary=(kpi,title,value,description,ico,cls='')=>'<div class="metric"><div class="metric-head"><span>'+E(title)+'</span><span class="metric-icon '+cls+'">'+I(ico)+'</span></div><strong>'+number(value)+'</strong><small>'+E(description)+'</small></div>';
const upcoming=(records,kind)=>records?.length?records.map(x=>'<div class="alert-line"><div class="iconbox">'+I(kind==='p'?'calendar':'box')+'</div><div><strong>'+E(kind==='p'?x.titulo:x.nombre)+'</strong><small>'+E(kind==='p'?x.equipo:x.unidad)+'</small></div><div class="right">'+E(kind==='p'?fdate(x.proxima_fecha):number(x.cantidad)+' / '+number(x.minimo))+'</div></div>').join(''):empty(kind==='p'?'Agenda al día':'Sin mínimos comprometidos',kind==='p'?'No hay mantenimientos pendientes en los próximos 14 días.':'No hay repuestos por debajo del mínimo.',kind==='p'?'calendar':'check');
function renderHome(d){
 const total=Number(d.equipos?.total||0),off=Number(d.equipos?.fuera||0),health=total?Math.max(0,Math.round((total-off)/total*100)):100;
 const recent=d.ultimos_trabajos||[];
 const chart=d.tendencia||[];
 const today=new Date();
 const days=Array.from({length:7},(_,i)=>{const n=new Date(today);n.setDate(n.getDate()-(6-i));const key=n.toLocaleDateString('sv-SE',{timeZone:'America/Argentina/Cordoba'});return {label:n.toLocaleDateString('es-AR',{weekday:'short'}).replace('.',''),value:Number(chart.find(x=>dateField(x.dia)===key)?.cantidad||0)}});
 const max=Math.max(1,...days.map(x=>x.value));
 el().innerHTML=pageHead('Centro de control','Una visión completa de la operación técnica del hotel.',btn('+ Registrar trabajo','newWork','','btn-primary'))+
 '<div class="hero"><div><div class="overline" style="color:#9fd2b8">PANORAMA GENERAL · MANTENIMIENTO</div><h2>Todo el hotel,<br>bajo control.</h2><p>Gestioná equipos, prevení fallas y documentá cada intervención desde un solo lugar.</p></div><div class="hero-right"><div class="hero-meter" style="--percent:'+health+'%"><div><strong>'+health+'%</strong><span>Disponibilidad</span></div></div></div></div>'+
 '<div class="metric-grid">'+summary('equipos','Equipos registrados',total,off+' fuera de servicio','building')+
 summary('preventivos','Preventivos vencidos',d.preventivos?.vencidos||0,(d.preventivos?.semana||0)+' próximos en 7 días','calendar','warn')+
 summary('stock','Stock bajo mínimo',d.stock?.bajos||0,'Repuestos que requieren atención','box','red')+
 summary('trabajos','Trabajos esta semana',d.trabajos?.semana||0,(d.trabajos?.hoy||0)+' registrados hoy','clipboard')+'</div>'+
 '<div class="two-col"><section class="panel"><div class="panel-head"><div><h3>Actividad reciente</h3><p>Últimas intervenciones del equipo técnico</p></div><button class="btn-text" data-nav="trabajos">Ver historial '+I('arrow')+'</button></div><div class="panel-body">'+(recent.length?recent.map(x=>'<div class="activity"><div class="activity-symbol">'+I('wrench')+'</div><div class="activity-main"><strong>'+E(x.titulo)+'</strong><small>'+E(x.tecnico)+(x.equipo?' · '+E(x.equipo):'')+' · '+E(status(x.tipo))+'</small></div><time>'+E(fdate(x.fecha,true))+'</time></div>').join(''):empty('Sin intervenciones todavía','Los técnicos pueden registrar trabajos desde el celular.','clipboard'))+'</div></section>'+
 '<section class="panel"><div class="panel-head"><div><h3>Próximos preventivos</h3><p>Prioridades de los próximos 14 días</p></div><button class="btn-text" data-nav="preventivos">Ver agenda '+I('arrow')+'</button></div><div class="panel-body">'+upcoming(d.proximos_preventivos,'p')+'</div></section></div>'+
 '<div class="two-col" style="margin-top:18px"><section class="panel"><div class="panel-head"><div><h3>Productividad técnica</h3><p>Intervenciones registradas · últimos 7 días</p></div><span class="badge gray">'+number(d.trabajos?.total)+' acumuladas</span></div><div class="panel-body"><div class="bar-chart">'+days.map(x=>'<div class="chart-day"><div class="chart-track"><div class="chart-bar" style="height:'+Math.max(4,Math.round(x.value/max*88))+'px" title="'+number(x.value)+' trabajos"></div></div><small>'+E(x.label)+'</small></div>').join('')+'</div></div></section><section class="panel"><div class="panel-head"><div><h3>Repuestos para reponer</h3><p>Control del punto de pedido</p></div><button class="btn-text" data-nav="stock">Ver almacén '+I('arrow')+'</button></div><div class="panel-body">'+upcoming(d.stock_critico,'s')+'</div></section></div>'+
 '<div style="margin-top:18px" class="panel"><div class="panel-head"><div><h3>Alertas e incidencias</h3><p>Reportes de recepción y mantenimiento</p></div><span class="badge '+(d.alertas.urgentes?'red':'green')+'">'+number(d.alertas.abiertas)+' abiertas · '+number(d.alertas.urgentes)+' urgentes</span></div><div class="panel-body" style="display:flex;gap:10px;flex-wrap:wrap">'+btn('Ver alertas','gotoAlertas','','btn-soft')+btn('Registrar equipo','newEquipment','','btn-soft')+btn('Crear preventivo','newPreventive','','btn-soft')+'</div></div>';
}
function results(){
 const data=S.data[S.page]||[];
 if(S.page==='equipos'){
  const rows=filtered(data,['nombre','codigo','marca','modelo','serie','sector','tipo']).map(x=>
   '<article class="asset-card"><div class="asset-top"><div class="asset-glyph">'+I(x.tipo==='bombas'?'drop':x.tipo==='electricidad'?'bolt':'building')+'</div>'+badge(x.estado)+'</div><span class="mono">'+E(x.codigo)+'</span><div class="asset-name">'+E(x.nombre)+'</div><div class="sub">'+E(T(x.tipo))+' · '+E(x.sector||x.ubicacion||'Sin sector asignado')+'</div><div class="asset-footer"><span>Criticidad: '+E(status(x.criticidad))+'</span><button class="btn-text" data-action="equipmentDetail" data-id="'+x.id+'">Ficha técnica '+I('arrow')+'</button></div></article>').join('');
  return rows?'<div class="cards-grid">'+rows+'</div>':empty('Sin equipos registrados','Cargá los equipos reales del hotel para construir su historial y sus preventivos.','building',isManager()?btn('Agregar equipo','newEquipment'):'');
 }
 if(S.page==='trabajos'){
  const rows=filtered(data,['titulo','descripcion','equipo','tecnico','tipo']).map(x=>'<tr><td><span class="mono">#'+x.id+'</span><span class="cell-title">'+E(x.titulo)+'</span>'+muted(x.equipo||'Intervención general')+'</td><td>'+badge(x.tipo)+'</td><td>'+E(x.tecnico)+'</td><td>'+E(fdate(x.fecha,true))+'</td><td>'+number(x.duracion_min)+' min</td><td>'+badge(x.estado)+'</td><td>'+action('Ver','workDetail',x.id)+'</td></tr>');
  return rows.length?table(['Trabajo','Tipo','Técnico','Fecha','Duración','Estado',''],rows):empty('Todavía no hay partes de trabajo','Cada técnico puede dejar registrado lo que hizo, cuándo y en qué equipo.','clipboard',btn('Registrar trabajo','newWork'));
 }
 if(S.page==='preventivos'){
  const today=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Argentina/Cordoba'});
  const rows=(data||[]).filter(x=>!S.filter || (S.filter==='activo' ? x.activo:!x.activo)).filter(x=>!S.q||[x.titulo,x.equipo,x.equipo_codigo].some(y=>String(y||'').toLowerCase().includes(S.q)))
   .map(x=>'<tr><td><span class="cell-title">'+E(x.titulo)+'</span>'+muted(x.instrucciones?.slice(0,85))+'</td><td><span class="cell-title">'+E(x.equipo)+'</span><span class="mono">'+E(x.equipo_codigo)+'</span></td><td>'+number(x.frecuencia_dias)+' días</td><td><span class="cell-title '+(x.activo&&dateField(x.proxima_fecha)<today?'red-text':'')+'">'+E(fdate(x.proxima_fecha))+'</span>'+ (x.activo&&dateField(x.proxima_fecha)<today?'<span class="badge red">Vencido</span>':'')+'</td><td>'+ (x.activo?badge('operativo'):badge('baja'))+'</td><td><div class="row-actions">'+(x.activo?action('Completar','finishPreventive',x.id,'btn-primary'):'')+(isManager()?action('Editar','editPreventive',x.id):'')+'</div></td></tr>');
  return rows.length?table(['Tarea','Equipo','Periodicidad','Próxima fecha','Plan',''],rows):empty('Sin planes de mantenimiento','Programá las revisiones periódicas de equipos e instalaciones.','calendar',isManager()?btn('Crear preventivo','newPreventive'):'');
 }
 if(S.page==='stock'){
  const rows=filtered(data,['nombre','sku','categoria','ubicacion'],'nivel').filter(x=>!S.filter||(S.filter==='bajo'?Number(x.cantidad)<=Number(x.minimo):Number(x.cantidad)>Number(x.minimo))).map(x=>'<tr><td><span class="cell-title">'+E(x.nombre)+'</span><span class="mono">'+E(x.sku||'SIN SKU')+'</span></td><td>'+E(x.categoria)+'</td><td><strong class="'+(Number(x.cantidad)<=Number(x.minimo)?'red-text':'')+'">'+number(x.cantidad)+' '+E(x.unidad)+'</strong></td><td>'+number(x.minimo)+'</td><td>'+E(x.ubicacion||'—')+'</td><td>'+(Number(x.cantidad)<=Number(x.minimo)?'<span class="badge red">Reponer</span>':'<span class="badge green">Disponible</span>')+'</td><td><div class="row-actions">'+action('Movimiento','stockMove',x.id,'btn-primary')+(isManager()?action('Editar','editStock',x.id):'')+'</div></td></tr>');
  return rows.length?table(['Repuesto','Categoría','Existencia','Mínimo','Ubicación','Control',''],rows):empty('Inventario vacío','Registrá repuestos, consumibles y materiales con sus existencias y mínimos.','box',isManager()?btn('Agregar repuesto','newStock'):'');
 }
 if(S.page==='herramientas'){
  const rows=filtered(data,['nombre','codigo','categoria','marca','modelo','serie','prestado_a']).map(x=>'<tr><td><span class="cell-title">'+E(x.nombre)+'</span><span class="mono">'+E(x.codigo)+'</span></td><td>'+E(x.categoria)+'</td><td>'+badge(x.condicion)+'</td><td>'+badge(x.estado)+'</td><td>'+E(x.prestado_a||x.ubicacion||'—')+'</td><td><div class="row-actions">'+(x.estado==='disponible'?action('Entregar','loanTool',x.id,'btn-primary'):'')+(x.estado==='prestada'?action('Devolver','returnTool',x.id,'btn-primary'):'')+(isManager()?action('Editar','editTool',x.id):'')+'</div></td></tr>');
  return rows.length?table(['Herramienta','Categoría','Condición','Estado','Responsable / Lugar',''],rows):empty('Sin herramientas cargadas','Controlá cada herramienta y a qué técnico se le entregó.','tool',isManager()?btn('Registrar herramienta','newTool'):'');
 }
 if(S.page==='alertas'){
  const rows=filtered(data,['titulo','descripcion','codigo','ubicacion','asignado_nombre','reportado_nombre']).map(x=>'<tr><td><span class="mono">'+E(x.codigo)+'</span><span class="cell-title">'+E(x.titulo)+'</span>'+muted(x.descripcion?.slice(0,70))+'</td><td>'+E(x.ubicacion||'—')+'</td><td>'+badge(x.prioridad)+'</td><td>'+badge(x.estado)+'</td><td>'+E(x.asignado_nombre||'Sin asignar')+'</td><td>'+E(fdate(x.created_at,true))+'</td><td><div class="row-actions">'+action('Ver','alertDetail',x.id)+(isMaint()&&x.estado==='nueva'?action('Tomar','alertTake',x.id,'btn-primary'):'')+'</div></td></tr>');
  return rows.length?table(['Alerta','Ubicación','Prioridad','Estado','Asignado','Reportada',''],rows):empty('Sin alertas','Recepción y mantenimiento pueden reportar incidentes desde el celular.','bell',btn('Crear alerta','newAlert'));
 }
 return empty('Sin registros','Todavía no hay información.','info');
}
function renderList(page,records){
 S.data[page]=records;
 const config={
 equipos:['Inventario técnico','Equipos, instalaciones y activos críticos del hotel.','Registrar equipo','newEquipment','Buscá por equipo, código, sector o número de serie…',null],
 trabajos:['Partes de trabajo','Historial de intervenciones realizadas por mantenimiento.','Registrar trabajo','newWork','Buscá por tarea, técnico o equipo…',filter(['pendiente','en_curso','realizado'],'Todos los estados')],
 preventivos:['Mantenimiento preventivo','Agenda de inspecciones, revisiones y servicios programados.','Nuevo plan','newPreventive','Buscá por tarea o equipo…','<select class="filter" data-filter><option value="">Todos los planes</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select>'],
 stock:['Stock de repuestos','Existencias, mínimos y movimientos vinculados a las intervenciones.','Agregar repuesto','newStock','Buscá por repuesto, SKU o categoría…','<select class="filter" data-filter><option value="">Todos los niveles</option><option value="bajo">Bajo mínimo</option><option value="normal">En rango</option></select>'],
 herramientas:['Herramientas y custodia','Inventario, condición y préstamos al personal.','Registrar herramienta','newTool','Buscá por herramienta, código o responsable…',filter(['disponible','prestada','mantenimiento','baja'],'Todos los estados')],
 alertas:['Alertas e incidencias','Reportes de recepción, habitaciones e instalaciones.','Nueva alerta','newAlert','Buscá por alerta, habitación o responsable…',filter(['nueva','asignada','en_proceso','resuelta','cerrada','cancelada'],'Todos los estados')]
 }[page];
 const managerOnly=['equipos','preventivos','stock','herramientas'].includes(page);
 const canCreate=!managerOnly||isManager();
 const extra=page==='stock'?btn('Ver movimientos','stockHistory','','btn-soft'):page==='herramientas'?btn('Préstamos','loanHistory','','btn-soft'):'';
 const main=pageHead(config[0],config[1],extra+(canCreate?btn('+ '+config[2],config[3]):''))+
 toolbar(config[4],config[5]||'')+'<div id="results"></div>';
 el().innerHTML=main;OS.filterView();
}
OS.filterView=()=>showResults(results());
OS.loadPage=async(page)=>{
 if(page==='inicio'){const d=await api('/centro');S.data.inicio=d;return renderHome(d);}
 const route={alertas:'/alertas',trabajos:'/trabajos',equipos:'/equipos',preventivos:'/preventivos',stock:'/stock',herramientas:'/herramientas'}[page];
 if(!route)throw Error('Sección no disponible');
 const records=await api(route);renderList(page,records);
};
OS.types=types;
OS.actions.gotoAlertas=()=>OS.navigate('alertas');
})(window.OS);
