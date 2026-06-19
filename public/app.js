'use strict';

/* ============ estado ============ */
const State = {
  token: localStorage.getItem('boden_token') || null,
  user: JSON.parse(localStorage.getItem('boden_user') || 'null'),
  view: 'cola',
  filter: 'abiertas',
  adminTab: 'usuarios',
  catalogos: null,
  prioSel: 'media',
};

const PRIO = { urgente: '--urgente', alta: '--alta', media: '--media', baja: '--baja' };
const PRIOL = { urgente: 'Urgente', alta: 'Alta', media: 'Media', baja: 'Baja' };
const STL = { nueva: 'Nueva', asignada: 'Asignada', en_proceso: 'En proceso', resuelta: 'Resuelta', cerrada: 'Cerrada', cancelada: 'Cancelada' };
const ROL_LABEL = { recepcion: 'Recepción', mucama: 'Mucama', personal: 'Personal', mantenimiento: 'Mantenimiento', jefe_mantenimiento: 'Jefe de mantenimiento', admin: 'Administrador' };

const REPORTAN = ['recepcion', 'mucama', 'personal'];
const MANT = ['mantenimiento', 'jefe_mantenimiento', 'admin'];
const JEFE = ['jefe_mantenimiento', 'admin'];

const root = document.getElementById('root');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ============ API ============ */
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (State.token) headers.Authorization = 'Bearer ' + State.token;
  const res = await fetch('/api' + path, { ...opts, headers });
  if (res.status === 401) { logout(); throw new Error('Sesión vencida'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error');
  return data;
}

/* ============ helpers de tiempo ============ */
function rel(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'recién';
  if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
  if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
  return 'hace ' + Math.floor(s / 86400) + ' d';
}
function fmtDate(iso) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ============ NAV por rol ============ */
function navItems() {
  const r = State.user.rol;
  if (REPORTAN.includes(r)) return [
    ['reportar', 'Reportar', 'M12 5v14M5 12h14'],
    ['misrep', 'Mis reportes', 'M4 6h16M4 12h16M4 18h10'],
  ];
  const items = [
    ['cola', 'Cola', 'M4 6h16M4 12h16M4 18h16'],
    ['mistareas', 'Mis tareas', 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11'],
    ['reportar', 'Reportar', 'M12 5v14M5 12h14'],
  ];
  if (JEFE.includes(r)) items.push(['panel', 'Panel', 'M3 3v18h18M7 14l4-4 3 3 5-6']);
  if (r === 'admin') items.push(['admin', 'Admin', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.2A1.7 1.7 0 0 0 6 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 13H4a2 2 0 0 1 0-4h.2A1.7 1.7 0 0 0 6 6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 11 4.6V4a2 2 0 0 1 4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.2a1.7 1.7 0 0 0-1.4.9z']);
  return items;
}

/* ============ LOGIN ============ */
function renderLogin(error) {
  root.innerHTML = `
  <div class="login">
    <div class="brand">
      <div class="wordmark">BÖDEN</div>
      <div class="tag">HOTEL &amp; SPA</div>
    </div>
    <div class="form">
      <div class="form-inner">
        <h2>Bienvenido</h2>
        <p class="sub">Sistema de mantenimiento interno</p>
        ${error ? `<div class="err">${esc(error)}</div>` : ''}
        <div class="field"><label>Email</label>
          <input id="email" type="email" autocomplete="username" placeholder="tu@boden"></div>
        <div class="field" style="margin-bottom:20px"><label>Contraseña</label>
          <input id="password" type="password" autocomplete="current-password" placeholder="••••••••"></div>
        <button class="btn btn-primary" id="loginbtn">Ingresar</button>
        <p class="hint">Usuarios de prueba: <b>admin@boden</b>, <b>jefe@boden</b>,<br><b>diego@boden</b>, <b>recepcion@boden</b> — contraseña <b>boden123</b></p>
      </div>
    </div>
  </div>`;
  const btn = document.getElementById('loginbtn');
  const submit = async () => {
    btn.disabled = true; btn.textContent = 'Ingresando…';
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('email').value,
          password: document.getElementById('password').value,
        }),
      });
      State.token = data.token; State.user = data.user;
      localStorage.setItem('boden_token', data.token);
      localStorage.setItem('boden_user', JSON.stringify(data.user));
      State.view = REPORTAN.includes(data.user.rol) ? 'reportar' : 'cola';
      renderApp();
      initPush().catch(() => {});
    } catch (e) {
      renderLogin(e.message);
    }
  };
  btn.onclick = submit;
  document.getElementById('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

function logout() {
  State.token = null; State.user = null;
  localStorage.removeItem('boden_token');
  localStorage.removeItem('boden_user');
  renderLogin();
}

/* ============ APP SHELL ============ */
function renderApp() {
  const u = State.user;
  const items = navItems();
  root.innerHTML = `
  <div class="shell">
    <nav class="rail">
      <div class="rbrand"><div class="wordmark">BÖDEN</div><span class="tag">MANTENIMIENTO</span></div>
      ${items.map(([id, lbl, d]) => `<button class="ritem ${State.view === id ? 'on' : ''}" data-go="${id}">
        <svg viewBox="0 0 24 24"><path d="${d}"/></svg>${lbl}</button>`).join('')}
      <div class="rfoot">
        <div class="uname">${esc(u.nombre)}</div>
        <div class="urol">${esc(ROL_LABEL[u.rol] || u.rol)}</div>
        <button id="logout2">Cerrar sesión</button>
      </div>
    </nav>
    <div class="main">
      <header class="topbar">
        <div class="topbar-brand"><div class="wordmark">BÖDEN</div><span class="tag">MANTENIMIENTO</span></div>
        <div class="topbar-r">
          <div class="who">Hola,<br><b>${esc(u.nombre)}</b></div>
          <button class="iconbtn" id="bell" title="Alertas sin tomar">
            <svg viewBox="0 0 24 24"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
            <span class="count hidden" id="bellcount">0</span>
          </button>
        </div>
      </header>
      <div class="content" id="content"><div class="loading">Cargando…</div></div>
    </div>
    <nav class="bottomnav">
      ${items.map(([id, lbl, d]) => `<button class="${State.view === id ? 'on' : ''}" data-go="${id}">
        <svg viewBox="0 0 24 24"><path d="${d}"/></svg>${lbl}</button>`).join('')}
    </nav>
  </div>`;

  document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { State.view = b.dataset.go; renderApp(); });
  document.getElementById('logout2').onclick = logout;
  document.getElementById('bell').onclick = () => { State.view = MANT.includes(u.rol) ? 'cola' : 'misrep'; State.filter = 'nuevas'; renderApp(); };
  renderView();
  refreshBell();
}

