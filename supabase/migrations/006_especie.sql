-- ============================================================================
-- 006: Tipo de mascota (perro / gato) en las publicaciones
-- Las bases NUEVAS ya lo traen en supabase/schema.sql. Este script es para
-- bases EXISTENTES: añade la columna con default 'perro' (los reportes viejos
-- quedan como perro, sin perder nada).
--
-- EJECUTAR en: Supabase Dashboard → SQL Editor → RUN
-- ============================================================================

alter table public.perritos
  add column if not exists especie text not null default 'perro'
  check (especie in ('perro', 'gato'));

comment on column public.perritos.especie
  is 'Tipo de mascota del reporte: perro (default) o gato.';