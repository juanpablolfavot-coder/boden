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
  vipSel: false,
  reportFoto: null,
  knownUrgent: null,
};

const REPORTAN = ['recepcion', 'mucama', 'personal'];
const MANT = ['mantenimiento', 'jefe_mantenimiento', 'admin'];
const JEFE = ['jefe_mantenimiento', 'admin'];
const ROL_LABEL = { recepcion: 'Recepción', mucama: 'Mucama', personal: 'Personal', mantenimiento: 'Mantenimiento', jefe_mantenimiento: 'Jefe de mantenimiento', admin: 'Administrador' };
const SLA_HRS = { urgente: 1, alta: 2, media: 24, baja: 72 };

// prioridad: etiqueta + color + ícono svg
const PRIO = {
  urgente: { label: 'Crítica', color: '--critica', icon: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>' },
  alta:    { label: 'Alta',    color: '--alta',    icon: '<path d="M3 17l6-6 4 4 7-8"/><path d="M21 7v5M21 7h-5"/>' },
  media:   { label: 'Media',   color: '--media',   icon: '<path d="M6 20V11M12 20V5M18 20v-6"/>' },
  baja:    { label: 'Baja',    color: '--baja',    icon: '<circle cx="12" cy="12" r="4"/>' },
};
const STL = { nueva: 'Sin tomar', asignada: 'Asignada', en_proceso: 'En proceso', resuelta: 'Resuelta', cerrada: 'Cerrada', cancelada: 'Cancelada' };

// íconos reutilizables
const IC = {
  bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  bed: '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 14h18M7 10V8a2 2 0 0 1 2-2h2"/>',
  pin: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  box: '<path d="M21 8 12 3 3 8l9 5 9-5z"/><path d="M3 8v8l9 5 9-5V8"/>',
  hour: '<path d="M6 2h12M6 22h12M8 2c0 4 8 6 8 10s-8 6-8 10M16 2c0 4-8 6-8 10"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 8 8h2a6 6 0 0 0 6-6v-2a2 2 0 0 0-4 0"/>',
  play: '<path d="M6 4l14 8-14 8z"/>',
  pause: '<path d="M7 5v14M17 5v14"/>',
  crown: '<path d="M3 7l4 5 5-7 5 7 4-5v11H3z"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 0 0-1.7-1L14.5 2h-5l-.4 2.6a7 7 0 0 0-1.7 1l-2.3-1-2 3.4L3.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 1.7 1l.4 2.6h5l.4-2.6a7 7 0 0 0 1.7-1l2.3 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  tasks: '<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  chart: '<path d="M3 3v18h18M7 14l4-4 3 3 5-6"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
};

const root = document.getElementById('root');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svg = (p, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24">${p}</svg>`;

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

/* ============ helpers ============ */
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
function fmtMin(m) { return m ? (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`) : '—'; }
function slaInfo(a) {
  if (['resuelta', 'cerrada', 'cancelada'].includes(a.estado)) return null;
  const hrs = SLA_HRS[a.prioridad] || 24;
  const diff = new Date(a.created_at).getTime() + hrs * 3600000 - Date.now();
  if (diff < 0) return { txt: 'Vencida', cls: 'sla-bad' };
  if (diff < 30 * 60000) return { txt: 'Vence en ' + Math.ceil(diff / 60000) + ' min', cls: 'sla-warn' };
  return { txt: 'En tiempo', cls: 'sla-ok' };
}
const initials = (n) => (n || '?').split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase();

/* ============ NAV ============ */
function navItems() {
  const r = State.user.rol;
  if (REPORTAN.includes(r)) return [
    ['reportar', 'Reportar', IC.plus],
    ['misrep', 'Mis reportes', IC.list],
  ];
  const items = [
    ['cola', 'Alertas', IC.list],
    ['mistareas', 'Mis tareas', IC.tasks],
    ['reportar', 'Reportar', IC.plus],
    ['panel', 'Panel', IC.chart],
  ];
  if (r === 'admin') items.push(['admin', 'Admin', IC.cog]);
  return items;
}

/* ============ LOGIN ============ */
function renderLogin(error) {
  root.innerHTML = `
  <div class="login">
    <div class="brand"><div class="wordmark">BÖDEN</div><div class="tag">HOTEL &amp; SPA</div></div>
    <div class="form"><div class="form-inner">
      <h2>Bienvenido</h2><p class="sub">Sistema de mantenimiento interno</p>
      ${error ? `<div class="err">${esc(error)}</div>` : ''}
      <div class="field"><label>Email</label><input id="email" type="email" autocomplete="username" placeholder="tu@boden"></div>
      <div class="field" style="margin-bottom:20px"><label>Contraseña</label><input id="password" type="password" autocomplete="current-password" placeholder="••••••••"></div>
      <button class="btn btn-primary" id="loginbtn">Ingresar</button>
      <p class="hint">Prueba: <b>admin@boden</b>, <b>jefe@boden</b>, <b>diego@boden</b>, <b>recepcion@boden</b> — clave <b>boden123</b></p>
    </div></div>
  </div>`;
  const btn = document.getElementById('loginbtn');
  const submit = async () => {
    btn.disabled = true; btn.textContent = 'Ingresando…';
    try {
      const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: document.getElementById('email').value, password: document.getElementById('password').value }) });
      State.token = data.token; State.user = data.user; State.knownUrgent = null;
      localStorage.setItem('boden_token', data.token);
      localStorage.setItem('boden_user', JSON.stringify(data.user));
      State.view = REPORTAN.includes(data.user.rol) ? 'reportar' : 'cola';
      renderApp(); initPush().catch(() => {});
    } catch (e) { renderLogin(e.message); }
  };
  btn.onclick = submit;
  ensureAudioOnGesture();
  document.getElementById('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}
function logout() {
  State.token = null; State.user = null; State.knownUrgent = null;
  localStorage.removeItem('boden_token'); localStorage.removeItem('boden_user');
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
      ${items.map(([id, lbl, ic]) => `<button class="ritem ${State.view === id ? 'on' : ''}" data-go="${id}">${svg(ic)}${lbl}</button>`).join('')}
      <div class="rfoot"><div class="uname">${esc(u.nombre)}</div><div class="urol">${esc(ROL_LABEL[u.rol] || u.rol)}</div><button id="logout2">Cerrar sesión</button></div>
    </nav>
    <div class="main"><div id="content"><div class="loading">Cargando…</div></div></div>
    <nav class="bnav">${bottomNavHTML(items)}</nav>
  </div>`;
  document.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { State.view = b.dataset.go; renderApp(); });
  document.getElementById('logout2').onclick = logout;
  wireBottomNav();
  renderView();
  checkUrgent();
}

function bottomNavHTML(items) {
  // En mobile: hasta 2 a la izq, FAB Reportar al medio, 2 a la der
  const rest = items.filter(([id]) => id !== 'reportar');
  const left = rest.slice(0, 2);
  const right = rest.slice(2, 4);
  const tab = ([id, lbl, ic]) => `<button class="${State.view === id ? 'on' : ''}" data-go="${id}">${svg(ic)}${lbl}</button>`;
  const fab = `<div class="fabwrap"><button class="fab" data-go="reportar">${svg(IC.plus)}Reportar</button></div>`;
  return left.map(tab).join('') + fab + right.map(tab).join('');
}
function wireBottomNav() {
  document.querySelectorAll('.bnav [data-go]').forEach((b) => b.onclick = () => { State.view = b.dataset.go; renderApp(); });
}

/* ============ VISTAS ============ */
async function renderView() {
  const c = document.getElementById('content');
  if (!c) return;
  try {
    if (State.view === 'reportar') return renderReportar(c);
    if (State.view === 'panel') return renderPanel(c);
    if (State.view === 'admin') return renderAdmin(c);
    if (State.view === 'misrep') return renderTriageSimple(c, 'Mis reportes', '', 'Lo que reportaste vos');
    if (State.view === 'mistareas') return renderTriageSimple(c, 'Mis tareas', '?mias=1', 'Asignadas a vos');
    return renderTriage(c);
  } catch (e) { c.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`; }
}

/* ---- HERO (turno + KPIs) ---- */
async function heroHTML() {
  const u = State.user;
  let turno = null, hd = null;
  try { turno = (await api('/turnos/activo')).turno; } catch {}
  try { hd = await api('/reportes/header'); } catch {}
  let avaName = '—', extra = '', horario = '';
  if (turno) {
    const us = turno.usuarios || [];
    avaName = us.length ? us[0].nombre : turno.nombre;
    if (us.length > 1) extra = ` +${us.length - 1}`;
    horario = `${turno.hora_inicio}–${turno.hora_fin}`;
  }
  const kpis = hd ? `
    <div class="tk"><div class="ti">${svg(IC.tasks)}Sin tomar</div><div class="tn">${hd.sin_tomar}</div></div>
    <div class="tk ${hd.vencidas ? 'bad' : ''}"><div class="ti">${svg(IC.clock)}SLA vencidos</div><div class="tn">${hd.vencidas}</div></div>
    <div class="tk"><div class="ti">${svg(IC.bolt)}Resp. prom.</div><div class="tn">${hd.prom_resolucion_min ? hd.prom_resolucion_min : 0}<small> min</small></div></div>` : '';
  return `
  <div class="hero">
    <div class="hero-top">
      <div><div class="wordmark">BÖDEN</div><span class="tag">MANTENIMIENTO</span></div>
      <div class="hero-r">
        <div class="hello">Hola,<br><b>${esc(u.nombre)}</b></div>
        <button class="iconbtn" id="mutebtn"><span id="muteico" style="font-size:18px">🔔</span></button>
        <button class="iconbtn" id="bell">${svg(IC.bell)}<span class="count hidden" id="bellcount">0</span></button>
      </div>
    </div>
    <div class="turnocard">
      <div class="turno-ava ${turno ? '' : 'off'}">${svg(IC.user)}${turno ? '<span class="on"></span>' : ''}</div>
      <div class="turno-info">
        <div class="lbl">TURNO ACTIVO</div>
        <div class="nm">${esc(avaName)}${extra}</div>
        ${horario ? `<div class="hr">${svg(IC.clock)} ${horario}</div>` : '<div class="hr">sin turno</div>'}
      </div>
      <div class="turno-kpis">${kpis}</div>
    </div>
  </div>`;
}

function hexBadge() {
  return `<div class="hexbadge"><svg viewBox="0 0 48 48">
    <polygon points="24,3 42,13 42,35 24,45 6,35 6,13" fill="none" stroke="var(--gold)" stroke-width="1.6"/>
    <path d="M24 14 27 24 24 34 21 24z M14 24 24 21 34 24 24 27z" fill="var(--gold)" opacity=".9"/>
  </svg></div>`;
}

async function renderTriage(c) {
  const FILTERS = [
    ['abiertas', 'Abiertas', null, true],
    ['urgentes', 'Urgentes', IC.bolt, false],
    ['nuevas', 'Sin tomar', IC.tasks, false],
    ['vencidas', 'Vencidas', IC.clock, false],
    ['vip', 'VIP', IC.crown, false],
  ];
  // fetch base
  let qs = '?abiertas=1';
  if (State.filter === 'urgentes') qs = '?prioridad=urgente';
  else if (State.filter === 'nuevas') qs = '?estado=nueva';
  else if (State.filter === 'vip') qs = '?vip=1';
  else if (State.filter === 'vencidas') qs = '?abiertas=1';
  let alertas = await api('/alertas' + qs);
  if (State.filter === 'vencidas') alertas = alertas.filter((a) => { const s = slaInfo(a); return s && s.cls === 'sla-bad'; });
  if (State.filter === 'urgentes') alertas = alertas.filter((a) => !['cerrada', 'cancelada'].includes(a.estado));

  const hero = await heroHTML();
  c.innerHTML = `${hero}
    <div class="content">
      <div class="sectionhead">${hexBadge()}<div><h1>Alertas</h1><div class="sub">${alertas.length} ${alertas.length === 1 ? 'alerta activa' : 'alertas activas'} · ordenadas por prioridad</div></div></div>
      <div class="pills">${FILTERS.map(([k, l, ic, cnt]) => `<button class="pill ${State.filter === k ? 'on' : ''}" data-f="${k}">${ic ? svg(ic) : ''}${l}${cnt ? `<span class="pc">${alertas.length}</span>` : ''}</button>`).join('')}</div>
      <div class="list">${alertas.length ? alertas.map(acardHTML).join('') : emptyHTML()}</div>
    </div>`;
  wireHero();
  c.querySelectorAll('[data-f]').forEach((b) => b.onclick = () => { State.filter = b.dataset.f; renderView(); });
  wireCards(c);
  refreshBell();
}

function acardHTML(a) {
  const p = PRIO[a.prioridad];
  const sla = slaInfo(a);
  const locIcon = a.ubicacion_tipo === 'area' ? IC.pin : (a.ubicacion_tipo === 'equipo' ? IC.box : IC.bed);
  const estadoTxt = a.estado === 'asignada' && a.asignado_nombre ? `Asignada a <b>${esc(a.asignado_nombre)}</b>`
    : a.estado === 'nueva' ? 'Sin tomar' : `<b>${STL[a.estado]}</b>`;
  return `<div class="acard" data-id="${a.id}">
    <div class="ledge" style="background:var(${p.color})"></div>
    <div class="ac-top">
      <span class="ac-code" style="color:var(${p.color})">${esc(a.codigo)}</span>
      <span class="ac-prio" style="background:var(${p.color})">${svg(p.icon)}${p.label}</span>
    </div>
    <div class="ac-title">${esc(a.titulo)}${a.vip ? `<span class="ac-vip">${svg(IC.crown)}VIP</span>` : ''}</div>
    <div class="ac-line" style="color:var(${p.color})">${svg(locIcon, '')}<span>${esc(a.ubicacion || '—')}</span></div>
    <div class="ac-cat">${svg(IC.bolt)}<span>${esc(a.categoria || '—')}</span></div>
    <div class="ac-div"></div>
    <div class="ac-foot">
      <span class="fg ac-state">${svg(IC.user)}<span>${estadoTxt}</span></span>
      <span class="fg">${svg(IC.clock)}${rel(a.created_at)}</span>
      ${sla ? `<span class="sla ${sla.cls}">${svg(IC.hour)}${sla.txt}</span>` : ''}
    </div>
    <div class="ac-actions">${cardActionsHTML(a)}</div>
  </div>`;
}

function cardActionsHTML(a) {
  const u = State.user;
  const ver = `<button class="btn btn-ghost ${''}" data-act="ver">${svg(IC.eye)}Ver</button>`;
  if (REPORTAN.includes(u.rol)) return `<button class="btn btn-ghost grow" data-act="ver">${svg(IC.eye)}Ver detalle</button>`;
  if (a.estado === 'nueva') return `<button class="btn btn-red grow" data-act="tomar">${svg(IC.hand)}Tomar</button>${ver}`;
  if (a.estado === 'asignada') return `<button class="btn btn-blue grow" data-act="en_proceso">${svg(IC.play)}Iniciar</button>${JEFE.includes(u.rol) ? `<button class="btn btn-ghost" data-act="ver">${svg(IC.user)}Reasignar</button>` : ver}`;
  if (a.estado === 'en_proceso') return `<button class="btn btn-grey grow" data-act="pausar">${svg(IC.pause)}Pausar</button>${ver}`;
  if (a.estado === 'resuelta' && JEFE.includes(u.rol)) return `<button class="btn btn-primary grow" data-act="ver">${svg(IC.check)}Verificar</button>`;
  return `<button class="btn btn-ghost grow" data-act="ver">${svg(IC.eye)}Ver detalle</button>`;
}

function wireCards(c) {
  c.querySelectorAll('.acard').forEach((el) => {
    const id = el.dataset.id;
    el.querySelectorAll('[data-act]').forEach((b) => b.onclick = async (ev) => {
      ev.stopPropagation();
      const act = b.dataset.act;
      if (act === 'ver') return openDetalle(id);
      b.disabled = true;
      try {
        if (act === 'tomar') { await api(`/alertas/${id}/tomar`, { method: 'PATCH' }); toast('Tomaste la alerta 👍'); }
        else { await api(`/alertas/${id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: act }) }); toast(act === 'en_proceso' ? 'Iniciaste el trabajo 🔧' : 'Trabajo pausado ⏸'); }
        renderView();
      } catch (e) { toast(e.message, true); b.disabled = false; }
    });
    // tap en la tarjeta (fuera de botones) abre detalle
    el.onclick = () => openDetalle(id);
  });
}

