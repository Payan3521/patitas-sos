// ============================================================
// 🐾 PATITAS SOS — /api/mensajes/[id]
//
// GET : el hilo de una conversación (últimos 200 mensajes, asc).
//       Valida que el usuario sea una de las dos partes del par.
// POST: marca como leídos los mensajes del otro lado.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { contrapartePublica, ladoDelUsuario, ULTIMOS_MENSAJES } from '@/lib/chat';
import { createServerSupabase } from '@/lib/supabase-server';
import type { HiloResponse, Mensaje, Perrito } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

type Contexto = { params: Promise<{ id: string }> };

async function sesionYConversacion(request: NextRequest, params: { id: string }) {
  const sesion = leerSesion(request);
  if (!sesion?.email) return { error: json({ ok: false, error: 'Debes iniciar sesión.' }, 401) };

  const supabase = createServerSupabase();
  const { data: conversacion } = await supabase
    .from('conversaciones')
    .select('id, match_id')
    .eq('id', params.id)
    .maybeSingle();
  if (!conversacion) return { error: json({ ok: false, error: 'Esta conversación ya no existe.' }, 404) };

  const { data: miUsuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase())
    .maybeSingle();
  if (!miUsuario) return { error: json({ ok: false, error: 'Tu cuenta no está disponible.' }, 404) };

  return { supabase, conversacion, miUsuario };
}

export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params;
  const ctx = await sesionYConversacion(request, { id });
  if ('error' in ctx) return ctx.error;
  const { supabase, conversacion, miUsuario } = ctx;

  const { data: match } = await supabase
    .from('matches_ia')
    .select('id, perrito_perdido_id, perrito_encontrado_id, porcentaje_similitud, dueno_autorizo, encontrador_autorizo')
    .eq('id', conversacion.match_id)
    .maybeSingle();
  if (!match) return json({ ok: false, error: 'La coincidencia ya no existe.' }, 404);

  const ids = [match.perrito_perdido_id, match.perrito_encontrado_id];
  const { data: perritos } = await supabase
    .from('perritos')
    .select('id, usuario_id, nombre_temporal, foto_url, rol_publicacion, especie, estado')
    .in('id', ids);
  const perdido = (perritos ?? []).find((p) => p.id === match.perrito_perdido_id) as Perrito | undefined;
  const encontrado = (perritos ?? []).find((p) => p.id === match.perrito_encontrado_id) as Perrito | undefined;
  if (!perdido || !encontrado) return json({ ok: false, error: 'Las publicaciones de la conversación ya no existen.' }, 404);

  const miLado = ladoDelUsuario(perdido, encontrado, miUsuario.id);
  if (!miLado) return json({ ok: false, error: 'No participas en esta conversación.' }, 403);

  const contrapartePerrito = miLado === 'dueno' ? encontrado : perdido;

  const { data: mensajes } = await supabase
    .from('mensajes')
    .select('id, conversacion_id, usuario_id, contenido, leida, creado_en')
    .eq('conversacion_id', id)
    .order('creado_en', { ascending: true })
    .limit(ULTIMOS_MENSAJES);

  // La conversación solo se crea cuando la regla de habilitación se cumple
  // (otro lado autorizó su contacto): si existes, es tuya. Solo miembros.
  return json({
    ok: true,
    conversacion: {
      conversacion_id: id,
      match_id: match.id,
      contraparte: contrapartePublica(contrapartePerrito, match.porcentaje_similitud ?? 0, true),
    },
    mensajes: ((mensajes ?? []) as Mensaje[]).map((m) => ({ ...m, es_mio: m.usuario_id === miUsuario.id })),
  } satisfies HiloResponse);
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { id } = await params;
  const ctx = await sesionYConversacion(request, { id });
  if ('error' in ctx) return ctx.error;
  const { supabase, conversacion, miUsuario } = ctx;

  const { data: match } = await supabase
    .from('matches_ia')
    .select('perrito_perdido_id, perrito_encontrado_id')
    .eq('id', conversacion.match_id)
    .maybeSingle();
  if (!match) return json({ ok: false, error: 'La coincidencia ya no existe.' }, 404);

  const { data: perritos } = await supabase
    .from('perritos')
    .select('id, usuario_id')
    .in('id', [match.perrito_perdido_id, match.perrito_encontrado_id]);
  const perdido = (perritos ?? []).find((p) => p.id === match.perrito_perdido_id) as Perrito | undefined;
  const encontrado = (perritos ?? []).find((p) => p.id === match.perrito_encontrado_id) as Perrito | undefined;
  if (!perdido || !encontrado) return json({ ok: false, error: 'Las publicaciones ya no existen.' }, 404);
  if (!ladoDelUsuario(perdido, encontrado, miUsuario.id)) {
    return json({ ok: false, error: 'No participas en esta conversación.' }, 403);
  }

  const { error } = await supabase
    .from('mensajes')
    .update({ leida: true })
    .eq('conversacion_id', id)
    .neq('usuario_id', miUsuario.id);

  if (error) {
    console.error('Marcar mensajes como leídos falló:', error);
    return json({ ok: false, error: 'No pudimos actualizar el estado de los mensajes.' }, 500);
  }

  return json({ ok: true });
}