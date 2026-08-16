// ============================================================
// 🐾 PATITAS SOS — /api/mensajes
//
// GET : lista las conversaciones del usuario logueado (con la
//       contraparte pública, el último mensaje y las no leídas)
//       + noLeidasTotal para el badge del header.
// POST: envía un mensaje a una conversación existente
//       `{ conversacionId, contenido }` (valida membresía y
//       emite el "ping" de realtime).
//
// 🔒 PRIVACIDAD: la contraparte solo muestra datos públicos
//    (foto, nombre temporal, rol, estado, %): NUNCA contacto.
//    El chat se abre solo si el otro lado autorizó (lib/chat.ts).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { chatHabilitadoPara, contrapartePublica, enviarBroadcastChat, MAX_MENSAJE_LEN } from '@/lib/chat';
import { createServerSupabase } from '@/lib/supabase-server';
import type { ConversacionUI, Mensaje, Perrito } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Ids de usuarios que comparten el email de la sesión. */
async function usuarioIdsDeSesion(request: NextRequest): Promise<{ ids: string[]; error?: Response }> {
  const sesion = leerSesion(request);
  if (!sesion?.email) return { ids: [], error: json({ ok: false, error: 'Debes iniciar sesión.' }, 401) };

  const supabase = createServerSupabase();
  const { data: usuarios, error } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase());
  if (error) {
    console.error('Error buscando el usuario de la sesión:', error);
    return { ids: [], error: json({ ok: false, error: 'No pudimos cargar tus datos. Intenta de nuevo.' }, 500) };
  }
  return { ids: (usuarios ?? []).map((u) => u.id) };
}

export async function GET(request: NextRequest) {
  const { ids: usuarioIds, error } = await usuarioIdsDeSesion(request);
  if (error) return error;
  if (usuarioIds.length === 0) return json({ ok: true, conversaciones: [], noLeidasTotal: 0 });

  const supabase = createServerSupabase();

  // Publicaciones mías (para saber rol y dueño de cada una).
  const { data: misPerritos } = await supabase
    .from('perritos')
    .select('id, usuario_id, rol_publicacion, estado')
    .in('usuario_id', usuarioIds);
  const miPerritoPorId = new Map((misPerritos ?? []).map((p) => [p.id, p]));

  // Matches donde participa alguna de mis publicaciones.
  const { data: pares } = await supabase
    .from('matches_ia')
    .select('id, perrito_perdido_id, perrito_encontrado_id, porcentaje_similitud, dueno_autorizo, encontrador_autorizo, creado_en')
    .or(
      `perrito_perdido_id.in.(${[...miPerritoPorId.keys()].join(',')}),perrito_encontrado_id.in.(${[...miPerritoPorId.keys()].join(',')})`,
    );

  if ((pares ?? []).length === 0) return json({ ok: true, conversaciones: [], noLeidasTotal: 0 });

  // Contrapartes (solo datos públicos) + conversaciones + mensajes.
  const matchPorId = new Map((pares ?? []).map((m) => [m.id, m]));
  const contraIds = new Set<string>();
  for (const par of pares ?? []) {
    const miId = miPerritoPorId.has(par.perrito_perdido_id) ? par.perrito_perdido_id : par.perrito_encontrado_id;
    contraIds.add(par.perrito_perdido_id === miId ? par.perrito_encontrado_id : par.perrito_perdido_id);
  }

  const { data: contras } = await supabase
    .from('perritos')
    .select('id, nombre_temporal, foto_url, rol_publicacion, especie, estado')
    .in('id', [...contraIds]);
  const contraPorId = new Map((contras ?? []).map((p) => [p.id, p as Perrito]));

  const matchIds = [...matchPorId.keys()];
  const { data: conversaciones } = await supabase
    .from('conversaciones')
    .select('id, match_id, creado_en')
    .in('match_id', matchIds);
  const conversacionPorMatch = new Map((conversaciones ?? []).map((c) => [c.match_id, c]));

  const convIds = (conversaciones ?? []).map((c) => c.id);
  let mensajes: Mensaje[] = [];
  if (convIds.length > 0) {
    const { data } = await supabase
      .from('mensajes')
      .select('id, conversacion_id, usuario_id, contenido, leida, creado_en')
      .in('conversacion_id', convIds)
      .order('creado_en', { ascending: false })
      .limit(500);
    mensajes = (data ?? []) as Mensaje[];
  }

  const conversacionesUI: ConversacionUI[] = [];
  let noLeidasTotal = 0;

  for (const par of pares ?? []) {
    const miId = miPerritoPorId.has(par.perrito_perdido_id) ? par.perrito_perdido_id : par.perrito_encontrado_id;
    const miPerrito = miPerritoPorId.get(miId);
    const contraId = par.perrito_perdido_id === miId ? par.perrito_encontrado_id : par.perrito_perdido_id;
    const contra = contraPorId.get(contraId);
    if (!contra || !miPerrito) continue;

    const autorizacion = { dueno_autorizo: !!par.dueno_autorizo, encontrador_autorizo: !!par.encontrador_autorizo };
    const habilitada = chatHabilitadoPara(autorizacion, miPerrito.rol_publicacion);

    // Sin conversación aún no hay chat: la UI lo enlaza al match real.
    const conversacion = conversacionPorMatch.get(par.id);
    if (!conversacion) continue;

    const delHilo = mensajes.filter((m) => m.conversacion_id === conversacion.id);
    const ultimo = delHilo[0] ?? null;
    const noLeidas = delHilo.filter((m) => !m.leida && !usuarioIds.includes(m.usuario_id)).length;

    noLeidasTotal += noLeidas;
    conversacionesUI.push({
      conversacion_id: conversacion.id,
      match_id: par.id,
      contraparte: contrapartePublica(contra, par.porcentaje_similitud ?? 0, habilitada),
      ultimo_mensaje: ultimo
        ? {
            id: ultimo.id,
            contenido: ultimo.contenido,
            creado_en: ultimo.creado_en,
            usuario_id: ultimo.usuario_id,
            es_mio: usuarioIds.includes(ultimo.usuario_id),
          }
        : null,
      noLeidas,
    });
  }

  // Más recientes primero (mensaje nuevo primero; sin mensajes → por creación).
  conversacionesUI.sort((a, b) => {
    const ta = a.ultimo_mensaje ? new Date(a.ultimo_mensaje.creado_en).getTime() : Infinity;
    const tb = b.ultimo_mensaje ? new Date(b.ultimo_mensaje.creado_en).getTime() : Infinity;
    return tb - ta;
  });

  return json({ ok: true, conversaciones: conversacionesUI, noLeidasTotal });
}

