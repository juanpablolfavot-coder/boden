'use strict';
(function(OS){
  const {S,E,I,api,modal,field,textarea,select,opts,pageHead,btn,empty,table,toast,fdate}=OS;
  const isAdmin=()=>S.user?.rol==='admin';
  const esc=x=>E(x??'');
  const grid=(...fields)=>'<div class="form-grid">'+fields.join('')+'</div>';
  const post=(url,body)=>api(url,{method:'POST',body:JSON.stringify(body)});
  const patch=(url,body)=>api(url,{method:'PATCH',body:JSON.stringify(body)});
  const del=url=>api(url,{method:'DELETE'});
  const badge=(enabled)=>'<span class="badge '+(enabled?'green':'gray')+'">'+(enabled?'Activo':'Inactivo')+'</span>';
  const action=(label,name,id,cls='btn-soft')=>'<button type="button" class="btn btn-sm '+cls+'" data-action="'+name+'" data-id="'+E(id)+'">'+E(label)+'</button>';
  const roles=[
    ['recepcion','Recepción'],['mucama','Habitaciones / housekeeping'],['personal','Personal general'],
    ['mantenimiento','Técnico de mantenimiento'],['jefe_mantenimiento','Jefatura de mantenimiento'],['admin','Administrador']
  ];
  const gridPanel=(title,subtitle,actions,content)=>'<section class="panel master-panel"><div class="panel-head"><div><h3>'+E(title)+'</h3><p>'+E(subtitle)+'</p></div><div class="row-actions">'+actions+'</div></div>'+content+'</section>';
  const dateText=(t)=>String(t||'').slice(0,5);
  const rowList=(name,desc,status,actions)=>{
    return '<div class="management-row"><div class="management-symbol">'+I('layers')+'</div><div class="management-info"><strong>'+E(name)+'</strong><span>'+E(desc)+'</span></div><div class="management-state">'+status+'</div><div class="management-actions">'+actions+'</div></div>';
  };
  const wait=(heading)=>{document.getElementById('screen').innerHTML=pageHead(heading,'Configuración centralizada de Böden.')+'<div class="panel">'+empty('Cargando configuración','Recuperando datos del hotel','refresh')+'</div>';};
  const wrapAction=async(fn)=>{if(!isAdmin())throw Error('Solo el administrador puede gestionar este módulo');return fn();};
  async function renderPeople(){
    const users=await api('/usuarios');S.data.personal=users;
    const active=users.filter(x=>x.activo).length,tech=users.filter(x=>['mantenimiento','jefe_mantenimiento'].includes(x.rol)&&x.activo).length;
    const rows=users.map(u=>'<tr><td><div class="person-cell"><div class="person-avatar">'+E(u.nombre.slice(0,1).toUpperCase())+'</div><div><span class="cell-title">'+E(u.nombre)+'</span><span class="cell-sub">'+E(u.email)+'</span></div></div></td><td>'+E(roles.find(x=>x[0]===u.rol)?.[1]||u.rol)+'</td><td>'+badge(u.activo)+'</td><td class="table-actions">'+action('Editar','editPerson',u.id)+action('Contraseña','passwordPerson',u.id)+'</td></tr>');
    document.getElementById('screen').innerHTML=pageHead('Personal y accesos','Una sola nómina para mantenimiento, recepción, housekeeping y administración.',btn('+ Incorporar usuario','newPerson'))+
    '<div class="management-stats"><div><span>Usuarios habilitados</span><strong>'+active+'</strong></div><div><span>Técnicos activos</span><strong>'+tech+'</strong></div><div><span>Roles de acceso</span><strong>6</strong></div></div>'+
    (rows.length?table(['Colaborador','Rol asignado','Acceso','Acciones'],rows):gridPanel('Personal','Aún no hay usuarios','',empty('Sin personal registrado','Agregá usuarios para asignar tareas.','users')));
  }
  OS.actions.newPerson=()=>wrapAction(async()=>{
    modal('Nuevo colaborador',grid(
      field('Nombre completo *','nombre','text','','required minlength="3"'),
      field('Correo de acceso *','email','email','','required'),
      select('Perfil de acceso','rol',roles,'mantenimiento'),
      field('Contraseña provisoria *','password','password','','required minlength="12"')
    ),b=>post('/usuarios',b),'Crear usuario');
  });
  OS.actions.editPerson=(id)=>wrapAction(async()=>{
    const u=(S.data.personal||[]).find(x=>String(x.id)===String(id));
    if(!u)throw Error('Usuario no encontrado');
    modal('Editar usuario · '+u.nombre,grid(field('Nombre completo','nombre','text',u.nombre,'required minlength="3"'),
      select('Perfil de acceso','rol',roles,u.rol),
      select('Permiso de ingreso','activo',[['true','Habilitado'],['false','Deshabilitado']],String(u.activo))
    ),b=>patch('/usuarios/'+id,{nombre:b.nombre,rol:b.rol,activo:b.activo==='true'}),'Guardar usuario');
  });
  OS.actions.passwordPerson=(id)=>wrapAction(async()=>{
    const u=(S.data.personal||[]).find(x=>String(x.id)===String(id));
    if(!u)throw Error('Usuario no encontrado');
    modal('Cambiar clave · '+u.nombre,grid(field('Contraseña nueva','password','password','','required minlength="12"')),
      b=>post('/usuarios/'+id+'/password',{password:b.password}),'Actualizar contraseña');
  });

  async function renderShifts(){
    const shifts=await api('/turnos'); S.data.turnos=shifts;
    const rows=shifts.map(t=>'<tr><td><span class="cell-title">'+E(t.nombre)+'</span><span class="cell-sub">'+E(t.usuarios?.length||0)+' asignados</span></td>'+
      '<td><span class="shift-time">'+E(dateText(t.hora_inicio))+' <span>→</span> '+E(dateText(t.hora_fin))+'</span></td><td>'+
      (t.usuarios?.map(u=>'<span class="chip">'+E(u.nombre)+'</span>').join(' ')||'<span class="muted">Sin personal</span>')+'</td><td>'+badge(t.activo)+'</td>'+
      '<td class="table-actions">'+action('Editar','editShift',t.id)+action('Eliminar','deleteShift',t.id,'btn-danger')+'</td></tr>');
    document.getElementById('screen').innerHTML=pageHead('Turnos y guardias','Definí coberturas, responsables y personal de cada turno.',btn('+ Crear turno','newShift'))+
    (rows.length?table(['Turno','Horario','Personal asignado','Estado','Acciones'],rows):gridPanel('Planificación de turnos','La operación requiere cobertura','',empty('No hay turnos','Creá el primer turno.','calendar')))+
    '<div class="inline-note">'+I('info')+' Los cambios quedan guardados inmediatamente en la agenda compartida. Máximo 3 personas por turno.</div>';
  }
  const shiftFields=(t,people)=>grid(
    field('Nombre del turno *','nombre','text',t.nombre||'','required minlength="2"'),
    field('Hora de inicio *','hora_inicio','time',dateText(t.hora_inicio)||'07:00','required'),
    field('Hora de cierre *','hora_fin','time',dateText(t.hora_fin)||'15:00','required'),
    select('Estado','activo',[['true','Activo'],['false','Suspendido']],String(t.activo??true)),
    '<div class="field span2"><label>Equipo asignado · hasta 3 personas</label><div class="check-grid">'+people.map(p=>'<label class="check-line"><input name="usuarios" type="checkbox" value="'+p.id+'" '+(t.usuarios?.some(u=>Number(u.id)===Number(p.id))?'checked':'')+'><span>'+E(p.nombre)+'</span></label>').join('')+'</div></div>');
  async function shiftForm(id){
    const shifts=S.data.turnos||[],t=id?shifts.find(x=>String(x.id)===String(id)):{activo:true,usuarios:[]};
    if(!t)throw Error('Turno no encontrado');
    const people=(await api('/usuarios')).filter(x=>x.activo && ['admin','jefe_mantenimiento','mantenimiento'].includes(x.rol));
    modal(id?'Editar turno · '+t.nombre:'Crear turno',shiftFields(t,people),async(b,form)=>{
      const list=[...form.querySelectorAll('input[name="usuarios"]:checked')].map(el=>Number(el.value));
      if(list.length>3)throw Error('Podés asignar hasta tres personas por turno');
      const data={nombre:b.nombre,hora_inicio:b.hora_inicio,hora_fin:b.hora_fin,activo:b.activo==='true',usuarios:list};
      return id?patch('/turnos/'+id,data):post('/turnos',data);
    },id?'Actualizar turno':'Crear turno');
  }
  OS.actions.newShift=()=>wrapAction(()=>shiftForm(null));
  OS.actions.editShift=id=>wrapAction(()=>shiftForm(id));
  OS.actions.deleteShift=id=>wrapAction(async()=>{
    const t=(S.data.turnos||[]).find(x=>String(x.id)===String(id));
    if(!t)throw Error('Turno no encontrado');
    modal('Eliminar turno', '<p>¿Querés eliminar el turno <strong>'+E(t.nombre)+'</strong> y sus asignaciones? Esta acción no se puede deshacer.</p>',
      ()=>del('/turnos/'+id),'Eliminar turno');
  });

  async function renderSpaces(){
    const d=await api('/catalogos/admin'); S.data.espacios=d;
    const ubic=d.ubicaciones||[],cat=d.categorias||[];
    const types={habitacion:'Habitación',area:'Área común',equipo:'Equipo / sector'};
    const locContent=ubic.length?ubic.map(u=>rowList(u.nombre,types[u.tipo]||u.tipo,badge(u.activo),action('Editar','editSpace',u.id))).join(''):
      empty('Sin ubicaciones','Agregá habitaciones, sectores o áreas del hotel.','map');
    const catContent=cat.length?cat.map(c=>rowList(c.nombre,'Categoría de incidencia',badge(c.activo),action('Editar','editCategory',c.id))).join(''):
      empty('Sin categorías','Clasificá incidencias para facilitar su seguimiento.','layers');
    document.getElementById('screen').innerHTML=pageHead('Espacios y categorías','Administrá habitaciones, sectores y tipos de incidencia desde un único lugar.')+
      '<div class="two-col management-columns">'+gridPanel('Ubicaciones','Habitaciones, instalaciones y áreas',btn('+ Ubicación','newSpace','','btn-soft'),'<div class="management-list">'+locContent+'</div>')+
      gridPanel('Categorías de incidencias','Clasificación de los reportes',btn('+ Categoría','newCategory','','btn-soft'),'<div class="management-list">'+catContent+'</div>')+'</div>';
  }
  const locTypes=[['habitacion','Habitación'],['area','Área común'],['equipo','Equipo / sector']];
  OS.actions.newSpace=()=>wrapAction(async()=>{
    modal('Nueva ubicación',grid(field('Nombre de ubicación','nombre','text','','required minlength="2"'),select('Tipo','tipo',locTypes,'area')),
      b=>post('/catalogos/ubicaciones',b),'Guardar ubicación');
  });
  OS.actions.editSpace=id=>wrapAction(async()=>{
    const u=(S.data.espacios?.ubicaciones||[]).find(x=>String(x.id)===String(id));if(!u)throw Error('Ubicación no encontrada');
    modal('Editar ubicación',grid(field('Nombre','nombre','text',u.nombre,'required minlength="2"'),select('Tipo','tipo',locTypes,u.tipo),
      select('Estado','activo',[['true','Habilitada'],['false','Deshabilitada']],String(u.activo))),
      b=>patch('/catalogos/ubicaciones/'+id,{...b,activo:b.activo==='true'}),'Guardar ubicación');
  });
  OS.actions.newCategory=()=>wrapAction(async()=>{
    modal('Nueva categoría de incidencia',grid(field('Nombre','nombre','text','','required minlength="2"')),
      b=>post('/catalogos/categorias',b),'Guardar categoría');
  });
  OS.actions.editCategory=id=>wrapAction(async()=>{
    const c=(S.data.espacios?.categorias||[]).find(x=>String(x.id)===String(id));if(!c)throw Error('Categoría no encontrada');
    modal('Editar categoría',grid(field('Nombre','nombre','text',c.nombre,'required minlength="2"'),
      select('Estado','activo',[['true','Habilitada'],['false','Deshabilitada']],String(c.activo))),
      b=>patch('/catalogos/categorias/'+id,{...b,activo:b.activo==='true'}),'Actualizar categoría');
  });
  const previousLoad=OS.loadPage;
  OS.loadPage=async(page)=>{
    if(['personal','turnos','espacios'].includes(page)){
      if(!isAdmin())throw Error('No tenés permiso para acceder a administración');
      return page==='personal'?renderPeople():page==='turnos'?renderShifts():renderSpaces();
    }
    return previousLoad(page);
  };
})(window.OS);
