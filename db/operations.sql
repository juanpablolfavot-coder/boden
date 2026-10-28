-- BÖDEN MaintenanceOS v2: evolución aditiva, sin borrar datos existentes.
CREATE SEQUENCE IF NOT EXISTS equipo_codigo_seq;
CREATE SEQUENCE IF NOT EXISTS herramienta_codigo_seq;

CREATE TABLE IF NOT EXISTS equipos (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE DEFAULT ('EQ-' || LPAD(nextval('equipo_codigo_seq')::text, 5, '0')),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'otros',
  marca TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT '',
  serie TEXT NOT NULL DEFAULT '',
  sector TEXT NOT NULL DEFAULT '',
  ubicacion_id INTEGER REFERENCES ubicaciones(id),
  estado TEXT NOT NULL DEFAULT 'operativo' CHECK (estado IN ('operativo','mantenimiento','fuera_servicio','baja')),
  criticidad TEXT NOT NULL DEFAULT 'media' CHECK (criticidad IN ('alta','media','baja')),
  fecha_instalacion DATE,
  garantia_hasta DATE,
  descripcion TEXT NOT NULL DEFAULT '',
  created_by INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_equipos_estado ON equipos(estado);
CREATE INDEX IF NOT EXISTS idx_equipos_tipo ON equipos(tipo);

CREATE TABLE IF NOT EXISTS preventivos (
  id BIGSERIAL PRIMARY KEY,
  equipo_id BIGINT NOT NULL REFERENCES equipos(id),
  titulo TEXT NOT NULL,
  instrucciones TEXT NOT NULL DEFAULT '',
  frecuencia_dias INTEGER NOT NULL CHECK(frecuencia_dias > 0 AND frecuencia_dias <= 3650),
  proxima_fecha DATE NOT NULL,
  ultimo_realizado TIMESTAMPTZ,
  responsable_id INTEGER REFERENCES usuarios(id),
  activo BOOLEAN NOT NULL DEFAULT true,
  created_by INTEGER REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_preventivos_fecha ON preventivos(proxima_fecha) WHERE activo = true;

-- Plan anual del hotel. Es independiente del inventario: no obliga a inventar
-- equipos y cada ejecución mensual se controla mediante una alerta operativa.
CREATE TABLE IF NOT EXISTS mantenimiento_anual (
  id BIGSERIAL PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  meses SMALLINT[] NOT NULL,
  instrucciones TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (cardinality(meses) > 0),
  CHECK (meses <@ ARRAY[1,2,3,4,5,6,7,8,9,10,11,12]::SMALLINT[])
);

CREATE TABLE IF NOT EXISTS mantenimiento_anual_ejecuciones (
  id BIGSERIAL PRIMARY KEY,
  plan_id BIGINT NOT NULL REFERENCES mantenimiento_anual(id) ON DELETE CASCADE,
  anio INTEGER NOT NULL CHECK (anio BETWEEN 2020 AND 2200),
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  alerta_id INTEGER REFERENCES alertas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(plan_id, anio, mes)
);
CREATE INDEX IF NOT EXISTS idx_mantenimiento_anual_periodo ON mantenimiento_anual_ejecuciones(anio,mes);

CREATE TABLE IF NOT EXISTS trabajos (
  id BIGSERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'correctivo' CHECK(tipo IN ('correctivo','preventivo','inspeccion','mejora','emergencia')),
  estado TEXT NOT NULL DEFAULT 'realizado' CHECK(estado IN ('pendiente','en_curso','realizado')),
  equipo_id BIGINT REFERENCES equipos(id),
  alerta_id INTEGER REFERENCES alertas(id),
  preventivo_id BIGINT REFERENCES preventivos(id),
  tecnico_id INTEGER NOT NULL REFERENCES usuarios(id),
  fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
  duracion_min INTEGER NOT NULL DEFAULT 0 CHECK(duracion_min BETWEEN 0 AND 14400),
  resultado TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trabajos_fecha ON trabajos(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_trabajos_equipo ON trabajos(equipo_id);

CREATE TABLE IF NOT EXISTS repuestos (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT UNIQUE,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'General',
  unidad TEXT NOT NULL DEFAULT 'unidad',
  cantidad NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  minimo NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (minimo >= 0),
  ubicacion TEXT NOT NULL DEFAULT '',
  proveedor TEXT NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repuestos_bajo ON repuestos(cantidad,minimo);

CREATE TABLE IF NOT EXISTS movimientos_stock (
  id BIGSERIAL PRIMARY KEY,
  repuesto_id BIGINT NOT NULL REFERENCES repuestos(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('entrada','salida','ajuste_positivo','ajuste_negativo')),
  cantidad NUMERIC(12,2) NOT NULL CHECK (cantidad > 0),
  saldo NUMERIC(12,2) NOT NULL,
  trabajo_id BIGINT REFERENCES trabajos(id),
  equipo_id BIGINT REFERENCES equipos(id),
  motivo TEXT NOT NULL DEFAULT '',
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mov_stock_fecha ON movimientos_stock(created_at DESC);

CREATE TABLE IF NOT EXISTS herramientas (
  id BIGSERIAL PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE DEFAULT ('HT-' || LPAD(nextval('herramienta_codigo_seq')::text, 5, '0')),
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Herramienta general',
  marca TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT '',
  serie TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'disponible'
    CHECK(estado IN ('disponible','prestada','mantenimiento','baja')),
  condicion TEXT NOT NULL DEFAULT 'buena' CHECK(condicion IN ('excelente','buena','regular','deficiente')),
  ubicacion TEXT NOT NULL DEFAULT '',
  observaciones TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS prestamos_herramientas (
  id BIGSERIAL PRIMARY KEY,
  herramienta_id BIGINT NOT NULL REFERENCES herramientas(id),
  tecnico_id INTEGER NOT NULL REFERENCES usuarios(id),
  entregado_por INTEGER NOT NULL REFERENCES usuarios(id),
  prestado_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  devuelto_at TIMESTAMPTZ,
  recibido_por INTEGER REFERENCES usuarios(id),
  observaciones TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_prestamo_abierto ON prestamos_herramientas(herramienta_id) WHERE devuelto_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prestamos_usuario ON prestamos_herramientas(tecnico_id, prestado_at DESC);

