-- ============================================================================
-- 🐾 PATITAS SOS — Migración 009: 👀 AVISOS DE TESTIGOS ("Vi esta mascota")
--
-- Cualquier persona (SIN cuenta) que ve una publicación puede avisarle a su
-- dueño con un mensaje predefinido. Si el dueño responde, se abre un mini-chat
-- en la app; el testigo entra con su enlace privado (token HMAC, sin sesión).
--
-- Privacidad + anti-spam:
--   - El testigo es anónimo: su identidad es un UUID en cookie, guardado aquí
--     solo como HMAC (nadie puede leerlo si la BD se filtra).
--   - Un aviso por (publicación + navegador) y tope diario por publicación.
--   - El dueño puede DESACTIVAR los avisos (botón 🔕): se crean avisos nuevos
--     y el testigo no puede escribir más; el dueño sí puede leer/responder.
--
-- El mensaje inicial del aviso vive como primera fila de `mensajes_aviso`
-- (autor 'avisador'): así el hilo es una sola fuente de verdad.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. El dueño puede desactivar los avisos de una publicación (botón 🔕)
-- ----------------------------------------------------------------------------
alter table public.perritos add column if not exists avisos_habilitados boolean not null default true;

-- ----------------------------------------------------------------------------
-- 2. Tabla: avistamientos  (hilo entre un testigo anónimo y el dueño)
-- ----------------------------------------------------------------------------
create table if not exists public.avistamientos (
  id             uuid primary key default gen_random_uuid(),
  perrito_id     uuid not null references public.perritos (id) on delete cascade,
  -- HMAC-SHA256 del UUID del navegador del testigo (identidad sin cuenta).
  avisador_hash  text not null,
  creado_en      timestamptz not null default now()
);

create index if not exists avistamientos_perrito_idx  on public.avistamientos (perrito_id, creado_en desc);
create index if not exists avistamientos_avisador_idx on public.avistamientos (avisador_hash);

-- ----------------------------------------------------------------------------
-- 3. Tabla: mensajes_aviso  (los mensajes del hilo)
--    autor: 'dueño' (sesión iniciada) | 'avisador' (token del enlace privado)
--    leida: para el conteo del 🔔 del dueño (autor='avisador' sin leer).
-- ----------------------------------------------------------------------------
create table if not exists public.mensajes_aviso (
  id              uuid primary key default gen_random_uuid(),
  avistamiento_id uuid not null references public.avistamientos (id) on delete cascade,
  autor           text not null check (autor in ('dueño', 'avisador')),
  contenido       text not null check (char_length(contenido) between 1 and 2000),
  leida           boolean not null default false,
  creado_en       timestamptz not null default now()
);

create index if not exists mensajes_aviso_avistamiento_idx on public.mensajes_aviso (avistamiento_id, creado_en);

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (la app escribe con la service role key; estas
--    políticas blindan el acceso directo. Los hilos solo se leen con el
--    token del enlace privado o la sesión del dueño, siempre vía API).
-- ----------------------------------------------------------------------------
alter table public.avistamientos  enable row level security;
alter table public.mensajes_aviso enable row level security;