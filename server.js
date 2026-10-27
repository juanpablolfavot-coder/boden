require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureSchema } = require('./src/db');
const { sweepDueNotifications } = require('./src/notifications');

const app = express();
app.disable('x-powered-by');
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  next();
});
app.use(cors());
app.use(express.json({ limit: '8mb' }));

// Servir la PWA (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api/auth',      require('./src/routes/auth'));
app.use('/api/alertas',   require('./src/routes/alertas'));
app.use('/api/catalogos', require('./src/routes/catalogos'));
app.use('/api/usuarios',  require('./src/routes/usuarios'));
app.use('/api/turnos',    require('./src/routes/turnos'));
app.use('/api/push',      require('./src/routes/push'));
app.use('/api/notificaciones', require('./src/routes/notificaciones'));
app.use('/api/reportes',  require('./src/routes/reportes'));
app.use('/api/equipos',       require('./src/routes/equipos'));
app.use('/api/preventivos',   require('./src/routes/preventivos'));
app.use('/api/trabajos',      require('./src/routes/trabajos'));
app.use('/api/stock',         require('./src/routes/stock'));
app.use('/api/herramientas',  require('./src/routes/herramientas'));
app.use('/api/centro',        require('./src/routes/centro'));

app.get('/healthz', (req, res) => res.json({ ok: true }));

// Cualquier otra ruta -> index (PWA SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await ensureSchema();
    app.listen(PORT, '0.0.0.0', () => console.log(`[BODEN] Servidor en http://0.0.0.0:${PORT}`));
    if (process.env.BODEN_SIMPLE_MIGRATION === '1') {
      sweepDueNotifications().catch((e) => console.error('[BODEN] Vencimientos:', e.message));
      const timer = setInterval(() => sweepDueNotifications().catch((e) => console.error('[BODEN] Vencimientos:', e.message)), 5 * 60 * 1000);
      timer.unref();
    }
  } catch (e) {
    console.error('[BODEN] No se pudo iniciar:', e);
    process.exit(1);
  }
})();