function wireHero() {
  const bell = document.getElementById('bell');
  if (bell) bell.onclick = () => { State.filter = 'nuevas'; renderView(); };
  const setMuteIco = () => { const el = document.getElementById('muteico'); if (el) el.textContent = isMuted() ? '🔕' : '🔔'; };
  setMuteIco();
  const mb = document.getElementById('mutebtn');
  if (mb) mb.onclick = () => { localStorage.setItem('boden_mute', isMuted() ? '0' : '1'); setMuteIco(); if (isMuted()) toast('Sirena silenciada 🔕'); else { ensureAudio(); toast('Sirena activada 🔔'); } };
}

function emptyHTML() {
  return `<div class="empty">${svg(IC.check)}<p>Nada por acá.<br>Todo al día.</p></div>`;
}

/* ---- listas simples (mis reportes / mis tareas) ---- */
async function renderTriageSimple(c, title, qs, sub) {
  const alertas = await api('/alertas' + qs);
  const hero = MANT.includes(State.user.rol) ? await heroHTML() : '';
  c.innerHTML = `${hero}<div class="content">
    <div class="shead"><h1>${title}</h1><div class="sub">${alertas.length} ${alertas.length === 1 ? 'alerta' : 'alertas'} · ${sub}</div></div>
    <div class="list">${alertas.length ? alertas.map(acardHTML).join('') : emptyHTML()}</div></div>`;
  if (hero) wireHero();
  wireCards(c);
  refreshBell();
}