/* ============ VISTAS ============ */
async function renderView() {
  const c = document.getElementById('content');
  if (!c) return;
  try {
    if (State.view === 'reportar') return renderReportar(c);
    if (State.view === 'panel') return renderPanel(c);
    if (State.view === 'admin') return renderAdmin(c);
    let qs = '', title = '', sub = '';
    if (State.view === 'misrep') { qs = ''; title = 'Mis reportes'; sub = 'Lo que reportaste vos'; }
    else if (State.view === 'mistareas') { qs = '?mias=1'; title = 'Mis tareas'; sub = 'Asignadas a vos'; }
    else {
      const f = { abiertas: '?abiertas=1', urgentes: '?prioridad=urgente', nuevas: '?estado=nueva', todas: '' }[State.filter];
      qs = f; title = 'Cola'; sub = 'Ordenadas por prioridad';
    }
    const alertas = await api('/alertas' + qs);
    renderList(c, title, sub, alertas, State.view === 'cola');
  } catch (e) {
    c.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
  }
}

function cardHTML(a) {
  const who = a.estado === 'nueva'
    ? `Reportó <b>${esc(a.reportado_nombre || '—')}</b>`
    : (a.asignado_nombre ? `<b>${esc(a.asignado_nombre)}</b>` : 'Sin asignar');
  return `<div class="card" data-id="${a.id}">
    <div class="edge" style="background:var(${PRIO[a.prioridad]})"></div>
    <div class="ctop"><span class="code">${esc(a.codigo)}</span>
      <span class="prio" style="background:var(${PRIO[a.prioridad]})">${PRIOL[a.prioridad]}</span></div>
    <h3>${esc(a.titulo)}</h3>
    <div class="cmeta"><span class="loc">${esc(a.ubicacion || '—')}</span><span class="dot"></span><span>${esc(a.categoria || '—')}</span></div>
    <div class="cfoot">
      <span class="statebadge" style="color:var(--${a.estado})"><i style="background:var(--${a.estado})"></i>${STL[a.estado]}</span>
      <span class="cwho">${who} · ${rel(a.created_at)}</span>
    </div>
  </div>`;
}

