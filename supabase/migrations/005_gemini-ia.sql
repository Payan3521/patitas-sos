-- ============================================================================
-- 🐾 PATITAS SOS — Migración 005: IA con Gemini Flash
--
-- Reemplaza el motor de coincidencias de AWS Rekognition por Gemini Flash:
--   1) Tabla `comparaciones`: historial de pares ya comparados por la IA
--      (evita repetir llamadas a Gemini y sirve de dedupe entre direcciones).
--   2) Columna `matches_ia.razon`: explicación del modelo sobre el match.
--   3) Programación de la revisión diaria (pg_cron → POST /api/revisar-coincidencias).
--
-- CÓMO APLICARLO:
--   Supabase Dashboard → SQL Editor → pega este script → RUN.
--   (pg_cron y pg_net ya vienen disponibles en Supabase.)
--   Luego, si NO programas el cron desde el dashboard (Settings → Integrations),
--   descomenta el bloque final de este script y cambia los valores:
--      - TU-APP_URL  → la URL pública de la app (ej: https://patitas.tudominio.co)
--      - TU-CRON-SECRET → el mismo valor de la variable CRON_SECRET del servidor
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Tabla: comparaciones (pares analizados por Gemini)
-- ----------------------------------------------------------------------------
create table if not exists public.comparaciones (
  id              uuid primary key default gen_random_uuid(),
  -- Par canónico (orden alfabético de ids): (A,B) y (B,A) son la misma comparación
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

alter table public.comparaciones enable row level security;

-- ----------------------------------------------------------------------------
-- 2. Columna: matches_ia.razon (por qué Gemini consideró que es el mismo animal)
-- ----------------------------------------------------------------------------
alter table public.matches_ia add column if not exists razon text;

-- ----------------------------------------------------------------------------
-- 3. Revisión diaria automática (Opcional: o se programa en el dashboard)
--    En Supabase → Settings → Integrations habilita "Cron" y "HTTP Request"…
--    o descomenta lo siguiente (¡cámbiale los valores placeholders!):
-- ----------------------------------------------------------------------------
-- create extension if not exists pg_cron;
-- create extension if not exists pg_net;
--
-- select cron.schedule(
--   'patitas-revision-diaria',
--   '0 7 * * *',  -- todos los días a las 7:00 a.m. (hora servidor)
--   $$
--   select net.http_post(
--     url := 'https://TU-APP_URL/api/revisar-coincidencias',
--     headers := '{"content-type":"application/json","x-cron-secret":"TU-CRON-SECRET"}'::jsonb
--   )
--   $$
-- );

-- ----------------------------------------------------------------------------
-- 4. Consulta de diagnóstico: últimas comparaciones con su dictamen
-- ----------------------------------------------------------------------------
-- select c.*, pa.nombre_temporal as a, pb.nombre_temporal as b
-- from public.comparaciones c
-- join public.perritos pa on pa.id = c.perrito_a_id
-- join public.perritos pb on pb.id = c.perrito_b_id
-- order by c.creado_en desc limit 20;