'use strict';
(function(){
const S={token:localStorage.getItem('boden_token'),user:null,page:'inicio',data:{},q:'',filter:'',menu:false,cat:null,notifications:[]};
const icons={
 grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M10 21h4"/>',
 wrench:'<path d="M21 7a5 5 0 0 1-7 4.5L7 19a3 3 0 0 1-4-4l7.5-7A5 5 0 0 1 17 2l-3 3 5 5z"/>',
 box:'<path d="M21 8 12 3 3 8l9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
 layers:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h7M7 17h4"/>',
 tool:'<path d="M14 7a5 5 0 0 0-6 6L3 18a2 2 0 0 0 3 3l5-5a5 5 0 0 0 6-6l-3 3-3-3z"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 alert:'<path d="m12 3 10 18H2L12 3z"/><path d="M12 9v4m0 4h.01"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M10 2h4l1 3 2 1 3-1 2 4-2 2v2l2 2-2 4-3-1-2 1-1 3h-4l-1-3-2-1-3 1-2-4 2-2v-2L2 9l2-4 3 1 2-1z"/>',
 logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/>',
 menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>',
 drop:'<path d="M12 3c-3 5-7 9-7 12a7 7 0 0 0 14 0c0-3-4-7-7-12z"/>',
 bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
 activity:'<path d="M3 12h4l3-7 4 14 3-7h4"/>',
 users:'<circle cx="9" cy="8" r="4"/><path d="M2 21v-2a7 7 0 0 1 14 0v2m2-13a4 4 0 0 1 0 8m0 1a6 6 0 0 1 4 4"/>',
 map:'<path d="M3 6 9 3l6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15"/>',
 clipboard:'<rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2M9 11h6M9 15h5"/>',
 close:'<path d="m5 5 14 14M19 5 5 19"/>',
 sliders:'<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 10a7 7 0 0 1 12-4l3 6M4 12l3 6a7 7 0 0 0 12-4"/>',
 info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v6m0-10h.01"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 18v3h16v-3"/>',
 building:'<path d="M4 21V4l8-2v19M12 7h8v14M2 21h20M7 7h2M7 11h2M7 15h2M16 10h2M16 14h2"/>'
};
const I=(name)=>'<span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true">'+(icons[name]||icons.grid)+'</svg></span>';
const E=(x)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fdate=(x,time=false)=>{if(!x)return '—';try{
 // PostgreSQL DATE serializado a medianoche UTC no debe perder un día en Argentina.
 const onlyDate=!time&&/^\d{4}-\d{2}-\d{2}/.test(String(x));
 const value=onlyDate?new Date(String(x).slice(0,10)+'T12:00:00Z'):new Date(x);
 return value.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:time?undefined:'numeric',timeZone:'America/Argentina/Cordoba',...(time?{hour:'2-digit',minute:'2-digit'}:{})});
 }catch{return E(x)}};