function renderList(c, title, sub, alertas, withFilter) {
  const seg = withFilter ? `<div class="seg">
    ${[['abiertas', 'Abiertas'], ['urgentes', 'Urgentes'], ['nuevas', 'Sin tomar'], ['todas', 'Todas']]
      .map(([k, l]) => `<button class="${State.filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}
  </div>` : '';
  c.innerHTML = `<div class="shead"><h1>${title}</h1><div class="sub">${alertas.length} ${alertas.length === 1 ? 'alerta' : 'alertas'} · ${sub}</div></div>
    ${seg}
    ${alertas.length ? `<div class="list">${alertas.map(cardHTML).join('')}</div>` : emptyHTML()}`;
  c.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { State.filter = b.dataset.f; renderView(); });
  c.querySelectorAll('.card').forEach((el) => el.onclick = () => openDetalle(el.dataset.id));
}

function emptyHTML() {
  return `<div class="empty"><svg viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><p>Nada por acá.<br>Todo al día.</p></div>`;
}

/* ---- reportar ---- */
async function renderReportar(c) {
  if (!State.catalogos) State.catalogos = await api('/catalogos');
  const { ubicaciones, categorias } = State.catalogos;
  State.prioSel = 'media';
  c.innerHTML = `<div class="shead"><h1>Reportar</h1><div class="sub">Contanos qué pasa</div></div>
  <div class="form-page">
    <div class="field"><label>¿Dónde?</label>
      <select id="r-ubic">${ubicaciones.map((u) => `<option value="${u.id}">${esc(u.nombre)}</option>`).join('')}</select></div>
    <div class="field"><label>¿De qué tipo?</label>
      <select id="r-cat">${categorias.map((k) => `<option value="${k.id}">${esc(k.nombre)}</option>`).join('')}</select></div>
    <div class="field"><label>Título corto</label>
      <input id="r-tit" placeholder="Ej: Sin agua caliente"></div>
    <div class="field"><label>¿Qué pasa? (detalle)</label>
      <textarea id="r-desc" placeholder="Contá lo que ves, si la habitación está ocupada, etc."></textarea></div>
    <div class="field"><label>¿Qué tan urgente es?</label>
      <div class="chips" id="r-chips">
        ${['urgente', 'alta', 'media', 'baja'].map((p) => `<div class="chip ${p === 'media' ? 'sel' : ''}" data-p="${p}" style="${p === 'media' ? 'background:var(' + PRIO[p] + ');color:#fff' : ''}">${PRIOL[p]}</div>`).join('')}
      </div></div>
    <button class="btn btn-primary" id="r-send" style="margin-top:8px">Enviar alerta</button>
  </div>`;
  c.querySelectorAll('#r-chips .chip').forEach((el) => el.onclick = () => {
    c.querySelectorAll('#r-chips .chip').forEach((x) => { x.classList.remove('sel'); x.style.background = ''; x.style.color = ''; });
    el.classList.add('sel'); el.style.background = 'var(' + PRIO[el.dataset.p] + ')'; el.style.color = '#fff';
    State.prioSel = el.dataset.p;
  });
  document.getElementById('r-send').onclick = async (ev) => {
    const btn = ev.currentTarget;
    const titulo = document.getElementById('r-tit').value.trim();
    if (!titulo) return toast('Poné un título', true);
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const a = await api('/alertas', {
        method: 'POST',
        body: JSON.stringify({
          titulo,
          descripcion: document.getElementById('r-desc').value.trim(),
          categoria_id: +document.getElementById('r-cat').value,
          ubicacion_id: +document.getElementById('r-ubic').value,
          prioridad: State.prioSel,
        }),
      });
      toast(`Alerta enviada · ${a.codigo}`);
      State.view = REPORTAN.includes(State.user.rol) ? 'misrep' : 'cola';
      renderApp();
    } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Enviar alerta'; }
  };
}

/* ---- panel jefe ---- */
function fmtMin(m) { return m ? (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`) : '—'; }
async function renderPanel(c) {
  const r = await api('/reportes/resumen');
  const initials = (n) => n.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  c.innerHTML = `<div class="shead"><h1>Panel</h1><div class="sub">Resumen operativo</div></div>
  <div class="kpis">
    <div class="kpi"><div class="n">${r.abiertas}</div><div class="l">Abiertas</div></div>
    <div class="kpi ${r.vencidas ? 'alert' : ''}"><div class="n">${r.vencidas}</div><div class="l">Vencidas SLA</div></div>
    <div class="kpi"><div class="n">${fmtMin(r.prom_resolucion_min)}</div><div class="l">Tiempo prom. resolución</div></div>
    <div class="kpi"><div class="n">${r.cerradas_semana}</div><div class="l">Cerradas (7 días)</div></div>
  </div>
  <div class="shead" style="padding-bottom:2px"><h1 style="font-size:17px">Ranking del equipo</h1></div>
  <div class="rank">
    ${r.ranking.length ? r.ranking.map((p) => `<div class="rrow"><div class="av">${initials(p.nombre)}</div>
      <div class="nm">${esc(p.nombre)}</div>
      <div class="ct"><b>${p.resueltas}</b> resueltas${p.prom_min ? ` · ${fmtMin(p.prom_min)} prom.` : ''}</div></div>`).join('')
      : '<div class="empty"><p>Todavía no hay datos suficientes.</p></div>'}
  </div>`;
}

