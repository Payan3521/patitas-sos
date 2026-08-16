-- ============================================================================
-- 007: Privacidad — consentimiento para compartir datos de contacto
--
-- Objetivo: los datos personales (nombre, teléfono, correo, barrio) NO se
-- exponen nunca de forma automática. Cada parte de un match autoriza por
-- separado compartir SUS propios datos con la contraparte; recién entonces
-- la otra parte los ve (en la web) y recibe un correo con ellos.
--
--  - matches_ia.dueno_autorizo       → el dueño (reporte PERDIDO) autorizó
--  - matches_ia.encontrador_autorizo → el rescatista (BUSCA_DUEÑO) autorizó
--  - tabla consentimientos           → auditoría de cada autorización
--    (quién, cuándo, para qué match y qué versión de política aceptó)
--
-- Las bases NUEVAS ya lo traen en supabase/schema.sql. Para bases
-- EXISTENTES: EJECUTAR en Supabase Dashboard → SQL Editor → RUN
-- (idempotente: se puede correr varias veces sin daño).
-- ============================================================================

alter table public.matches_ia
  add column if not exists dueno_autorizo boolean not null default false,
  add column if not exists encontrador_autorizo boolean not null default false;

comment on column public.matches_ia.dueno_autorizo
  is 'El dueño (reporte PERDIDO) autorizó compartir sus datos de contacto con la contraparte.';
comment on column public.matches_ia.encontrador_autorizo
  is 'El rescatista (reporte BUSCA_DUEÑO) autorizó compartir sus datos de contacto con la contraparte.';

-- ----------------------------------------------------------------------------
-- Auditoría de consentimientos
-- ----------------------------------------------------------------------------
create table if not exists public.consentimientos (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references public.matches_ia (id) on delete cascade,
  usuario_id      uuid not null references public.usuarios (id) on delete cascade,
  lado            text not null check (lado in ('dueno', 'encontrador')),
  tipo            text not null default 'compartir_contacto',
  texto_aceptado  text,
  creado_en       timestamptz not null default now(),
  unique (match_id, usuario_id, lado, tipo)
);

create index if not exists consentimientos_match_idx on public.consentimientos (match_id);
create index if not exists consentimientos_usuario_idx on public.consentimientos (usuario_id);

alter table public.consentimientos enable row level security;

-- ----------------------------------------------------------------------------
-- Verificación
-- ----------------------------------------------------------------------------
-- select m.perrito_perdido_id, m.perrito_encontrado_id, m.dueno_autorizo,
--        m.encontrador_autorizo, c.lado, c.creado_en
-- from public.matches_ia m
-- left join public.consentimientos c on c.match_id = m.id
-- order by c.creado_en desc;