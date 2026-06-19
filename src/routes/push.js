const express = require('express');
const { pool } = require('../db');
const { auth } = require('../auth');
const { getPublicKey } = require('../push');

const router = express.Router();

// GET /api/push/vapid-public  -> clave pública para suscribir desde el navegador
router.get('/vapid-public', (req, res) => {
  res.json({ publicKey: getPublicKey() });
});

// POST /api/push/subscribe
router.post('/subscribe', auth, async (req, res) => {
  const sub = req.body || {};
  if (!sub.endpoint || !sub.keys) {
    return res.status(400).json({ error: 'Suscripción inválida' });
  }
  try {
    await pool.query(
      `INSERT INTO push_subscriptions (usuario_id, endpoint, p256dh, auth)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (endpoint) DO UPDATE SET usuario_id = EXCLUDED.usuario_id`,
      [req.user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
    );
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'No se pudo guardar la suscripción' });
  }
});

module.exports = router;