/* ============ ADMIN ============ */
async function renderAdmin(c) {
  c.innerHTML = `<div class="shead"><h1>Admin</h1><div class="sub">Personal, ubicaciones y categorías</div></div>
  <div class="seg">
    ${[['usuarios', 'Personal'], ['ubicaciones', 'Ubicaciones'], ['categorias', 'Categorías']]
      .map(([k, l]) => `<button class="${State.adminTab === k ? 'on' : ''}" data-at="${k}">${l}</button>`).join('')}
  </div>
  <div id="adminbody"><div class="loading">Cargando…</div></div>`;
  c.querySelectorAll('[data-at]').forEach((b) => b.onclick = () => { State.adminTab = b.dataset.at; renderAdmin(c); });
  const body = document.getElementById('adminbody');
  if (State.adminTab === 'usuarios') return adminUsuarios(body);
  return adminCatalogos(body, State.adminTab);
}

async function adminUsuarios(body) {
  const users = await api('/usuarios');
  const roles = ['recepcion', 'mucama', 'personal', 'mantenimiento', 'jefe_mantenimiento', 'admin'];
  const rolOpts = (sel) => roles.map((r) => `<option value="${r}" ${r === sel ? 'selected' : ''}>${ROL_LABEL[r]}</option>`).join('');
  body.innerHTML = `
  <div class="admwrap">
    <div class="admcard newform">
      <h4>Nuevo usuario</h4>
      <div class="field"><input id="nu-nom" placeholder="Nombre y apellido"></div>
      <div class="field"><input id="nu-mail" placeholder="email (ej: juan@boden)"></div>
      <div class="field"><input id="nu-pass" placeholder="contraseña"></div>
      <div class="field"><select id="nu-rol">${rolOpts('mantenimiento')}</select></div>
      <button class="btn btn-bronze sm" id="nu-add">Crear usuario</button>
    </div>
    ${users.map((u) => `<div class="admcard adm-user ${u.activo ? '' : 'off'}" data-id="${u.id}">
      <div class="adm-line">
        <input class="adm-nom" value="${esc(u.nombre)}">
        <select class="adm-rol">${rolOpts(u.rol)}</select>
      </div>
      <div class="adm-sub">${esc(u.email)} ${u.activo ? '' : '· <b style="color:var(--urgente)">inactivo</b>'}</div>
      <div class="adm-actions">
        <button class="btn btn-ghost sm" data-act="save">Guardar</button>
        <button class="btn btn-ghost sm" data-act="pass">Cambiar clave</button>
        <button class="btn btn-ghost sm" data-act="toggle">${u.activo ? 'Desactivar' : 'Activar'}</button>
      </div>
    </div>`).join('')}
  </div>`;

  document.getElementById('nu-add').onclick = async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      await api('/usuarios', { method: 'POST', body: JSON.stringify({
        nombre: document.getElementById('nu-nom').value,
        email: document.getElementById('nu-mail').value,
        password: document.getElementById('nu-pass').value,
        rol: document.getElementById('nu-rol').value,
      }) });
      toast('Usuario creado'); State.catalogos = null; adminUsuarios(body);
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  };

  body.querySelectorAll('.adm-user').forEach((row) => {
    const id = row.dataset.id;
    row.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
      const act = b.dataset.act;
      try {
        if (act === 'save') {
          await api('/usuarios/' + id, { method: 'PATCH', body: JSON.stringify({
            nombre: row.querySelector('.adm-nom').value,
            rol: row.querySelector('.adm-rol').value,
          }) });
          toast('Guardado'); State.catalogos = null;
        } else if (act === 'pass') {
          const p = prompt('Nueva contraseña para este usuario:');
          if (!p) return;
          await api('/usuarios/' + id + '/password', { method: 'POST', body: JSON.stringify({ password: p }) });
          toast('Contraseña actualizada');
        } else if (act === 'toggle') {
          const off = row.classList.contains('off');
          await api('/usuarios/' + id, { method: 'PATCH', body: JSON.stringify({ activo: off }) });
          toast(off ? 'Activado' : 'Desactivado'); State.catalogos = null; adminUsuarios(body);
        }
      } catch (err) { toast(err.message, true); }
    });
  });
}

