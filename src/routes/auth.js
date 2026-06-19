const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db');
const { signToken, auth } = require('../auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan email y contraseña' });
  }
  try {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE lower(email) = lower($1) AND activo = TRUE',
      [email.trim()]
    );
    const user = rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    const token = signToken(user);
    res.json({ token, user: { id: user.id, nombre: user.nombre, rol: user.rol } });
  } catch (e) {
    console.error('login error', e);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', auth, (req, res) => {
  res.json({ user: { id: req.user.id, nombre: req.user.nombre, rol: req.user.rol } });
});

module.exports = router;