export async function POST(request: NextRequest) {
  const { ids: usuarioIds, error } = await usuarioIdsDeSesion(request);
  if (error) return error;
  if (usuarioIds.length === 0) return json({ ok: false, error: 'Debes iniciar sesión.' }, 401);

  let body: { conversacionId?: string; contenido?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido.' }, 400);
  }

  const contenido = typeof body.contenido === 'string' ? body.contenido.trim() : '';
  const conversacionId = typeof body.conversacionId === 'string' ? body.conversacionId : '';
  if (!conversacionId) return json({ ok: false, error: 'Falta la conversación.' }, 400);
  if (contenido.length < 1 || contenido.length > MAX_MENSAJE_LEN) {
    return json({ ok: false, error: `El mensaje debe tener entre 1 y ${MAX_MENSAJE_LEN} caracteres.` }, 400);
  }

  const supabase = createServerSupabase();

  const { data: conversacion } = await supabase
    .from('conversaciones')
    .select('id, match_id')
    .eq('id', conversacionId)
    .maybeSingle();
  if (!conversacion) return json({ ok: false, error: 'Esta conversación ya no existe.' }, 404);

  const { data: match } = await supabase
    .from('matches_ia')
    .select('perrito_perdido_id, perrito_encontrado_id')
    .eq('id', conversacion.match_id)
    .maybeSingle();
  if (!match) return json({ ok: false, error: 'La coincidencia ya no existe.' }, 404);

  const { data: miembros } = await supabase
    .from('perritos')
    .select('usuario_id')
    .in('id', [match.perrito_perdido_id, match.perrito_encontrado_id]);
  const usuarioIdsDelMatch = new Set((miembros ?? []).map((p) => p.usuario_id));

  const soyMiembro = usuarioIds.some((id) => usuarioIdsDelMatch.has(id));
  if (!soyMiembro) {
    return json({ ok: false, error: 'No participas de esta conversación.' }, 403);
  }

  const { data: mensaje, error: insertError } = await supabase
    .from('mensajes')
    .insert({ conversacion_id: conversacionId, usuario_id: usuarioIds[0], contenido })
    .select('id, conversacion_id, usuario_id, contenido, leida, creado_en')
    .single();
  if (insertError || !mensaje) {
    console.error('Insertar mensaje falló:', insertError);
    return json({ ok: false, error: 'No pudimos enviar el mensaje. Intenta de nuevo.' }, 500);
  }

  // Ping de realtime (nunca bloquea; sin él el receptor ve el mensaje al refrescar).
  void enviarBroadcastChat(supabase, conversacion.match_id);

  return json({ ok: true, mensaje, conversacion_id: conversacionId });
}