async function adminCatalogos(body, tab) {
  const data = await api('/catalogos/admin');
  const items = tab === 'ubicaciones' ? data.ubicaciones : data.categorias;
  const tipos = [['habitacion', 'Habitación'], ['area', 'Área común'], ['equipo', 'Equipo / instalación']];
  body.innerHTML = `
  <div class="admwrap">
    <div class="admcard newform">
      <h4>${tab === 'ubicaciones' ? 'Nueva ubicación' : 'Nueva categoría'}</h4>
      ${tab === 'ubicaciones' ? `<div class="field"><select id="nc-tipo">${tipos.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>` : ''}
      <div class="field"><input id="nc-nom" placeholder="${tab === 'ubicaciones' ? 'Ej: Habitación 305' : 'Ej: Pintura'}"></div>
      <button class="btn btn-bronze sm" id="nc-add">Agregar</button>
    </div>
    ${items.map((it) => `<div class="admcard adm-cat ${it.activo ? '' : 'off'}" data-id="${it.id}">
      <div class="adm-line"><input class="adm-nom" value="${esc(it.nombre)}">
        <button class="btn btn-ghost sm" data-act="save">Guardar</button>
        <button class="btn btn-ghost sm" data-act="toggle">${it.activo ? 'Ocultar' : 'Activar'}</button>
      </div>
      ${tab === 'ubicaciones' ? `<div class="adm-sub">${esc(it.tipo)} ${it.activo ? '' : '· oculta'}</div>` : (it.activo ? '' : '<div class="adm-sub">oculta</div>')}
    </div>`).join('')}
  </div>`;

  const base = tab === 'ubicaciones' ? '/catalogos/ubicaciones' : '/catalogos/categorias';
  document.getElementById('nc-add').onclick = async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    try {
      const payload = { nombre: document.getElementById('nc-nom').value };
      if (tab === 'ubicaciones') payload.tipo = document.getElementById('nc-tipo').value;
      await api(base, { method: 'POST', body: JSON.stringify(payload) });
      toast('Agregado'); State.catalogos = null; adminCatalogos(body, tab);
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  };
  body.querySelectorAll('[data-id]').forEach((row) => {
    const id = row.dataset.id;
    row.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
      try {
        if (b.dataset.act === 'save') {
          await api(base + '/' + id, { method: 'PATCH', body: JSON.stringify({ nombre: row.querySelector('.adm-nom').value }) });
          toast('Guardado'); State.catalogos = null;
        } else {
          const off = row.classList.contains('off');
          await api(base + '/' + id, { method: 'PATCH', body: JSON.stringify({ activo: off }) });
          toast(off ? 'Activado' : 'Ocultado'); State.catalogos = null; adminCatalogos(body, tab);
        }
      } catch (err) { toast(err.message, true); }
    });
  });
}

