-- BODEN Hotel & Spa - esquema de base de datos
-- Todo con IF NOT EXISTS: es seguro correrlo en cada arranque.

CREATE TABLE IF NOT EXISTS usuarios (
  id            SERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  rol           TEXT NOT NULL DEFAULT 'personal',
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ubicaciones (
  id      SERIAL PRIMARY KEY,
  tipo    TEXT NOT NULL DEFAULT 'habitacion', -- habitacion | area | equipo
  nombre  TEXT NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS categorias (
  id      SERIAL PRIMARY KEY,
  nombre  TEXT NOT NULL,
  activo  BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS alertas (
  id            SERIAL PRIMARY KEY,
  numero        INTEGER NOT NULL,
  titulo        TEXT NOT NULL,
  descripcion   TEXT,
  categoria_id  INTEGER REFERENCES categorias(id),
  ubicacion_id  INTEGER REFERENCES ubicaciones(id),
  prioridad     TEXT NOT NULL DEFAULT 'media',  -- urgente | alta | media | baja
  estado        TEXT NOT NULL DEFAULT 'nueva',  -- nueva | asignada | en_proceso | resuelta | cerrada | cancelada
  reportado_por INTEGER REFERENCES usuarios(id),
  asignado_a    INTEGER REFERENCES usuarios(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tomada_at     TIMESTAMPTZ,
  resuelta_at   TIMESTAMPTZ,
  cerrada_at    TIMESTAMPTZ
);

-- Secuencia para el código BODEN-0001
CREATE SEQUENCE IF NOT EXISTS alerta_numero_seq START 1;

CREATE TABLE IF NOT EXISTS alerta_historial (
  id         SERIAL PRIMARY KEY,
  alerta_id  INTEGER NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
  evento     TEXT NOT NULL,
  usuario_id INTEGER REFERENCES usuarios(id),
  nota       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS adjuntos (
  id         SERIAL PRIMARY KEY,
  alerta_id  INTEGER NOT NULL REFERENCES alertas(id) ON DELETE CASCADE,
  url        TEXT NOT NULL,
  tipo       TEXT NOT NULL DEFAULT 'problema', -- problema | solucion
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  endpoint   TEXT UNIQUE NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alertas_estado    ON alertas(estado);
CREATE INDEX IF NOT EXISTS idx_alertas_asignado  ON alertas(asignado_a);
CREATE INDEX IF NOT EXISTS idx_hist_alerta       ON alerta_historial(alerta_id);
