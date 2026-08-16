// ============================================================
// 🐾 PATITAS SOS — /api/notificaciones
//
// GET : lista las notificaciones web del usuario logueado
//       (con la publicación de la contraparte y el estado de las
//       autorizaciones de contacto) + conteo de no leídas.
//       🔒 PRIVACIDAD: el contacto de la contraparte (autorizacion)
//       SOLO viaja si ella autorizó compartirlo.
// POST: marca como leída una notificación (`{ id }`) o todas
//       (`{}`).
//
// ⚠️ La tabla notificaciones tiene DOS llaves foráneas a perritos
//    (perrito_id y mi_perrito_id): los joins SIEMPRE deben indicar
//    la FK explícita (perritos!notificaciones_perrito_id_fkey /
//    perritos!notificaciones_mi_perrito_id_fkey), o PostgREST
//    responde PGRST201 (relación ambigua) y la bandeja se ve vacía.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase-server';
import type { AutorizacionContacto, Notificacion } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

/** Clave canónica de un par de publicaciones (independiente del rol). */
function parClave(a: string, b: string): string {
  return [a, b].sort().join('|');
}

async function obtenerUsuarioIds(request: NextRequest): Promise<{ ids: string[]; error?: Response }> {
  const sesion = leerSesion(request);
  if (!sesion?.email) return { ids: [], error: json({ ok: false, error: 'Debes iniciar sesión.' }, 401) };

  const supabase = createServerSupabase();
  const { data: usuarios, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase());

  if (usuarioError) {
    console.error('Error buscando el usuario de la sesión:', usuarioError);
    return { ids: [], error: json({ ok: false, error: 'No pudimos cargar tus datos. Intenta de nuevo.' }, 500) };
  }
  return { ids: (usuarios ?? []).map((u) => u.id) };
}

export async function GET(request: NextRequest) {
  const { ids, error } = await obtenerUsuarioIds(request);
  if (error) return error;
  if (ids.length === 0) return json({ ok: true, notificaciones: [], noLeidas: 0 });

  const supabase = createServerSupabase();
  const { data: notificaciones, error: queryError } = await supabase
    .from('notificaciones')
    .select(
      `*, perrito:perritos!notificaciones_perrito_id_fkey(id, nombre_temporal, descripcion, foto_url, rol_publicacion, especie, estado, departamento, ciudad, usuario_id), mi_perrito:perritos!notificaciones_mi_perrito_id_fkey(id, nombre_temporal, rol_publicacion, especie, estado)`,
    )
    .in('usuario_id', ids)
    .order('creado_en', { ascending: false })
    .limit(50);

  if (queryError) {
    console.error('Error cargando notificaciones:', queryError);
    return json({ ok: false, error: 'No pudimos cargar las notificaciones. Intenta de nuevo.' }, 500);
  }

  const lista = (notificaciones ?? []) as Notificacion[];

  // --- Autorizaciones de contacto: cruzar con matches_ia por par ---
  const idsPropios = new Set(lista.map((n) => n.mi_perrito_id).filter(Boolean));
  const paresMatches = new Map<string, { match_id: string; autorizacion: AutorizacionContacto }>();
  if (idsPropios.size > 0) {
    const { data: pares } = await supabase
      .from('matches_ia')
      .select('id, perrito_perdido_id, perrito_encontrado_id, dueno_autorizo, encontrador_autorizo')
      .or(`perrito_perdido_id.in.(${[...idsPropios].join(',')}),perrito_encontrado_id.in.(${[...idsPropios].join(',')})`);
    for (const par of pares ?? []) {
      paresMatches.set(parClave(par.perrito_perdido_id, par.perrito_encontrado_id), {
        match_id: par.id,
        autorizacion: {
          dueno_autorizo: !!par.dueno_autorizo,
          encontrador_autorizo: !!par.encontrador_autorizo,
        },
      });
    }
  }

  // --- Usuarios de las contrapartes (solo para adjuntar el contacto autorizado) ---
  const contraUsuarioIds = [...new Set(lista.map((n) => n.perrito?.usuario_id).filter(Boolean))];
  const usuariosPorId = new Map<string, { id: string; nombre: string; telefono: string; email: string | null }>();
  if (contraUsuarioIds.length > 0) {
    const { data: usuarios } = await supabase
      .from('usuarios')
      .select('id, nombre, telefono, email')
      .in('id', contraUsuarioIds);
    for (const u of usuarios ?? []) usuariosPorId.set(u.id, u);
  }

  // --- Avisos "👀 Vi esta mascota": conteos no leídos ---
  // avisosNoLeidos: en van MIS publicaciones (rol dueño).
  // avisosRecibidosNoLeidos: en los hilos que INICIÉ (rol testigo).
  const avisosNoLeidos = await contarAvisosNoLeidos(supabase, ids);
  const avisosRecibidosNoLeidos = await contarAvisosRecibidosNoLeidos(supabase, ids);

  const enriquecidas: Notificacion[] = lista.map((notificacion) => {
    const par = notificacion.mi_perrito_id && notificacion.perrito_id
      ? paresMatches.get(parClave(notificacion.perrito_id, notificacion.mi_perrito_id))
      : undefined;
    const autorizacion = par?.autorizacion ?? { dueno_autorizo: false, encontrador_autorizo: false };

    // El contacto mostrado es el de la contraparte (perrito). Se envía
    // SOLO si esa persona autorizó (dueño o encontrador, según su rol).
    const contraRol = notificacion.perrito?.rol_publicacion;
    const contactoVisibile =
      contraRol === 'BUSCA_DUEÑO' ? autorizacion.encontrador_autorizo : autorizacion.dueno_autorizo;
    const contacto = contactoVisibile && notificacion.perrito?.usuario_id
      ? (usuariosPorId.get(notificacion.perrito.usuario_id) ?? null)
      : null;

    const { usuario_id: _omitir, ...perritoSinUsuario } = notificacion.perrito ?? {};

    return {
      ...notificacion,
      perrito: perritoSinUsuario as Notificacion['perrito'],
      match_id: par?.match_id ?? null,
      autorizacion,
      contacto,
    };
  });

  return json({
    ok: true,
    notificaciones: enriquecidas,
    noLeidas: lista.filter((n) => !n.leida).length,
    avisosNoLeidos,
    avisosRecibidosNoLeidos,
  });
}