/* ---- reportar ---- */
async function renderReportar(c) {
  if (!State.catalogos) State.catalogos = await api('/catalogos');
  const { ubicaciones, categorias } = State.catalogos;
  State.prioSel = 'media'; State.vipSel = false; State.reportFoto = null;
  c.innerHTML = `<div class="content">
    <div class="shead"><h1>Reportar</h1><div class="sub">Contanos qué pasa</div></div>
    <div class="form-page">
      <div class="field"><label>¿Dónde?</label><select id="r-ubic">${ubicaciones.map((u) => `<option value="${u.id}">${esc(u.nombre)}</option>`).join('')}</select></div>
      <div class="field"><label>¿De qué tipo?</label><select id="r-cat">${categorias.map((k) => `<option value="${k.id}">${esc(k.nombre)}</option>`).join('')}</select></div>
      <div class="field"><label>Título corto</label><input id="r-tit" placeholder="Ej: No funciona la luz"></div>
      <div class="field"><label>¿Qué pasa? (detalle)</label><textarea id="r-desc" placeholder="Contá lo que ves, si la habitación está ocupada, etc."></textarea></div>
      <div class="field"><label>Foto del problema (opcional)</label>
        <input id="r-foto" type="file" accept="image/*" capture="environment" style="display:none">
        <div class="photo" id="r-photo-btn">${svg('<path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2z"/><circle cx="12" cy="13" r="3.5"/>')}Sacar o subir foto</div>
        <div id="r-photo-prev"></div></div>
      <div class="field"><label>¿Qué tan urgente es?</label>
        <div class="chips" id="r-chips">${['urgente', 'alta', 'media', 'baja'].map((p) => `<div class="chip ${p === 'media' ? 'sel' : ''}" data-p="${p}" style="${p === 'media' ? 'background:var(' + PRIO[p].color + ');color:#fff' : ''}">${PRIO[p].label}</div>`).join('')}</div></div>
      <div class="field"><div class="vipswitch" id="vipsw"><div class="vl">${svg(IC.crown)} Huésped VIP</div><div class="sw" id="vipsw-t"></div></div></div>
      <button class="btn btn-primary" id="r-send" style="margin-top:8px">Enviar alerta</button>
    </div></div>`;
  // foto
  const fi = document.getElementById('r-foto'); const pv = document.getElementById('r-photo-prev');
  document.getElementById('r-photo-btn').onclick = () => fi.click();
  fi.onchange = async () => { if (!fi.files[0]) return; try { State.reportFoto = await compressImage(fi.files[0]); pv.innerHTML = `<div class="photoprev"><img src="${State.reportFoto}"><button type="button" id="rm">Quitar foto</button></div>`; document.getElementById('rm').onclick = () => { State.reportFoto = null; pv.innerHTML = ''; fi.value = ''; }; } catch { toast('No se pudo procesar la foto', true); } };
  // prioridad
  c.querySelectorAll('#r-chips .chip').forEach((el) => el.onclick = () => { c.querySelectorAll('#r-chips .chip').forEach((x) => { x.classList.remove('sel'); x.style.background = ''; x.style.color = ''; }); el.classList.add('sel'); el.style.background = 'var(' + PRIO[el.dataset.p].color + ')'; el.style.color = '#fff'; State.prioSel = el.dataset.p; });
  // vip
  document.getElementById('vipsw').onclick = () => { State.vipSel = !State.vipSel; document.getElementById('vipsw-t').classList.toggle('on', State.vipSel); };
  // enviar
  document.getElementById('r-send').onclick = async (ev) => {
    const btn = ev.currentTarget; const titulo = document.getElementById('r-tit').value.trim();
    if (!titulo) return toast('Poné un título', true);
    btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const a = await api('/alertas', { method: 'POST', body: JSON.stringify({ titulo, descripcion: document.getElementById('r-desc').value.trim(), categoria_id: +document.getElementById('r-cat').value, ubicacion_id: +document.getElementById('r-ubic').value, prioridad: State.prioSel, vip: State.vipSel, foto: State.reportFoto || undefined }) });
      State.reportFoto = null; toast(`Alerta enviada · ${a.codigo}`);
      State.view = REPORTAN.includes(State.user.rol) ? 'misrep' : 'cola'; renderApp();
    } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = 'Enviar alerta'; }
  };
}