/* ============ DETALLE ============ */
async function openDetalle(id) {
  if (!State.catalogos && MANT.includes(State.user.rol)) {
    State.catalogos = await api('/catalogos').catch(() => null);
  }
  const [a, hist] = await Promise.all([api('/alertas/' + id), api('/alertas/' + id + '/historial')]);
  const u = State.user;
  const solucion = [...hist].reverse().find((h) => h.evento === 'Resuelta' && h.nota);

  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.innerHTML = `
  <div class="detalle">
    <div class="dhead">
      <button class="back"><svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg> Volver</button>
      <div class="dtop"><span class="dcode">${esc(a.codigo)}</span>
        <span class="prio" style="background:var(${PRIO[a.prioridad]})">${PRIOL[a.prioridad]}</span></div>
      <h2>${esc(a.titulo)}</h2>
      <div class="dmeta"><span class="loc">${esc(a.ubicacion || '—')}</span>
        <span class="dot"></span><span>${esc(a.categoria || '—')}</span>
        <span class="dot"></span><span style="color:var(--bronze);font-weight:600">${STL[a.estado]}</span></div>
    </div>
    <div class="dbody">
      ${a.descripcion ? `<div class="panelbox"><h4>El problema</h4><p>${esc(a.descripcion)}</p></div>` : ''}
      ${solucion ? `<div class="panelbox solucion"><h4>✓ Cómo se resolvió</h4><p>${esc(solucion.nota)}</p><div class="solby">${esc(solucion.usuario_nombre || '')} · ${rel(solucion.created_at)}</div></div>` : ''}
      <div class="panelbox"><h4>Asignación</h4><p>${a.asignado_nombre ? 'A cargo de <b>' + esc(a.asignado_nombre) + '</b>' : 'Todavía sin asignar'} · reportó ${esc(a.reportado_nombre || '—')}</p></div>
      <div class="panelbox"><h4>Historial</h4>
        <div class="timeline">${hist.map((h) => `<div class="tl">
          <div class="ev">${esc(h.evento)}</div>
          <div class="det">${esc(h.usuario_nombre || '—')}${h.nota ? ' · ' + esc(h.nota) : ''}</div>
          <div class="ts">${fmtDate(h.created_at)} · ${rel(h.created_at)}</div></div>`).join('')}</div>
      </div>
      <div class="actions" id="d-actions"></div>
    </div>
  </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) close(); };
  ov.querySelector('.back').onclick = close;
  renderActions(ov.querySelector('#d-actions'), a, close);
}

function btnsHTML(a, u) {
  if (REPORTAN.includes(u.rol)) return `<div class="hintline">Esperá a que mantenimiento la tome.</div>`;
  let h = '';
  if (a.estado === 'nueva') h += `<button class="btn btn-bronze" data-act="tomar">Tomar (me la asigno)</button>`;
  if (a.estado === 'asignada') h += `<div class="row"><button class="btn btn-ghost" data-act="en_proceso">Empezar a trabajar</button><button class="btn btn-primary" data-act="resuelta">Resolver</button></div>`;
  if (a.estado === 'en_proceso') h += `<button class="btn btn-primary" data-act="resuelta">Marcar resuelta</button>`;
  if (a.estado === 'resuelta' && JEFE.includes(u.rol)) h += `<div class="row"><button class="btn btn-ghost" data-act="reabrir">Reabrir</button><button class="btn btn-primary" data-act="cerrada">Verificar y cerrar</button></div>`;
  if (a.estado === 'resuelta' && !JEFE.includes(u.rol)) h += `<div class="hintline">Esperando que el jefe verifique y cierre.</div>`;
  if (a.estado === 'cerrada' && JEFE.includes(u.rol)) h += `<button class="btn btn-ghost" data-act="reabrir">Reabrir</button>`;
  if (JEFE.includes(u.rol) && ['nueva', 'asignada', 'en_proceso'].includes(a.estado) && State.catalogos) {
    h += `<div class="assign"><select id="asig-sel">${State.catalogos.operarios.map((o) => `<option value="${o.id}" ${o.id === a.asignado_a ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</select>
      <button class="btn btn-ghost sm" data-act="asignar" style="width:auto;padding:0 16px">Asignar a otro</button></div>`;
  }
  if (['nueva', 'asignada', 'en_proceso'].includes(a.estado) && MANT.includes(u.rol)) {
    h += `<button class="btn btn-ghost sm" data-act="cancelada" style="color:var(--urgente)">Cancelar alerta</button>`;
  }
  return h || `<div class="hintline">Sin acciones disponibles.</div>`;
}

// Acciones que piden escribir una nota antes de confirmar
const NOTE_ACTS = {
  resuelta:  { label: '¿Cómo lo resolviste?', ph: 'Ej: Se cambió el termostato y se purgó el termotanque', ok: 'Confirmar resuelta', required: true },
  cancelada: { label: '¿Por qué la cancelás?', ph: 'Ej: Duplicada / no aplica', ok: 'Cancelar alerta', required: true },
  reabrir:   { label: 'Motivo de la reapertura', ph: 'Ej: El problema volvió a aparecer', ok: 'Reabrir', required: true },
  cerrada:   { label: 'Nota de cierre (opcional)', ph: 'Ej: Verificado, todo OK', ok: 'Verificar y cerrar', required: false },
};

function renderActions(box, a, close) {
  box.innerHTML = btnsHTML(a, State.user);
  box.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
    const act = b.dataset.act;
    if (act === 'tomar' || act === 'en_proceso' || act === 'asignar') {
      b.disabled = true;
      try {
        if (act === 'tomar') await api(`/alertas/${a.id}/tomar`, { method: 'PATCH' });
        else if (act === 'asignar') await api(`/alertas/${a.id}/asignar`, { method: 'PATCH', body: JSON.stringify({ asignado_a: +box.querySelector('#asig-sel').value }) });
        else await api(`/alertas/${a.id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: act }) });
        toast('Listo, se actualizó'); close(); renderView(); refreshBell();
      } catch (e) { toast(e.message, true); b.disabled = false; }
      return;
    }
    // acciones con nota
    const cfg = NOTE_ACTS[act];
    if (!cfg) return;
    showNoteForm(box, cfg, async (nota) => {
      await api(`/alertas/${a.id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: act, nota }) });
      toast('Listo, se actualizó'); close(); renderView(); refreshBell();
    }, () => renderActions(box, a, close));
  });
}

