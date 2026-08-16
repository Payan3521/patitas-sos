-- ============================================================================
-- 🐾 PATITAS SOS — Migración 004: LOGIN PROPIO (email + contraseña)
--
-- Elimina la dependencia de Supabase Auth (OTP por correo) para el inicio de
-- sesión: ya no hay rate limiting que bloquee, ni correos OTP del proveedor
-- integrado. Cada usuario tiene su contraseña guardada (hash scrypt) en la
-- tabla `usuarios`.
--
-- CÓMO USARLO:
--   1) Supabase Dashboard → "SQL Editor" → pega este script → RUN.
--   2) Quien ya haya publicado con su correo (pablo, sebas, etc.) se registra
--      con el MISMO correo en /registrarse y ahí asigna su contraseña
--      ("reclamar cuenta"): el script usa un único UPDATE con la nueva
--      columna, así que no se requieren más pasos.
--
-- Nota: la columna auth_uid (Supabase Auth) queda abandonada pero no duele;
-- el código nuevo ya no la usa. La llave maestra de Supabase (service role)
-- SIGUE usándose para la base de datos y Storage (la app escribe siempre
-- desde las API Routes del servidor).
-- ============================================================================

-- 1) Columna para la contraseña (hash scrypt generado en /api/registro).
alter table public.usuarios add column if not exists password_hash text;

-- 2) Verificación: debe listar password_hash.
select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'usuarios'
  order by ordinal_position;