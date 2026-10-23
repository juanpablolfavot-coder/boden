'use strict';
(function(){
const S={token:localStorage.getItem('boden_token'),user:null,page:'inicio',data:{},q:'',filter:'',menu:false,cat:null};
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
 const onlyDate=!time&&/^\\d{4}-\\d{2}-\\d{2}/.test(String(x));
 const value=onlyDate?new Date(String(x).slice(0,10)+'T12:00:00Z'):new Date(x);
 return value.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:time?undefined:'numeric',timeZone:'America/Argentina/Cordoba',...(time?{hour:'2-digit',minute:'2-digit'}:{})});
 }catch{return E(x)}};
const dateField=(x)=>x?String(x).slice(0,10):'';
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
const isManager=()=>['admin','jefe_mantenimiento'].includes(S.user?.rol);
const isMaint=()=>['admin','jefe_mantenimiento','mantenimiento'].includes(S.user?.rol);
const items=[
 {id:'inicio',text:'Centro de control',icon:'grid'},
 {id:'alertas',text:'Alertas e incidencias',icon:'bell'},
 {id:'trabajos',text:'Partes de trabajo',icon:'clipboard'},
 {id:'equipos',text:'Equipos e instalaciones',icon:'building'},
 {id:'preventivos',text:'Plan preventivo',icon:'calendar'},
 {id:'stock',text:'Almacén de repuestos',icon:'box'},
 {id:'herramientas',text:'Herramientas',icon:'tool'}
];
const titles=Object.fromEntries(items.map(x=>[x.id,x.text]));
function shell(){
 const visible=items.filter(x=>isMaint()||x.id==='alertas');
 const html='<div class="layout" id="layout"><div class="mobile-dimmer" data-action="menu"></div><aside class="sidebar">'+
 '<div class="brand"><div class="brand-emblem">B</div><div><div class="brand-name">BÖDEN</div><div class="brand-sub">MaintenanceOS</div></div></div>'+
 '<div class="nav-section">OPERACIONES</div><nav class="nav" aria-label="Navegación principal">'+visible.map(x=>'<button type="button" class="nav-btn'+(S.page===x.id?' active':'')+'" data-nav="'+x.id+'">'+I(x.icon)+E(x.text)+'</button>').join('')+'</nav>'+
 '<div class="nav-divider"></div><div class="nav-section">ADMINISTRACIÓN</div><nav class="nav"><a class="nav-btn" href="/legacy.html">'+I('settings')+'Gestión clásica y usuarios</a></nav>'+
 '<div class="side-foot"><div class="site-pill"><span class="dot"></span> Conectado · Gestión hotelera</div><div class="user-chip"><div class="avatar">'+E((S.user.nombre||'U').charAt(0).toUpperCase())+'</div><div><strong>'+E(S.user.nombre)+'</strong><small>'+E(status(S.user.rol).replaceAll('_',' '))+'</small></div><button class="logout" data-action="logout" title="Cerrar sesión">'+I('logout')+'</button></div></div>'+
 '</aside><main class="main"><header class="topbar"><div class="mobile-top"><button class="menu-btn" data-action="menu" aria-label="Abrir menú">'+I('menu')+'</button></div><div class="crumb"><span class="hide-mobile">Hotel & Spa</span><span class="crumb-sep hide-mobile">/</span><strong id="crumb">'+E(titles[S.page]||'BÖDEN')+'</strong></div><div class="top-actions"><span class="date-chip">'+new Date().toLocaleDateString('es-AR',{weekday:'long',day:'numeric',month:'long',timeZone:'America/Argentina/Cordoba'})+'</span><span class="dot"></span><span>Operativo</span></div></header><div id="screen" class="content"></div></main></div>';
 document.getElementById('app').innerHTML=html;
}
function login(){
 document.getElementById('app').innerHTML='<div class="login-layout"><div class="login-visual"><div class="brand"><div class="brand-emblem">B</div><div><div class="brand-name">BÖDEN</div><div class="brand-sub">MaintenanceOS</div></div></div><div><div class="overline" style="color:#d3b277;margin-bottom:18px">HOTEL & SPA · FACILITIES</div><h1>El arte de mantener todo funcionando.</h1><p>Control de instalaciones, equipos, trabajos, repuestos y herramientas en una única plataforma.</p></div><footer>BÖDEN · EXCELENCIA OPERATIVA</footer></div><div class="login-side"><form id="login-form" class="login-form"><div class="overline">ACCESO AL SISTEMA</div><h2>Bienvenido de nuevo.</h2><p class="muted">Ingresá con tus credenciales de mantenimiento.</p><div class="field"><label>Correo o usuario</label><input type="text" name="email" autocomplete="username" placeholder="usuario@boden" required></div><div class="field"><label>Contraseña</label><input name="password" type="password" autocomplete="current-password" placeholder="••••••••" required></div><button class="btn btn-primary" type="submit">Iniciar sesión '+I('arrow')+'</button><p id="login-error" class="login-error"></p></form></div></div>';
}
async function init(){
 if(!S.token){login();return;}
 try{const result=await api('/auth/me');S.user=result.user; S.page=isMaint()?'inicio':'alertas';shell();await navigate(S.page);}catch(e){S.token=null;localStorage.removeItem('boden_token');login();}
}
async function navigate(page){
 if(!isMaint()&&page!=='alertas')page='alertas';
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
const OS=window.OS={S,I,E,fdate,dateField,number,status,badge,api,toast,isManager,isMaint,login,init,navigate,logout,modal,close,field,textarea,select,opts,empty,pageHead,btn,table,actions:{},loadPage:async()=>{},filterView:()=>{}};
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
 try{const r=await api('/auth/login',{method:'POST',body:JSON.stringify({email:f.get('email'),password:f.get('password')})});S.token=r.token;S.user=r.user;localStorage.setItem('boden_token',r.token);localStorage.setItem('boden_user',JSON.stringify(r.user));shell();await navigate(isMaint()?'inicio':'alertas');}
 catch(error){document.getElementById('login-error').textContent=error.message;b.disabled=false;}
});
document.addEventListener('input',e=>{if(e.target.matches('[data-search]')){S.q=e.target.value.toLowerCase().trim();OS.filterView();}});
document.addEventListener('change',e=>{if(e.target.matches('[data-filter]')){S.filter=e.target.value;OS.filterView();}});
document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
init();
})();