function showNoteForm(box, cfg, onConfirm, onBack) {
  box.innerHTML = `<div class="notebox">
    <label>${cfg.label}</label>
    <textarea id="noteta" placeholder="${esc(cfg.ph)}"></textarea>
    <div class="row">
      <button class="btn btn-ghost" data-cancel>Volver</button>
      <button class="btn btn-primary" data-ok>${cfg.ok}</button>
    </div>
  </div>`;
  const ta = box.querySelector('#noteta');
  ta.focus();
  box.querySelector('[data-cancel]').onclick = () => onBack();
  box.querySelector('[data-ok]').onclick = async (e) => {
    const nota = ta.value.trim();
    if (cfg.required && !nota) return toast('Escribí una nota, por favor', true);
    e.currentTarget.disabled = true;
    try { await onConfirm(nota); } catch (err) { toast(err.message, true); e.currentTarget.disabled = false; }
  };
}

/* ============ campana ============ */
async function refreshBell() {
  if (REPORTAN.includes(State.user.rol)) return;
  try {
    const nuevas = await api('/alertas?estado=nueva');
    const el = document.getElementById('bellcount');
    if (!el) return;
    if (nuevas.length) { el.textContent = nuevas.length; el.classList.remove('hidden'); }
    else el.classList.add('hidden');
  } catch {}
}

/* ============ helpers UI ============ */
let toastTimer;
function toast(msg, bad) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle('bad', !!bad);
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ============ PWA / Push ============ */
function urlB64ToUint8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const reg = await navigator.serviceWorker.register('/sw.js?v=1');
  const { publicKey } = await api('/push/vapid-public');
  if (!publicKey) return;
  if (Notification.permission === 'denied') return;
  if (Notification.permission !== 'granted') {
    const p = await Notification.requestPermission();
    if (p !== 'granted') return;
  }
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8(publicKey),
  });
  await api('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
}

/* ============ arranque ============ */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js?v=1').catch(() => {});
}
if (State.token && State.user) {
  State.view = REPORTAN.includes(State.user.rol) ? 'reportar' : 'cola';
  renderApp();
  initPush().catch(() => {});
} else {
  renderLogin();
}
setInterval(() => { if (State.user && document.querySelector('.topbar')) refreshBell(); }, 30000);
