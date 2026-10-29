'use strict';

function validatePreventiveCompletion(body = {}) {
  const result = String(body.resultado || '').trim();
  const hasPhoto = typeof body.foto === 'string' && body.foto.startsWith('data:image/');
  if (result.length < 5) return { ok: false, error: 'Documentá el resultado del preventivo' };
  if (!hasPhoto) return { ok: false, error: 'Adjuntá una fotografía como evidencia del preventivo' };
  if (body.foto.length > 3500000) return { ok: false, error: 'La fotografía supera el tamaño permitido' };
  return { ok: true };
}

module.exports = { validatePreventiveCompletion };