/* ---- panel jefe ---- */
async function renderPanel(c) {
  const r = await api('/reportes/resumen');
  c.innerHTML = `<div class="content">
    <div class="shead"><h1>Panel</h1><div class="sub">Resumen operativo</div></div>
    <div class="kpis">
      <div class="kpi"><div class="n">${r.abiertas}</div><div class="l">Abiertas</div></div>
      <div class="kpi ${r.vencidas ? 'alert' : ''}"><div class="n">${r.vencidas}</div><div class="l">Vencidas SLA</div></div>
      <div class="kpi"><div class="n">${fmtMin(r.prom_resolucion_min)}</div><div class="l">Tiempo prom. resolución</div></div>
      <div class="kpi"><div class="n">${r.cerradas_semana}</div><div class="l">Cerradas (7 días)</div></div>
    </div>
    <div class="shead" style="padding-bottom:2px"><h1 style="font-size:18px">Ranking del equipo</h1></div>
    <div class="rank">${r.ranking.length ? r.ranking.map((p) => `<div class="rrow"><div class="av">${initials(p.nombre)}</div><div class="nm">${esc(p.nombre)}</div><div class="ct"><b>${p.resueltas}</b> resueltas${p.prom_min ? ` · ${fmtMin(p.prom_min)} prom.` : ''}</div></div>`).join('') : '<div class="empty"><p>Todavía no hay datos suficientes.</p></div>'}</div>
  </div>`;
}

/* ============ ADMIN ============ */
async function renderAdmin(c) {
  c.innerHTML = `<div class="content">
    <div class="shead"><h1>Admin</h1><div class="sub">Personal, turnos, ubicaciones y categorías</div></div>
    <div class="seg">${[['usuarios', 'Personal'], ['turnos', 'Turnos'], ['ubicaciones', 'Ubicaciones'], ['categorias', 'Categorías']].map(([k, l]) => `<button class="${State.adminTab === k ? 'on' : ''}" data-at="${k}">${l}</button>`).join('')}</div>
    <div id="adminbody"><div class="loading">Cargando…</div></div></div>`;
  c.querySelectorAll('[data-at]').forEach((b) => b.onclick = () => { State.adminTab = b.dataset.at; renderAdmin(c); });
  const body = document.getElementById('adminbody');
  if (State.adminTab === 'usuarios') return adminUsuarios(body);
  if (State.adminTab === 'turnos') return adminTurnos(body);
  return adminCatalogos(body, State.adminTab);
}

