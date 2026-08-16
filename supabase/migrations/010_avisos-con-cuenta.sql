-- ============================================================================
-- 🐾 PATITAS SOS — Migración 010: 👀 AVISOS CON CUENTA OBLIGATORIA
--
-- Cambia el flujo de avisos "Vi esta mascota" de anónimo (cookie + HMAC +
-- enlace privado con token) a CUENTA obligatoria:
--
--   1. `avistamientos.avisador_hash` (Huella HMAC del navegador) se reemplaza
--      por `usuario_id` (el testigo logueado). Quien avisa debe iniciar
--      sesión; así SIEMPRE puede volver a su hilo desde "Mis avisos".
--   2. `mensajes_aviso.leida` pasa a significar "leída por el dueño" y se
--      agrega `leida_avisador` (leída por el testigo): ambos lados ven sus
--      no leídas en el contador del 🔔.
--
-- El resto de reglas se mantienen: primer mensaje predefinido (anti-spam),
-- tope diario por publicación, dueño no puede avisarse a sí mismo, y el
-- botón 🔕 desactiva avisos nuevos (visible solo para el dueño).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. avistamientos: identidad del testigo = usuario de la app (no HMAC)
-- ----------------------------------------------------------------------------
alter table public.avistamientos
  add column if not exists usuario_id uuid references public.usuarios (id) on delete cascade;

-- Elimina la huella del navegador (ya no existe el enlace privado ?t=).
alter table public.avistamientos drop column if exists avisador_hash;

create index if not exists avistamientos_usuario_idx on public.avistamientos (usuario_id, creado_en desc);
drop index if exists avistamientos_avisador_idx;

-- Dedupe: un aviso por (publicación + testigo) → reutiliza el hilo.
create unique index if not exists avistamientos_perrito_usuario_idx
  on public.avistamientos (perrito_id, usuario_id)
  where usuario_id is not null;

-- ----------------------------------------------------------------------------
-- 2. mensajes_aviso: leídas bidireccionales
--    leida          = leída por el DUEÑO   (autor='avisador' pendiente)
--    leida_avisador = leída por el TESTIGO (autor='dueño' pendiente)
-- ----------------------------------------------------------------------------
alter table public.mensajes_aviso
  add column if not exists leida_avisador boolean not null default false;