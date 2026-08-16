  -- ============================================================================
  -- 008: 💬 Chat privado entre las partes de un match
  --
  -- Objetivo: conversaciones uno-a-uno entre las DOS personas de un match de
  -- matches_ia (dueño y rescatista), para coordinar el reencuentro sin exponer
  -- números de teléfono/correos en el feed.
  --
  -- Regla de habilitación (se valida en el SERVIDOR, lib/chat.ts):
  --   el chat queda disponible para ti cuando el OTRO lado de la coincidencia
  --   autorizó compartir su contacto (dueno_autorizo / encontrador_autorizo).
  --   En ese momento los botones "Compartir mi contacto" se convierten en
  --   "💬 Chatear". Una conversación tiene SIEMPRE un único match (unique).
  --
  -- Entrega en tiempo real: Supabase Realtime con BROADCAST por canal
  -- (chat-<match_id>). Los mensajes NUNCA viajan por el canal: el emisor hace
  -- un "ping" y el receptor recarga el hilo por la API con su sesión. Por eso
  -- NO se exponen llaves ni hacen falta políticas RLS de datos.
  --
  -- Las bases NUEVAS ya lo traen en supabase/schema.sql. Para bases
  -- EXISTENTES: EJECUTAR en Supabase Dashboard → SQL Editor → RUN
  -- (idempotente: se puede correr varias veces sin daño).
  -- ============================================================================

  -- ----------------------------------------------------------------------------
  -- 1. Conversaciones (una por match)
  -- ----------------------------------------------------------------------------
  create table if not exists public.conversaciones (
    id         uuid primary key default gen_random_uuid(),
    match_id   uuid not null references public.matches_ia (id) on delete cascade,
    creado_en  timestamptz not null default now(),
    unique (match_id)
  );

  -- ----------------------------------------------------------------------------
  -- 2. Mensajes
  -- ----------------------------------------------------------------------------
  create table if not exists public.mensajes (
    id              uuid primary key default gen_random_uuid(),
    conversacion_id uuid not null references public.conversaciones (id) on delete cascade,
    usuario_id      uuid not null references public.usuarios (id) on delete cascade,
    contenido       text not null check (char_length(contenido) between 1 and 2000),
    leida           boolean not null default false,
    creado_en       timestamptz not null default now()
  );

  create index if not exists mensajes_conversacion_idx on public.mensajes (conversacion_id, creado_en);
  create index if not exists mensajes_usuario_idx on public.mensajes (usuario_id);

  comment on column public.mensajes.leida
    is 'false = lo debe leer la otra parte (cada mensaje tiene un solo destinatario).';

  -- ----------------------------------------------------------------------------
  -- 3. RLS (blinda el acceso directo; la app accede por API con service role)
  -- ----------------------------------------------------------------------------
  alter table public.conversaciones enable row level security;
  alter table public.mensajes enable row level security;

  -- ----------------------------------------------------------------------------
  -- Verificación
  -- ----------------------------------------------------------------------------
  -- select c.id, c.match_id, m.contenido, m.leida, m.creado_en
  -- from public.conversaciones c
  -- join public.mensajes m on m.conversacion_id = c.id
  -- order by m.creado_en desc;