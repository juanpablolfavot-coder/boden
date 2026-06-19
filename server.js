require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureSchema } = require('./src/db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Servir la PWA (frontend)
app.use(express.static(path.join(__dirname, 'public')));

// API
app.use('/api/auth',      require('./src/routes/auth'));
app.use('/api/alertas',   require('./src/routes/alertas'));
app.use('/api/catalogos', require('./src/routes/catalogos'));
app.use('/api/push',      require('./src/routes/push'));
app.use('/api/reportes',  require('./src/routes/reportes'));

app.get('/healthz', (req, res) => res.json({ ok: true }));

// Cualquier otra ruta -> index (PWA SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await ensureSchema();
    app.listen(PORT, () => console.log(`[BODEN] Servidor en http://localhost:${PORT}`));
  } catch (e) {
    console.error('[BODEN] No se pudo iniciar:', e);
    process.exit(1);
  }
})();