async function adminUsuarios(body) {
  const users = await api('/usuarios');
  const roles = ['recepcion', 'mucama', 'personal', 'mantenimiento', 'jefe_mantenimiento', 'admin'];
  const rolOpts = (sel) => roles.map((r) => `<option value="${r}" ${r === sel ? 'selected' : ''}>${ROL_LABEL[r]}</option>`).join('');
  body.innerHTML = `<div class="admwrap">
    <div class="admcard newform"><h4>Nuevo usuario</h4>
      <div class="field"><input id="nu-nom" placeholder="Nombre y apellido"></div>
      <div class="field"><input id="nu-mail" placeholder="email (ej: juan@boden)"></div>
      <div class="field"><input id="nu-pass" placeholder="contraseña"></div>
      <div class="field"><select id="nu-rol">${rolOpts('mantenimiento')}</select></div>
      <button class="btn btn-gold sm" id="nu-add">Crear usuario</button></div>
    ${users.map((u) => `<div class="admcard adm-user ${u.activo ? '' : 'off'}" data-id="${u.id}">
      <div class="adm-line"><input class="adm-nom" value="${esc(u.nombre)}"><select class="adm-rol">${rolOpts(u.rol)}</select></div>
      <div class="adm-sub">${esc(u.email)} ${u.activo ? '' : '· <b style="color:var(--critica)">inactivo</b>'}</div>
      <div class="adm-actions"><button class="btn btn-ghost sm" data-act="save">Guardar</button><button class="btn btn-ghost sm" data-act="pass">Cambiar clave</button><button class="btn btn-ghost sm" data-act="toggle">${u.activo ? 'Desactivar' : 'Activar'}</button></div>
    </div>`).join('')}</div>`;
  document.getElementById('nu-add').onclick = async (e) => { e.currentTarget.disabled = true; try { await api('/usuarios', { method: 'POST', body: JSON.stringify({ nombre: document.getElementById('nu-nom').value, email: document.getElementById('nu-mail').value, password: document.getElementById('nu-pass').value, rol: document.getElementById('nu-rol').value }) }); toast('Usuario creado'); State.catalogos = null; adminUsuarios(body); } catch (err) { toast(err.message, true); e.currentTarget.disabled = false; } };
  body.querySelectorAll('.adm-user').forEach((row) => { const id = row.dataset.id; row.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => { const act = b.dataset.act; try { if (act === 'save') { await api('/usuarios/' + id, { method: 'PATCH', body: JSON.stringify({ nombre: row.querySelector('.adm-nom').value, rol: row.querySelector('.adm-rol').value }) }); toast('Guardado'); State.catalogos = null; } else if (act === 'pass') { const p = prompt('Nueva contraseña:'); if (!p) return; await api('/usuarios/' + id + '/password', { method: 'POST', body: JSON.stringify({ password: p }) }); toast('Contraseña actualizada'); } else { const off = row.classList.contains('off'); await api('/usuarios/' + id, { method: 'PATCH', body: JSON.stringify({ activo: off }) }); toast(off ? 'Activado' : 'Desactivado'); State.catalogos = null; adminUsuarios(body); } } catch (err) { toast(err.message, true); } }); });
}

async function adminTurnos(body) {
  const [turnos, cat] = await Promise.all([api('/turnos'), State.catalogos ? Promise.resolve(State.catalogos) : api('/catalogos')]);
  State.catalogos = cat;
  const oper = cat.operarios || [];
  const chk = (sel) => oper.map((o) => `<label class="tp-chk"><input type="checkbox" value="${o.id}" ${sel && sel.includes(o.id) ? 'checked' : ''}>${esc(o.nombre)}</label>`).join('');
  body.innerHTML = `<div class="admwrap">
    <div class="admcard newform"><h4>Nuevo turno</h4>
      <div class="field"><input id="nt-nom" placeholder="Nombre (ej: Noche)"></div>
      <div class="timecols"><div class="field"><label>Desde</label><input id="nt-ini" type="time" value="06:00"></div><div class="field"><label>Hasta</label><input id="nt-fin" type="time" value="14:00"></div></div>
      <label style="font-size:12px;font-weight:600;color:var(--muted)">Personal (1 a 3)</label>
      <div class="turno-people" id="nt-people">${chk([])}</div>
      <button class="btn btn-gold sm" id="nt-add">Crear turno</button></div>
    ${turnos.map((t) => `<div class="admcard adm-turno" data-id="${t.id}">
      <div class="adm-line"><input class="adm-nom" value="${esc(t.nombre)}"><input class="adm-ini" type="time" value="${t.hora_inicio}" style="border:1px solid var(--line);border-radius:11px;padding:9px"><input class="adm-fin" type="time" value="${t.hora_fin}" style="border:1px solid var(--line);border-radius:11px;padding:9px"></div>
      <div class="turno-people">${chk(t.usuarios.map((u) => u.id))}</div>
      <div class="adm-actions"><button class="btn btn-ghost sm" data-act="save">Guardar</button><button class="btn btn-ghost sm" data-act="del" style="color:var(--critica)">Eliminar</button></div>
    </div>`).join('')}</div>`;
  const pick = (cont) => [...cont.querySelectorAll('input[type=checkbox]:checked')].map((x) => +x.value).slice(0, 3);
  document.getElementById('nt-add').onclick = async (e) => { e.currentTarget.disabled = true; try { await api('/turnos', { method: 'POST', body: JSON.stringify({ nombre: document.getElementById('nt-nom').value, hora_inicio: document.getElementById('nt-ini').value, hora_fin: document.getElementById('nt-fin').value, usuarios: pick(document.getElementById('nt-people')) }) }); toast('Turno creado'); adminTurnos(body); } catch (err) { toast(err.message, true); e.currentTarget.disabled = false; } };
  body.querySelectorAll('.adm-turno').forEach((row) => { const id = row.dataset.id; row.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => { try { if (b.dataset.act === 'save') { await api('/turnos/' + id, { method: 'PATCH', body: JSON.stringify({ nombre: row.querySelector('.adm-nom').value, hora_inicio: row.querySelector('.adm-ini').value, hora_fin: row.querySelector('.adm-fin').value, usuarios: pick(row) }) }); toast('Turno guardado'); } else { if (!confirm('¿Eliminar este turno?')) return; await api('/turnos/' + id, { method: 'DELETE' }); toast('Turno eliminado'); adminTurnos(body); } } catch (err) { toast(err.message, true); } }); });
}

