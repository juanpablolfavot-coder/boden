const webpush = require('web-push');
const { pool } = require('./db');

const PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:mantenimiento@boden.com';

let enabled = false;
if (PUBLIC && PRIVATE) {
  try {
    webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
    enabled = true;
    console.log('[BODEN] Push notifications: ACTIVADAS');
  } catch (e) {
    console.warn('[BODEN] Push deshabilitado (claves VAPID inválidas):', e.message);
  }
} else {
  console.log('[BODEN] Push notifications: desactivadas (faltan claves VAPID). La app funciona igual.');
}

function getPublicKey() {
  return enabled ? PUBLIC : '';
}

// Manda push a una lista de usuario_id. Limpia suscripciones muertas.
async function notifyUsers(usuarioIds, payload) {
  if (!enabled || !usuarioIds.length) return;
  const { rows } = await pool.query(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE usuario_id = ANY($1)',
    [usuarioIds]
  );
  const body = JSON.stringify(payload);
  await Promise.allSettled(rows.map(async (s) => {
    const sub = { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } };
    try {
      await webpush.sendNotification(sub, body);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]);
      }
    }
  }));
}

// IDs de todo el personal de mantenimiento + jefes.
async function maintenanceUserIds() {
  const { rows } = await pool.query(
    "SELECT id FROM usuarios WHERE rol IN ('mantenimiento','jefe_mantenimiento') AND activo = TRUE"
  );
  return rows.map((r) => r.id);
}

module.exports = { getPublicKey, notifyUsers, maintenanceUserIds, pushEnabled: () => enabled };