/** 👀 Avisos "Vi esta mascota" sin leer en las publicaciones de MIS usuarios. */
async function contarAvisosNoLeidos(
  supabase: ReturnType<typeof createServerSupabase>,
  usuarioIds: string[],
): Promise<number> {
  try {
    const { data: misPerritos } = await supabase
      .from('perritos')
      .select('id')
      .in('usuario_id', usuarioIds);
    const perritoIds = (misPerritos ?? []).map((p) => p.id);
    if (perritoIds.length === 0) return 0;

    const { data: avisos } = await supabase
      .from('avistamientos')
      .select('id')
      .in('perrito_id', perritoIds);
    const avisoIds = (avisos ?? []).map((a) => a.id);
    if (avisoIds.length === 0) return 0;

    const { count } = await supabase
      .from('mensajes_aviso')
      .select('id', { count: 'exact', head: true })
      .in('avistamiento_id', avisoIds)
      .eq('autor', 'avisador')
      .eq('leida', false);
    return count ?? 0;
  } catch (error) {
    console.error('Contar avisos no leídos falló:', error);
    return 0;
  }
}

/** 👀 Avisos sin leer que ME llegaron como testigo (hilos que inicié). */
async function contarAvisosRecibidosNoLeidos(
  supabase: ReturnType<typeof createServerSupabase>,
  usuarioIds: string[],
): Promise<number> {
  try {
    const { data: misAvisos } = await supabase
      .from('avistamientos')
      .select('id')
      .in('usuario_id', usuarioIds);
    const avisoIds = (misAvisos ?? []).map((a) => a.id);
    if (avisoIds.length === 0) return 0;

    const { count } = await supabase
      .from('mensajes_aviso')
      .select('id', { count: 'exact', head: true })
      .in('avistamiento_id', avisoIds)
      .eq('autor', 'dueño')
      .eq('leida_avisador', false);
    return count ?? 0;
  } catch (error) {
    console.error('Contar avisos recibidos no leídos falló:', error);
    return 0;
  }
}

export async function POST(request: NextRequest) {
  const { ids, error } = await obtenerUsuarioIds(request);
  if (error) return error;
  if (ids.length === 0) return json({ ok: false, error: 'Debes iniciar sesión.' }, 401);

  let id: string | null = null;
  try {
    const body = (await request.json()) as { id?: string };
    id = typeof body.id === 'string' ? body.id : null;
  } catch {
    // sin body = marcar todas
  }

  const supabase = createServerSupabase();
  let query = supabase.from('notificaciones').update({ leida: true }).in('usuario_id', ids);
  if (id) query = query.eq('id', id);

  const { error: updateError } = await query;
  if (updateError) {
    console.error('Marcar notificaciones como leídas falló:', updateError);
    return json({ ok: false, error: 'No pudimos actualizar las notificaciones.' }, 500);
  }

  return json({ ok: true });
}