async function adminCatalogos(body, tab) {
  const data = await api('/catalogos/admin');
  const items = tab === 'ubicaciones' ? data.ubicaciones : data.categorias;
  const tipos = [['habitacion', 'Habitación'], ['area', 'Área común'], ['equipo', 'Equipo / instalación']];
  body.innerHTML = `<div class="admwrap">
    ${tab === 'ubicaciones' ? `<div class="admcard newform"><h4>Generar habitaciones por piso</h4>
      <div class="adm-sub">Crea Habitación 101…, 201…, 301… (no duplica las que ya existan).</div>
      <div class="timecols">
        <div class="field"><label>Piso 1 (1xx)</label><input id="gp1" type="number" min="0" max="99" value="24"></div>
        <div class="field"><label>Piso 2 (2xx)</label><input id="gp2" type="number" min="0" max="99" value="23"></div>
        <div class="field"><label>Piso 3 (3xx)</label><input id="gp3" type="number" min="0" max="99" value="23"></div>
      </div>
      <div class="adm-sub" id="gtot" style="font-weight:700;color:var(--ink)">Total: 70 habitaciones</div>
      <button class="btn btn-gold sm" id="gen-hab">Generar habitaciones</button></div>` : ''}
    <div class="admcard newform"><h4>${tab === 'ubicaciones' ? 'Nueva ubicación suelta' : 'Nueva categoría'}</h4>
      ${tab === 'ubicaciones' ? `<div class="field"><select id="nc-tipo">${tipos.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></div>` : ''}
      <div class="field"><input id="nc-nom" placeholder="${tab === 'ubicaciones' ? 'Ej: Lobby, Pileta, Cocina' : 'Ej: Pintura'}"></div>
      <button class="btn btn-gold sm" id="nc-add">Agregar</button></div>
    ${items.map((it) => `<div class="admcard ${it.activo ? '' : 'off'}" data-id="${it.id}">
      <div class="adm-line"><input class="adm-nom" value="${esc(it.nombre)}"><button class="btn btn-ghost sm" data-act="save">Guardar</button><button class="btn btn-ghost sm" data-act="toggle">${it.activo ? 'Ocultar' : 'Activar'}</button></div>
      ${tab === 'ubicaciones' ? `<div class="adm-sub">${esc(it.tipo)}${it.activo ? '' : ' · oculta'}</div>` : (it.activo ? '' : '<div class="adm-sub">oculta</div>')}
    </div>`).join('')}</div>`;
  // generador de habitaciones
  if (tab === 'ubicaciones') {
    const upd = () => { const t = (+document.getElementById('gp1').value || 0) + (+document.getElementById('gp2').value || 0) + (+document.getElementById('gp3').value || 0); document.getElementById('gtot').textContent = `Total: ${t} habitaciones`; };
    ['gp1', 'gp2', 'gp3'].forEach((id) => document.getElementById(id).oninput = upd);
    document.getElementById('gen-hab').onclick = async (e) => {
      e.currentTarget.disabled = true;
      try {
        const r = await api('/catalogos/habitaciones-generar', { method: 'POST', body: JSON.stringify({ p1: +document.getElementById('gp1').value, p2: +document.getElementById('gp2').value, p3: +document.getElementById('gp3').value }) });
        toast(`${r.creadas} creadas${r.existentes ? ` · ${r.existentes} ya existían` : ''}`);
        State.catalogos = null; adminCatalogos(body, tab);
      } catch (err) { toast(err.message, true); e.currentTarget.disabled = false; }
    };
  }
  const base = tab === 'ubicaciones' ? '/catalogos/ubicaciones' : '/catalogos/categorias';
  document.getElementById('nc-add').onclick = async (e) => { e.currentTarget.disabled = true; try { const payload = { nombre: document.getElementById('nc-nom').value }; if (tab === 'ubicaciones') payload.tipo = document.getElementById('nc-tipo').value; await api(base, { method: 'POST', body: JSON.stringify(payload) }); toast('Agregado'); State.catalogos = null; adminCatalogos(body, tab); } catch (err) { toast(err.message, true); e.currentTarget.disabled = false; } };
  body.querySelectorAll('[data-id]').forEach((row) => { const id = row.dataset.id; row.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => { try { if (b.dataset.act === 'save') { await api(base + '/' + id, { method: 'PATCH', body: JSON.stringify({ nombre: row.querySelector('.adm-nom').value }) }); toast('Guardado'); State.catalogos = null; } else { const off = row.classList.contains('off'); await api(base + '/' + id, { method: 'PATCH', body: JSON.stringify({ activo: off }) }); toast(off ? 'Activado' : 'Ocultado'); State.catalogos = null; adminCatalogos(body, tab); } } catch (err) { toast(err.message, true); } }); });
}

