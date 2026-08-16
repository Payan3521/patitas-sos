-- ============================================================================
-- 🐾 PATITAS SOS — Esquema de base de datos para Supabase (PostgreSQL)
-- Plataforma de ayuda humanitaria post-terremoto:
-- conecta a dueños que perdieron a sus perritos con quienes los rescataron.
--
-- CÓMO USARLO:
--   1) Supabase Dashboard → "SQL Editor" → pega este script → RUN.
--   2) Crea el bucket público "fotos-perritos":
--        Storage → New bucket → Name: fotos-perritos → marcar "Public bucket" → Create
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tipos ENUM
-- ----------------------------------------------------------------------------
create type public.rol_publicacion as enum ('BUSCA_DUEÑO', 'PERDIDO');
create type public.estado_perrito as enum ('ACTIVO', 'ENCONTRADA', 'RECONCILIADO');

-- ----------------------------------------------------------------------------
-- 2. Tabla: usuarios
-- ----------------------------------------------------------------------------
create table if not exists public.usuarios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  email      text,
  telefono   text not null,
  creado_en  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. Tabla: perritos
-- ----------------------------------------------------------------------------
create table if not exists public.perritos (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.usuarios (id) on delete cascade,
  rol_publicacion  public.rol_publicacion not null,
  especie          text not null default 'perro' check (especie in ('perro', 'gato')),
  nombre_temporal  text,
  descripcion      text not null,
  departamento     text not null,
  ciudad           text not null,
  barrio_zona      text,
  foto_url         text not null,
  aws_face_id      varchar(128) unique,  -- DEPRECADA (era AWS Rekognition); se conserva por datos viejos
  estado           public.estado_perrito not null default 'ACTIVO',
  creado_en        timestamptz not null default now()
);

create index if not exists perritos_estado_creado_idx on public.perritos (estado, creado_en desc);
create index if not exists perritos_estado_rol_idx   on public.perritos (estado, rol_publicacion);
create index if not exists perritos_ciudad_idx      on public.perritos (ciudad);
create index if not exists perritos_departamento_idx on public.perritos (departamento);
create index if not exists perritos_rol_idx         on public.perritos (rol_publicacion);
create index if not exists perritos_aws_face_id_idx on public.perritos (aws_face_id);

-- ----------------------------------------------------------------------------
-- 4. Tabla: matches_ia  (coincidencias encontradas por la IA — Gemini Flash)
-- ----------------------------------------------------------------------------
create table if not exists public.matches_ia (
  id                    uuid primary key default gen_random_uuid(),
  perrito_perdido_id    uuid not null references public.perritos (id) on delete cascade,
  perrito_encontrado_id uuid not null references public.perritos (id) on delete cascade,
  porcentaje_similitud  real not null check (porcentaje_similitud between 0 and 100),
  notificados           boolean not null default false,
  razon                 text,
  creado_en             timestamptz not null default now(),
  unique (perrito_perdido_id, perrito_encontrado_id)
);

create index if not exists matches_ia_perdido_idx    on public.matches_ia (perrito_perdido_id);
create index if not exists matches_ia_encontrado_idx on public.matches_ia (perrito_encontrado_id);

-- ----------------------------------------------------------------------------
-- 4.1 Tabla: comparaciones  (pares ya analizados por la IA — Gemini Flash)
--     El par se guarda en orden canónico (ids alfabéticos): (A,B) y (B,A)
--     son la misma comparación, así el cron/re-publicaciones no llaman a
--     Gemini dos veces por el mismo par.
-- ----------------------------------------------------------------------------
create table if not exists public.comparaciones (
  id              uuid primary key default gen_random_uuid(),
  perrito_a_id    uuid not null references public.perritos (id) on delete cascade,
  perrito_b_id    uuid not null references public.perritos (id) on delete cascade,
  es_mismo        boolean not null default false,
  similitud       real not null check (similitud between 0 and 100),
  razon           text,
  creado_en       timestamptz not null default now(),
  unique (perrito_a_id, perrito_b_id)
);

create index if not exists comparaciones_a_idx on public.comparaciones (perrito_a_id);
create index if not exists comparaciones_b_idx on public.comparaciones (perrito_b_id);

-- ----------------------------------------------------------------------------
-- 5. Row Level Security (RLS)
--    La app escribe SIEMPRE desde las API Routes usando la service role key
--    (que salta la RLS). Estas políticas solo blindan el acceso directo.
-- ----------------------------------------------------------------------------
alter table public.usuarios   enable row level security;
alter table public.perritos   enable row level security;
alter table public.matches_ia enable row level security;
alter table public.comparaciones enable row level security;

-- Lectura pública del feed: reportes ACTIVOS y marcados como ENCONTRADA.
-- (Los datos de contacto se sirven vía API con la service role key.)
create policy "perritos_lectura_publica" on public.perritos
  for select using (estado in ('ACTIVO', 'ENCONTRADA'));

-- ----------------------------------------------------------------------------
-- 6. Storage: bucket público "fotos-perritos"
--    (Crea el bucket desde el Dashboard ANTES o DESPUÉS de este script;
--     la política aplica en cuanto exista.)
--    Las subidas se hacen desde el servidor con la service role key.
-- ----------------------------------------------------------------------------
create policy "fotos_perritos_lectura_publica" on storage.objects
  for select using (bucket_id = 'fotos-perritos');

-- ----------------------------------------------------------------------------
-- 7. Consultas útiles de diagnóstico
-- ----------------------------------------------------------------------------
-- Ver coincidencias encontradas por la IA:
--   select * from public.matches_ia order by creado_en desc;
--
-- Ver reportes activos con su contacto:
--   select p.*, u.nombre, u.telefono from public.perritos p
--   join public.usuarios u on u.id = p.usuario_id
--   where p.estado = 'ACTIVO' order by p.creado_en desc;
