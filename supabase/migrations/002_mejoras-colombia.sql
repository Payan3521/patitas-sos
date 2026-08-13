-- ============================================================================
-- 🐾 PATITAS SOS — Migración 002: Mejoras Colombia
--
-- Ejecutar SOLO si ya existía la base con el esquema 001:
--   Supabase Dashboard → SQL Editor → pega este script → RUN
--
-- Cambios:
--   1. Nuevo estado ENCONTRADA (el dueño decide; ya no se auto-reconcilia).
--   2. Columna perritos.departamento (filtros por departamento + municipio).
--   3. matches_ia.notificados: evita reenviar correos del mismo par.
--   4. RLS: permite leer también los reportes marcados como ENCONTRADA.
-- ============================================================================

-- 1) Estado ENCONTRADA (PostgreSQL no permite ALTER TYPE ... ADD VALUE en txn,
--    así que se corre fuera de transacción; ejecutar este script como tal).
alter type public.estado_perrito add value if not exists 'ENCONTRADA';

-- Los reportes que antes se auto-reconciliaban pasan a ENCONTRADA.
update public.perritos set estado = 'ENCONTRADA' where estado = 'RECONCILIADO';

-- 2) Departamento (los reportes viejos quedan sin departamento: se completan
--    re-publicando o manualmente).
alter table public.perritos add column if not exists departamento text not null default '';

-- 3) Marcador de notificación por correo.
alter table public.matches_ia add column if not exists notificados boolean not null default false;

-- 4) Índices para las categorías del home y filtros.
create index if not exists perritos_estado_rol_idx    on public.perritos (estado, rol_publicacion);
create index if not exists perritos_departamento_idx on public.perritos (departamento);

-- 5) RLS: leer también los ENCONTRADA.
drop policy if exists "perritos_lectura_publica" on public.perritos;
create policy "perritos_lectura_publica" on public.perritos
  for select using (estado in ('ACTIVO', 'ENCONTRADA'));