/* ============ DETALLE ============ */
async function openDetalle(id) {
  if (!State.catalogos && MANT.includes(State.user.rol)) State.catalogos = await api('/catalogos').catch(() => null);
  const [a, hist] = await Promise.all([api('/alertas/' + id), api('/alertas/' + id + '/historial')]);
  const p = PRIO[a.prioridad];
  const solucion = [...hist].reverse().find((h) => h.evento === 'Resuelta' && h.nota);
  const adj = a.adjuntos || [];
  const fp = adj.find((x) => x.tipo === 'problema'); const fs = adj.find((x) => x.tipo === 'solucion');
  const img = (u) => `<img class="adjimg" src="${u}" onclick="window.open(this.src,'_blank')">`;
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="detalle">
    <div class="dhead"><button class="back">${svg(IC.back)} Volver</button>
      <div class="dtop"><span class="dcode">${esc(a.codigo)}</span><span class="ac-prio" style="background:var(${p.color})">${svg(p.icon)}${p.label}</span></div>
      <h2>${esc(a.titulo)}${a.vip ? ` <span class="ac-vip">${svg(IC.crown)}VIP</span>` : ''}</h2>
      <div class="dmeta"><span class="loc">${esc(a.ubicacion || '—')}</span><span class="dot"></span><span>${esc(a.categoria || '—')}</span><span class="dot"></span><span style="color:var(--gold2);font-weight:700">${STL[a.estado]}</span></div></div>
    <div class="dbody">
      ${(a.descripcion || fp) ? `<div class="panelbox"><h4>El problema</h4>${a.descripcion ? `<p>${esc(a.descripcion)}</p>` : ''}${fp ? img(fp.url) : ''}</div>` : ''}
      ${(solucion || fs) ? `<div class="panelbox solucion"><h4>✓ Cómo se resolvió</h4>${solucion ? `<p>${esc(solucion.nota)}</p>` : ''}${fs ? img(fs.url) : ''}${solucion ? `<div class="solby">${esc(solucion.usuario_nombre || '')} · ${rel(solucion.created_at)}</div>` : ''}</div>` : ''}
      <div class="panelbox"><h4>Asignación</h4><p>${a.asignado_nombre ? 'A cargo de <b>' + esc(a.asignado_nombre) + '</b>' : 'Todavía sin asignar'} · reportó ${esc(a.reportado_nombre || '—')}</p></div>
      <div class="panelbox"><h4>Historial</h4><div class="timeline">${hist.map((h) => `<div class="tl"><div class="ev">${esc(h.evento)}</div><div class="det">${esc(h.usuario_nombre || '—')}${h.nota ? ' · ' + esc(h.nota) : ''}</div><div class="ts">${fmtDate(h.created_at)} · ${rel(h.created_at)}</div></div>`).join('')}</div></div>
      <div class="actions" id="d-actions"></div>
    </div></div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) close(); };
  ov.querySelector('.back').onclick = close;
  renderActions(ov.querySelector('#d-actions'), a, close);
}

function btnsHTML(a, u) {
  if (REPORTAN.includes(u.rol)) return `<div class="hintline">Esperá a que mantenimiento la tome.</div>`;
  let h = '';
  if (a.estado === 'nueva') h += `<button class="btn btn-red" data-act="tomar">${svg(IC.hand)}Tomar (me la asigno)</button>`;
  if (a.estado === 'asignada') h += `<div class="row"><button class="btn btn-ghost" data-act="en_proceso">${svg(IC.play)}Empezar</button><button class="btn btn-primary" data-act="resuelta">${svg(IC.check)}Resolver</button></div>`;
  if (a.estado === 'en_proceso') h += `<div class="row"><button class="btn btn-grey" data-act="pausar">${svg(IC.pause)}Pausar</button><button class="btn btn-primary" data-act="resuelta">${svg(IC.check)}Resolver</button></div>`;
  if (a.estado === 'resuelta' && JEFE.includes(u.rol)) h += `<div class="row"><button class="btn btn-ghost" data-act="reabrir">Reabrir</button><button class="btn btn-primary" data-act="cerrada">Verificar y cerrar</button></div>`;
  if (a.estado === 'resuelta' && !JEFE.includes(u.rol)) h += `<div class="hintline">Esperando que el jefe verifique y cierre.</div>`;
  if (a.estado === 'cerrada' && JEFE.includes(u.rol)) h += `<button class="btn btn-ghost" data-act="reabrir">Reabrir</button>`;
  if (JEFE.includes(u.rol) && ['nueva', 'asignada', 'en_proceso'].includes(a.estado) && State.catalogos) {
    h += `<div class="assign"><select id="asig-sel">${State.catalogos.operarios.map((o) => `<option value="${o.id}" ${o.id === a.asignado_a ? 'selected' : ''}>${esc(o.nombre)}</option>`).join('')}</select><button class="btn btn-ghost sm" data-act="asignar" style="width:auto;padding:0 16px">Asignar</button></div>`;
  }
  if (['nueva', 'asignada', 'en_proceso'].includes(a.estado) && MANT.includes(u.rol)) h += `<button class="btn btn-ghost sm" data-act="cancelada" style="color:var(--critica)">Cancelar alerta</button>`;
  return h || `<div class="hintline">Sin acciones disponibles.</div>`;
}

const NOTE_ACTS = {
  resuelta:  { label: '¿Cómo lo resolviste?', ph: 'Ej: Se cambió el termostato y se purgó el termotanque', ok: 'Confirmar resuelta', required: true, photo: true },
  cancelada: { label: '¿Por qué la cancelás?', ph: 'Ej: Duplicada / no aplica', ok: 'Cancelar alerta', required: true },
  reabrir:   { label: 'Motivo de la reapertura', ph: 'Ej: El problema volvió a aparecer', ok: 'Reabrir', required: true },
  cerrada:   { label: 'Nota de cierre (opcional)', ph: 'Ej: Verificado, todo OK', ok: 'Verificar y cerrar', required: false },
};
const ACT_MSG = { tomar: 'Tomaste la alerta 👍', en_proceso: 'Marcada en proceso 🔧', pausar: 'Trabajo pausado ⏸', asignar: 'Alerta asignada 📌', resuelta: 'Alerta resuelta ✅', cerrada: 'Cerrada y verificada 🔒', reabrir: 'Alerta reabierta 🔄', cancelada: 'Alerta cancelada ✖️' };

