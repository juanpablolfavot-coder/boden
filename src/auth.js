const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'dev-secret-cambiame';

// Grupos de roles para chequear permisos cómodo.
const ROLES = {
  reportan: ['recepcion', 'mucama', 'personal', 'mantenimiento', 'jefe_mantenimiento', 'admin'],
  mantenimiento: ['mantenimiento', 'jefe_mantenimiento', 'admin'],
  jefe: ['jefe_mantenimiento', 'admin'],
  admin: ['admin'],
};

function signToken(user) {
  return jwt.sign(
    { id: user.id, nombre: user.nombre, rol: user.rol },
    SECRET,
    { expiresIn: '12h' }
  );
}

// Verifica el token del header Authorization: Bearer xxx
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Falta el token de sesión' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Sesión vencida o inválida' });
  }
}

// Exige que el rol del usuario esté en la lista permitida.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'No tenés permiso para esto' });
    }
    next();
  };
}

module.exports = { signToken, auth, requireRole, ROLES, SECRET };