const dateField=(x)=>x?String(x).slice(0,10):'';
const humanText=(x)=>String(x??'')
 .replace(/\b(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat) (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{2} \d{4} 00:00:00 GMT\+0000 \(Coordinated Universal Time\)/g,value=>{
   const date=new Date(value);return Number.isNaN(date.getTime())?value:date.toLocaleDateString('es-AR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});
 })
 .replace(/(período\s+)(\d{4}-\d{2}-\d{2})/gi,(_,prefix,value)=>prefix+fdate(value));
const number=x=>Number(x||0).toLocaleString('es-AR',{maximumFractionDigits:2});
const status=(v)=>{const labels={operativo:'Operativo',mantenimiento:'En mantenimiento',fuera_servicio:'Fuera de servicio',baja:'De baja',disponible:'Disponible',prestada:'Prestada',excelente:'Excelente',buena:'Buena',regular:'Regular',deficiente:'Deficiente',pendiente:'Pendiente',en_curso:'En curso',realizado:'Realizado',nueva:'Sin tomar',asignada:'Asignada',en_proceso:'En proceso',resuelta:'Resuelta',cerrada:'Cerrada',cancelada:'Cancelada',urgente:'Urgente',alta:'Alta',media:'Media',baja:'Baja',correctivo:'Correctivo',preventivo:'Preventivo',inspeccion:'Inspección',mejora:'Mejora',emergencia:'Emergencia'};return labels[v]||v||'—'};
const badge=(v)=>{let cls=['operativo','disponible','realizado','resuelta','cerrada','buena','excelente'].includes(v)?'green':['fuera_servicio','deficiente','urgente','emergencia'].includes(v)?'red':['alta','mantenimiento','regular','prestada','pendiente','nueva'].includes(v)?'gold':['en_curso','asignada'].includes(v)?'blue':'gray';return '<span class="badge '+cls+'">'+E(status(v))+'</span>'};
async function api(path,opt={}){
  const r=await fetch('/api'+path,{...opt,headers:{'Content-Type':'application/json',...(S.token?{Authorization:'Bearer '+S.token}:{}),...(opt.headers||{})}});
  const body=await r.json().catch(()=>({}));
  if(r.status===401 && path!='/auth/login'){logout();throw Error('Sesión vencida, ingresá nuevamente');}
  if(!r.ok)throw Error(body.error||'No se pudo completar la operación');
  return body;
}
let toastTimeout;
function toast(msg,error=false){
  const el=document.getElementById('toast');el.textContent=msg;el.className='toast visible'+(error?' error':'');
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.className='toast',4200);
}
async function refreshNotifications(){
 try{S.notifications=await api('/notificaciones');const n=S.notifications.filter(x=>!x.leida_at).length;const el=document.querySelector('.notice-count');if(el){el.textContent=n;el.hidden=!n;}}catch{}
}
const pushAvailable=()=>('serviceWorker' in navigator)&&('PushManager' in window)&&('Notification' in window);
const vapidBytes=(key)=>{const p='='.repeat((4-key.length%4)%4),raw=atob((key+p).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));};
async function enablePush(){
 if(!pushAvailable())throw Error('Este dispositivo no admite notificaciones push');
 const {publicKey}=await api('/push/vapid-public');
 if(!publicKey)throw Error('Las notificaciones push todavía no están disponibles');
 const permission=await Notification.requestPermission();
 if(permission!=='granted')throw Error('El dispositivo no autorizó las notificaciones');
 const registration=await navigator.serviceWorker.register('/sw.js');
 await navigator.serviceWorker.ready;
 let subscription=await registration.pushManager.getSubscription();
 if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:vapidBytes(publicKey)});
 await api('/push/subscribe',{method:'POST',body:JSON.stringify(subscription.toJSON())});
 localStorage.setItem('boden_push_enabled','1');
 return true;
}
const isManager=()=>['admin','jefe_mantenimiento'].includes(S.user?.rol);
const isMaint=()=>['admin','jefe_mantenimiento','mantenimiento'].includes(S.user?.rol);
const items=[
 {id:'inicio',text:'Supervisión',icon:'grid',group:'main'},
 {id:'alertas',text:'Incidencias y tareas',icon:'bell',group:'ops'},
 {id:'preventivos',text:'Preventivos',icon:'calendar',group:'ops'},
 {id:'equipos',text:'Equipos del hotel',icon:'building',group:'assets'},
 {id:'trabajos',text:'Historial técnico',icon:'clipboard',group:'assets'},
 {id:'personal',text:'Personas y roles',icon:'users',group:'admin',manager:true},
 {id:'espacios',text:'Sectores del hotel',icon:'map',group:'admin',admin:true}
];
const titles=Object.fromEntries(items.map(x=>[x.id,x.text]));
const groups=[
 {id:'main',label:'RESUMEN'},
 {id:'ops',label:'TRABAJO'},
 {id:'assets',label:'CONTROL'},
 {id:'admin',label:'CONFIGURACIÓN'}
];
const isAdmin=()=>S.user?.rol==='admin';
function shell(){
 const visible=items.filter(x=>x.admin?isAdmin():x.manager?isManager():isMaint()||x.id==='alertas');
 const sections=groups.map(g=>{
   const entries=visible.filter(x=>x.group===g.id);
   if(!entries.length)return '';
   return '<div class="nav-section">'+E(g.label)+'</div><nav class="nav" aria-label="'+E(g.label)+'">'+entries.map(x=>
     '<button type="button" class="nav-btn'+(S.page===x.id?' active':'')+'" data-nav="'+x.id+'">'+I(x.icon)+'<span>'+E(x.text)+'</span></button>'
   ).join('')+'</nav>';
 }).join('');
 const header='<header class="topbar">'+
  '<div class="header-start"><button class="menu-btn only-mobile" data-action="menu" aria-label="Abrir menú">'+I('menu')+'</button><div class="crumb"><span class="crumb-context">OPERACIONES DEL HOTEL</span><span class="crumb-sep">/</span><strong id="crumb">'+E(titles[S.page]||'BÖDEN')+'</strong></div></div>'+
  '<div class="top-actions"><button class="notice-btn" data-action="notifications" aria-label="Notificaciones">'+I('bell')+'<span class="notice-count" hidden></span></button><span class="date-chip">'+new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Argentina/Cordoba'})+'</span>'+
  '<span class="head-status"><span class="dot"></span> Sistema operativo</span></div></header>';
 const brand='<div class="brand"><div class="brand-mark"><img class="brand-logo" src="/brand/boden-logo.svg" alt="Böden Hotel & Spa · AKEN Soul"><div class="brand-sub">OPERACIONES</div></div></div>';
 const user='<div class="side-foot"><div class="site-pill"><span class="dot"></span><span>GESTIÓN INTERNA · BÖDEN</span></div>'+
  '<div class="user-chip"><div class="avatar">'+E((S.user.nombre||'U').charAt(0).toUpperCase())+'</div><div><strong>'+E(S.user.nombre)+'</strong><small>'+E(S.user.rol.replaceAll('_',' '))+'</small></div>'+
  '<button class="logout" data-action="logout" aria-label="Cerrar sesión" title="Cerrar sesión">'+I('logout')+'</button></div></div>';
 document.getElementById('app').innerHTML='<div class="layout" id="layout"><div class="mobile-dimmer" data-action="menu"></div>'+
 '<aside class="sidebar">'+brand+'<div class="sidebar-rule"></div>'+sections+user+'</aside><main class="main">'+header+
 '<div id="screen" class="content"></div></main></div>';
}
function login(){
 document.getElementById('app').innerHTML=
  '<div class="login-layout">'+
  '<section class="login-visual" aria-label="Böden Hotel & Spa">'+
  '<div class="brand"><div class="brand-mark"><img class="brand-logo" src="/brand/boden-logo.svg" alt="Böden Hotel & Spa · AKEN Soul"></div></div>'+
  '<div><div class="overline">EXCELENCIA EN CADA DETALLE</div><h1>La hospitalidad también se construye detrás de escena.</h1>'+
  '<p>Un espacio exclusivo para cuidar las instalaciones, coordinar al equipo y mantener cada experiencia a la altura de Böden.</p></div>'+
  '<footer>VILLA GENERAL BELGRANO · CÓRDOBA</footer>'+
  '<div class="photo-credit">FOTOGRAFÍA · BÖDEN HOTEL & SPA / AKEN SOUL</div>'+
  '</section>'+
  '<section class="login-side"><form id="login-form" class="login-form">'+
  '<div class="overline">ÁREA PRIVADA · OPERACIONES</div><h2>Bienvenido a Böden.</h2>'+
  '<p class="muted">Ingresá para continuar con la gestión de mantenimiento del hotel.</p>'+
  '<div class="field"><label for="login-email">Usuario</label><input id="login-email" type="text" name="email" autocomplete="username" placeholder="Tu correo de acceso" required></div>'+
  '<div class="field"><label for="login-password">Contraseña</label><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" required></div>'+
  '<button class="btn btn-primary" type="submit">Ingresar al sistema '+I('arrow')+'</button>'+
  '<p id="login-error" class="login-error" role="alert"></p>'+
  '<div class="login-foot">Acceso exclusivo para personal autorizado</div>'+
  '</form></section></div>';
}
async function init(){
 if(!S.token){login();return;}
 try{const result=await api('/auth/me');S.user=result.user; S.page=isMaint()?'inicio':'alertas';shell();await refreshNotifications();await navigate(S.page);}catch(e){S.token=null;localStorage.removeItem('boden_token');login();}
}
async function navigate(page){
 if(!isMaint()&&page!=='alertas')page='alertas';
 if(page==='personal'&&!isManager())page='inicio';
 if(!isAdmin()&&['turnos','espacios'].includes(page))page='inicio';
 if(!titles[page])page=isMaint()?'inicio':'alertas';
 S.page=page;S.q='';S.filter='';S.menu=false;
 const layout=document.getElementById('layout');if(layout)layout.classList.remove('menu-open');
 document.querySelectorAll('[data-nav]').forEach(n=>n.classList.toggle('active',n.dataset.nav===page));
 const crumb=document.getElementById('crumb');if(crumb)crumb.textContent=titles[page];
 const el=document.getElementById('screen');if(!el)return;
 el.innerHTML='<div class="empty"><div class="empty-ico">'+I('refresh')+'</div><strong>Cargando información…</strong></div>';
 try{await OS.loadPage(page);}catch(e){el.innerHTML='<div class="panel"><div class="empty"><div class="empty-ico">'+I('alert')+'</div><strong>No se pudo cargar</strong><p>'+E(e.message)+'</p><button class="btn btn-soft" data-action="retry">Reintentar</button></div></div>';toast(e.message,true);}
}
function logout(){S.token=null;S.user=null;S.data={};localStorage.removeItem('boden_token');localStorage.removeItem('boden_user');login();}
function modal(title,html,submit,label='Guardar'){
 const existing=document.querySelector('.dialog-backdrop');if(existing)existing.remove();
 const d=document.createElement('div');d.className='dialog-backdrop';
 d.innerHTML='<div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="dialog-head"><h2 id="dialog-title">'+E(title)+'</h2><button class="close" data-action="close" aria-label="Cerrar">×</button></div>'+
 '<form id="dialog-form"><div class="dialog-body">'+html+'</div><div class="dialog-foot"><button type="button" class="btn btn-soft" data-action="close">Cancelar</button>'+ (submit?'<button type="submit" class="btn btn-primary" id="save-btn">'+E(label)+'</button>':'')+'</div></form></div>';
 document.body.appendChild(d);
 d.addEventListener('click',e=>{if(e.target===d)d.remove()});
 if(submit)d.querySelector('form').addEventListener('submit',async(e)=>{e.preventDefault();const btn=d.querySelector('#save-btn');btn.disabled=true;try{const form=new FormData(e.currentTarget);await submit(Object.fromEntries(form.entries()),e.currentTarget);d.remove();toast('Operación guardada correctamente');await navigate(S.page);}catch(error){toast(error.message,true);btn.disabled=false;}});
 setTimeout(()=>d.querySelector('input,select,textarea')?.focus(),40);
}
function close(){document.querySelector('.dialog-backdrop')?.remove();}
const field=(label,name,type='text',value='',extra='',span2=false)=>'<div class="field'+(span2?' span2':'')+'"><label for="form-'+E(name)+'">'+E(label)+'</label><input id="form-'+E(name)+'" name="'+E(name)+'" type="'+E(type)+'" value="'+E(value)+'" '+extra+'></div>';
const textarea=(label,name,value='',span2=true)=>'<div class="field'+(span2?' span2':'')+'"><label>'+E(label)+'</label><textarea name="'+E(name)+'" rows="3">'+E(value)+'</textarea></div>';
const select=(label,name,values,value='',span2=false)=>'<div class="field'+(span2?' span2':'')+'"><label>'+E(label)+'</label><select name="'+E(name)+'">'+values.map(v=>{const [id,label]=Array.isArray(v)?v:[v,status(v)];return '<option value="'+E(id)+'"'+(String(value)===String(id)?' selected':'')+'>'+E(label)+'</option>'}).join('')+'</select></div>';
const opts=(rows,initial='Sin asignar',label='nombre')=>[['',initial],...(rows||[]).map(x=>[x.id,x[label]])];
function empty(title,msg,ico='box',button=''){
 return '<div class="empty"><div class="empty-ico">'+I(ico)+'</div><strong>'+E(title)+'</strong><p>'+E(msg)+'</p>'+button+'</div>';
}
const pageHead=(title,subtitle,action='')=>'<div class="page-head"><div><div class="overline" style="margin-bottom:10px">BÖDEN / OPERACIONES</div><h1>'+E(title)+'</h1><p>'+E(subtitle)+'</p></div><div class="page-actions">'+action+'</div></div>';
const btn=(text,action,id='',style='btn-primary')=>'<button class="btn '+style+'" data-action="'+E(action)+'" '+(id!==''?'data-id="'+E(id)+'"':'')+'>'+E(text)+'</button>';
const table=(columns,rows)=>'<div class="panel table-wrap"><table class="data-table"><thead><tr>'+columns.map(x=>'<th>'+E(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
const OS=window.OS={S,I,E,fdate,dateField,humanText,number,status,badge,api,toast,isManager,isMaint,login,init,navigate,logout,modal,close,field,textarea,select,opts,empty,pageHead,btn,table,actions:{},loadPage:async()=>{},filterView:()=>{}};
OS.actions.notifications=async()=>{await refreshNotifications();const rows=S.notifications.length?S.notifications.map(x=>'<div class="activity"><div class="activity-symbol">'+I('bell')+'</div><div class="activity-main"><strong>'+E(x.titulo)+'</strong><small>'+E(x.cuerpo)+' · '+E(fdate(x.created_at,true))+'</small></div></div>').join(''):empty('Sin novedades','No tenés notificaciones pendientes.','check');const enabled=pushAvailable()&&Notification.permission==='granted'&&localStorage.getItem('boden_push_enabled')==='1';const push=pushAvailable()?'<div class="row-actions" style="margin-top:18px">'+(enabled?'<span class="badge green">Avisos del dispositivo activos</span>':'<button class="btn btn-soft" data-action="enablePush">Activar avisos en este dispositivo</button>')+'</div>':'';modal('Notificaciones',rows+push,null);await Promise.all(S.notifications.filter(x=>!x.leida_at).map(x=>api('/notificaciones/'+x.id+'/leida',{method:'PATCH'}).catch(()=>null)));await refreshNotifications();};
OS.actions.enablePush=async()=>{await enablePush();close();toast('Notificaciones activadas en este dispositivo');};
document.addEventListener('click',async(e)=>{
 const nav=e.target.closest('[data-nav]');if(nav){navigate(nav.dataset.nav);return;}
 const act=e.target.closest('[data-action]');if(!act)return;
 const name=act.dataset.action;
 if(name==='logout')return logout();
 if(name==='menu')return document.getElementById('layout')?.classList.toggle('menu-open');
 if(name==='close')return close();
 if(name==='retry')return navigate(S.page);
 const fn=OS.actions[name];
 if(fn){try{await fn(act.dataset.id||'');}catch(error){toast(error.message,true);}}
});
document.addEventListener('submit',async(e)=>{
 if(e.target.id!=='login-form')return;
 e.preventDefault();const f=new FormData(e.target),b=e.target.querySelector('button');b.disabled=true;
 try{const r=await api('/auth/login',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})});S.token=r.token;S.user=r.user;localStorage.setItem('boden_token',r.token);localStorage.setItem('boden_user',JSON.stringify(r.user));shell();await refreshNotifications();await navigate(isMaint()?'inicio':'alertas');}
 catch(error){document.getElementById('login-error').textContent=error.message;b.disabled=false;}
});
document.addEventListener('input',e=>{if(e.target.matches('[data-search]')){S.q=e.target.value.toLowerCase().trim();OS.filterView();}});
document.addEventListener('change',e=>{if(e.target.matches('[data-filter]')){S.filter=e.target.value;OS.filterView();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
init();
})();