function renderActions(box, a, close) {
  box.innerHTML = btnsHTML(a, State.user);
  box.querySelectorAll('[data-act]').forEach((b) => b.onclick = async () => {
    const act = b.dataset.act;
    if (['tomar', 'en_proceso', 'pausar', 'asignar'].includes(act)) {
      b.disabled = true;
      try {
        if (act === 'tomar') await api(`/alertas/${a.id}/tomar`, { method: 'PATCH' });
        else if (act === 'asignar') await api(`/alertas/${a.id}/asignar`, { method: 'PATCH', body: JSON.stringify({ asignado_a: +box.querySelector('#asig-sel').value }) });
        else await api(`/alertas/${a.id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: act }) });
        toast(ACT_MSG[act] || 'Listo'); close(); renderView();
      } catch (e) { toast(e.message, true); b.disabled = false; }
      return;
    }
    const cfg = NOTE_ACTS[act]; if (!cfg) return;
    showNoteForm(box, cfg, async (nota, foto) => { await api(`/alertas/${a.id}/estado`, { method: 'PATCH', body: JSON.stringify({ estado: act, nota, foto: foto || undefined }) }); toast(ACT_MSG[act] || 'Listo'); close(); renderView(); }, () => renderActions(box, a, close));
  });
}

function showNoteForm(box, cfg, onConfirm, onBack) {
  box.innerHTML = `<div class="notebox"><label>${cfg.label}</label><textarea id="noteta" placeholder="${esc(cfg.ph)}"></textarea>
    ${cfg.photo ? `<input id="solfoto" type="file" accept="image/*" capture="environment" style="display:none"><div class="photo sm" id="solfoto-btn">${svg('<path d="M14.5 4h-5L8 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-4l-1.5-2z"/><circle cx="12" cy="13" r="3.5"/>')}Foto de la solución (opcional)</div><div id="solfoto-prev"></div>` : ''}
    <div class="row"><button class="btn btn-ghost" data-cancel>Volver</button><button class="btn btn-primary" data-ok>${cfg.ok}</button></div></div>`;
  const ta = box.querySelector('#noteta'); ta.focus(); let foto = null;
  if (cfg.photo) { const fi = box.querySelector('#solfoto'); const pv = box.querySelector('#solfoto-prev'); box.querySelector('#solfoto-btn').onclick = () => fi.click(); fi.onchange = async () => { if (!fi.files[0]) return; try { foto = await compressImage(fi.files[0]); pv.innerHTML = `<div class="photoprev"><img src="${foto}"><button type="button" id="srm">Quitar</button></div>`; box.querySelector('#srm').onclick = () => { foto = null; pv.innerHTML = ''; fi.value = ''; }; } catch { toast('No se pudo procesar la foto', true); } }; }
  box.querySelector('[data-cancel]').onclick = () => onBack();
  box.querySelector('[data-ok]').onclick = async (e) => { const nota = ta.value.trim(); if (cfg.required && !nota) return toast('Escribí una nota, por favor', true); e.currentTarget.disabled = true; try { await onConfirm(nota, foto); } catch (err) { toast(err.message, true); e.currentTarget.disabled = false; } };
}

/* ============ campana ============ */
async function refreshBell() {
  if (REPORTAN.includes(State.user.rol)) return;
  try { const n = await api('/alertas?estado=nueva'); const el = document.getElementById('bellcount'); if (!el) return; if (n.length) { el.textContent = n.length; el.classList.remove('hidden'); } else el.classList.add('hidden'); } catch {}
}

/* ============ helpers UI ============ */
let toastTimer;
function toast(msg, bad) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.toggle('bad', !!bad);
  requestAnimationFrame(() => t.classList.add('show'));
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ============ imagen ============ */
function compressImage(file, maxDim = 1200, quality = 0.55) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const img = new Image(); img.onload = () => { let { width, height } = img; if (width > height && width > maxDim) { height = Math.round(height * maxDim / width); width = maxDim; } else if (height >= width && height > maxDim) { width = Math.round(width * maxDim / height); height = maxDim; } const cv = document.createElement('canvas'); cv.width = width; cv.height = height; cv.getContext('2d').drawImage(img, 0, 0, width, height); resolve(cv.toDataURL('image/jpeg', quality)); }; img.onerror = reject; img.src = reader.result; };
    reader.onerror = reject; reader.readAsDataURL(file);
  });
}

/* ============ sirena ============ */
let audioCtx = null;
function isMuted() { return localStorage.getItem('boden_mute') === '1'; }
function ensureAudio() { try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch (e) {} }
function ensureAudioOnGesture() { const unlock = () => { ensureAudio(); document.removeEventListener('pointerdown', unlock); }; document.addEventListener('pointerdown', unlock, { once: true }); }
function playSiren() {
  if (isMuted()) return; ensureAudio(); if (!audioCtx) return;
  const now = audioCtx.currentTime; const gain = audioCtx.createGain(); gain.connect(audioCtx.destination);
  const osc = audioCtx.createOscillator(); osc.type = 'sawtooth'; osc.connect(gain);
  gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
  let t = now; const dur = 0.45;
  for (let i = 0; i < 4; i++) { osc.frequency.setValueAtTime(620, t); osc.frequency.linearRampToValueAtTime(1080, t + dur / 2); osc.frequency.linearRampToValueAtTime(620, t + dur); t += dur; }
  gain.gain.setValueAtTime(0.22, t - 0.05); gain.gain.exponentialRampToValueAtTime(0.0001, t);
  osc.start(now); osc.stop(t + 0.05);
  if (navigator.vibrate) navigator.vibrate([200, 100, 200, 100, 200]);
}
async function checkUrgent() {
  if (!State.user || REPORTAN.includes(State.user.rol)) return;
  let list; try { list = await api('/alertas?prioridad=urgente'); } catch { return; }
  const me = State.user.id; const isJefe = JEFE.includes(State.user.rol);
  const relevant = list.filter((a) => { if (['cerrada', 'cancelada'].includes(a.estado)) return false; if (isJefe) return true; return a.asignado_a === me || a.estado === 'nueva'; });
  const ids = new Set(relevant.map((a) => a.id));
  if (State.knownUrgent === null) { State.knownUrgent = ids; return; }
  let hay = false; relevant.forEach((a) => { if (!State.knownUrgent.has(a.id)) hay = true; });
  State.knownUrgent = ids;
  if (hay) { playSiren(); toast('🚨 ¡Alerta URGENTE!'); }
}

/* ============ PWA / Push ============ */
function urlB64ToUint8(b64) { const pad = '='.repeat((4 - b64.length % 4) % 4); const base = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/'); const raw = atob(base); return Uint8Array.from([...raw].map((c) => c.charCodeAt(0))); }
async function initPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  const reg = await navigator.serviceWorker.register('/sw.js?v=1');
  const { publicKey } = await api('/push/vapid-public'); if (!publicKey) return;
  if (Notification.permission === 'denied') return;
  if (Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') return; }
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8(publicKey) });
  await api('/push/subscribe', { method: 'POST', body: JSON.stringify(sub) });
}

/* ============ arranque ============ */
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js?v=1').catch(() => {});
if (State.token && State.user) { ensureAudioOnGesture(); State.view = REPORTAN.includes(State.user.rol) ? 'reportar' : 'cola'; renderApp(); initPush().catch(() => {}); }
else renderLogin();
setInterval(() => { if (State.user && document.querySelector('.shell')) { refreshBell(); checkUrgent(); } }, 30000);
