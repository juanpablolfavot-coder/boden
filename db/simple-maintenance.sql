-- Migración aditiva: no elimina ni transforma registros existentes.
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS equipo_id BIGINT REFERENCES equipos(id);
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS vence_at TIMESTAMPTZ;
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS verificada_por INTEGER REFERENCES usuarios(id);
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS verificada_at TIMESTAMPTZ;
ALTER TABLE alertas ADD COLUMN IF NOT EXISTS verificacion_nota TEXT;
CREATE INDEX IF NOT EXISTS idx_alertas_vence_abiertas ON alertas(vence_at) WHERE estado NOT IN ('cerrada','cancelada');
CREATE TABLE IF NOT EXISTS notificaciones (
 id BIGSERIAL PRIMARY KEY, usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 clave TEXT, titulo TEXT NOT NULL, cuerpo TEXT NOT NULL DEFAULT '', url TEXT NOT NULL DEFAULT '/',
 leida_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notificaciones_clave_usuario ON notificaciones(usuario_id,clave) WHERE clave IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario_fecha ON notificaciones(usuario_id,created_at DESC);
CREATE TABLE IF NOT EXISTS auditoria (
 id BIGSERIAL PRIMARY KEY, entidad TEXT NOT NULL, entidad_id TEXT NOT NULL, accion TEXT NOT NULL,
 usuario_id INTEGER REFERENCES usuarios(id), detalle JSONB NOT NULL DEFAULT '{}'::jsonb,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad,entidad_id,created_at DESC);
