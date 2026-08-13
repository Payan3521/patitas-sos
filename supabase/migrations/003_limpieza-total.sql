-- ============================================================================
-- 🐾 PATITAS SOS — Migración 003: LIMPIEZA TOTAL (probar desde cero)
--
-- ⚠️  ESTE SCRIPT BORRA TODO: datos, tablas, enums y fotos del bucket.
-- ⚠️  Solo úsalo si quieres empezar de cero (pruebas).
--
-- CÓMO USARLO:
--   1) Supabase Dashboard → "SQL Editor" → pega este script → RUN.
--   2) Vacía también las caras de la colección de AWS Rekognition
--      (la política IAM actual NO permite delete-collection; usa delete-faces):
--        FACE_IDS=$(aws rekognition list-faces --collection-id perritos \
--          --region us-east-1 --max-results 100 --query "Faces[].FaceId" --output text)
--        [ -n "$FACE_IDS" ] && aws rekognition delete-faces --collection-id perritos \
--          --region us-east-1 --face-ids $FACE_IDS
--
-- El script es AUTOCONTENIDO: borra todo y recrea el esquema actual completo.
--
-- ⚠️  LAS FOTOS DEL BUCKET NO SE BORRAN DESDE AQUÍ:
--     Supabase bloquea el borrado directo de storage.objects y el ALTER de su
--     tabla desde el SQL Editor (errores 42501). Las fotos se vacían con la
--     Storage API (ver README → "Empezar desde cero"):
--       DELETE /storage/v1/bucket/fotos-perritos   (borra bucket y objetos)
--       POST   /storage/v1/bucket                  (recrearlo: id y public)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. BORRAR TODO (tablas, enums, políticas y fotos del bucket)
-- ----------------------------------------------------------------------------
drop table if exists public.matches_ia cascade;
drop table if exists public.perritos cascade;
drop table if exists public.usuarios cascade;

drop type if exists public.rol_publicacion cascade;
drop type if exists public.estado_perrito cascade;

-- Las fotos del bucket público NO se vacían desde SQL (Supabase lo bloquea
-- con el trigger protect_delete y el ALTER de storage.objects no está
-- permitido para el rol del SQL Editor). Vacíalas con la Storage API:
--   DELETE /storage/v1/bucket/fotos-perritos  →  POST /storage/v1/bucket
-- (misma config: id "fotos-perritos", public true). Ver README.

-- OJO: NO hacer `drop policy` sobre public.perritos AQUÍ. El SQL Editor corre
-- el script en una sola transacción: las drop table de arriba ya borraron la
-- tabla (y sus policies RLS via cascade), y `drop policy if exists ... on
-- public.perritos` fallaría con 42P01 porque la tabla ya no existe en la txn.
-- La tabla storage.objects nunca se borra, así que su policy sí se puede
-- dropear/recrear con seguridad.
drop policy if exists "fotos_perritos_lectura_publica" on storage.objects;

-- ----------------------------------------------------------------------------
-- 2. ESQUEMA NUEVO (mismo contenido de supabase/schema.sql)
-- ----------------------------------------------------------------------------

-- 2.1. Tipos ENUM
create type public.rol_publicacion as enum ('BUSCA_DUEÑO', 'PERDIDO');
create type public.estado_perrito as enum ('ACTIVO', 'ENCONTRADA', 'RECONCILIADO');

-- 2.2. Tabla: usuarios
create table if not exists public.usuarios (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  email      text,
  telefono   text not null,
  creado_en  timestamptz not null default now()
);

-- 2.3. Tabla: perritos
create table if not exists public.perritos (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references public.usuarios (id) on delete cascade,
  rol_publicacion  public.rol_publicacion not null,
  nombre_temporal  text,
  descripcion      text not null,
  departamento     text not null,
  ciudad           text not null,
  barrio_zona      text,
  foto_url         text not null,
  aws_face_id      varchar(128) unique,
  estado           public.estado_perrito not null default 'ACTIVO',
  creado_en        timestamptz not null default now()
);

create index if not exists perritos_estado_creado_idx on public.perritos (estado, creado_en desc);
create index if not exists perritos_estado_rol_idx   on public.perritos (estado, rol_publicacion);
create index if not exists perritos_ciudad_idx      on public.perritos (ciudad);
create index if not exists perritos_departamento_idx on public.perritos (departamento);
create index if not exists perritos_rol_idx         on public.perritos (rol_publicacion);
create index if not exists perritos_aws_face_id_idx on public.perritos (aws_face_id);

-- 2.4. Tabla: matches_ia (coincidencias encontradas por AWS Rekognition)
create table if not exists public.matches_ia (
  id                    uuid primary key default gen_random_uuid(),
  perrito_perdido_id    uuid not null references public.perritos (id) on delete cascade,
  perrito_encontrado_id uuid not null references public.perritos (id) on delete cascade,
  porcentaje_similitud  real not null check (porcentaje_similitud between 0 and 100),
  notificados           boolean not null default false,
  creado_en             timestamptz not null default now(),
  unique (perrito_perdido_id, perrito_encontrado_id)
);

create index if not exists matches_ia_perdido_idx    on public.matches_ia (perrito_perdido_id);
create index if not exists matches_ia_encontrado_idx on public.matches_ia (perrito_encontrado_id);

-- 2.5. Row Level Security (RLS)
--    La app escribe SIEMPRE desde las API Routes usando la service role key
--    (que salta la RLS). Estas políticas solo blindan el acceso directo.
alter table public.usuarios   enable row level security;
alter table public.perritos   enable row level security;
alter table public.matches_ia enable row level security;

-- Lectura pública del feed: reportes ACTIVOS y marcados como ENCONTRADA.
create policy "perritos_lectura_publica" on public.perritos
  for select using (estado in ('ACTIVO', 'ENCONTRADA'));

-- 2.6. Storage: bucket público "fotos-perritos"
--    (Si el bucket no existe: Storage → New bucket → name: fotos-perritos
--     → marcar "Public bucket" → Create.)
create policy "fotos_perritos_lectura_publica" on storage.objects
  for select using (bucket_id = 'fotos-perritos');

-- ----------------------------------------------------------------------------
-- 3. VERIFICACIÓN (debe devolver 0 filas y el enum con 3 valores)
-- ----------------------------------------------------------------------------
select 'usuarios' as tabla, count(*) from public.usuarios
union all select 'perritos', count(*) from public.perritos
union all select 'matches_ia', count(*) from public.matches_ia;

select enumlabel from pg_enum e
  join pg_type t on t.oid = e.enumtypid
  where t.typname = 'estado_perrito'
  order by enumsortorder;

select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'perritos'
  order by ordinal_position;
