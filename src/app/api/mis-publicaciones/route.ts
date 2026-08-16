// ============================================================
// 🐾 PATITAS SOS — GET /api/mis-publicaciones
//
// Devuelve las publicaciones del usuario logueado (sesión Supabase
// Auth vía `Authorization: Bearer <token>`), cada una con la lista
// de matches que la IA encontró (referencia a la contraparte).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase-server';
import type { AvisoResumen, MatchRef } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function GET(request: NextRequest) {
  const sesion = leerSesion(request);
  if (!sesion?.email) return json({ ok: false, error: 'Debes iniciar sesión.' }, 401);

  const supabase = createServerSupabase();

  const { data: usuarios } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase());

  const usuarioIds = (usuarios ?? []).map((u) => u.id);
  if (usuarioIds.length === 0) return json({ ok: true, perritos: [] });

  const { data: perritos } = await supabase
    .from('perritos')
    .select('*')
    .in('usuario_id', usuarioIds)
    .order('creado_en', { ascending: false });

  const ids = (perritos ?? []).map((p) => p.id);
  let pares: {
    id: string;
    perrito_perdido_id: string;
    perrito_encontrado_id: string;
    porcentaje_similitud: number;
    dueno_autorizo: boolean;
    encontrador_autorizo: boolean;
  }[] = [];
  if (ids.length > 0) {
    const { data: matchesData } = await supabase
      .from('matches_ia')
      .select(
        'id, perrito_perdido_id, perrito_encontrado_id, porcentaje_similitud, dueno_autorizo, encontrador_autorizo',
      )
      .or(`perrito_perdido_id.in.(${ids.join(',')}),perrito_encontrado_id.in.(${ids.join(',')})`);
    pares = matchesData ?? [];
  }

  const avisosPorPerrito = await obtenerAvisosPorPerrito(supabase, ids);

  const resultado = (perritos ?? []).map((perrito) => {
    const matches: MatchRef[] = pares
      .filter((m) => m.perrito_perdido_id === perrito.id || m.perrito_encontrado_id === perrito.id)
      .map((m) => ({
        match_id: m.id,
        contraparte_id: m.perrito_perdido_id === perrito.id ? m.perrito_encontrado_id : m.perrito_perdido_id,
        porcentaje_similitud: m.porcentaje_similitud,
        autorizacion: {
          dueno_autorizo: !!m.dueno_autorizo,
          encontrador_autorizo: !!m.encontrador_autorizo,
        },
      }));
    return { ...perrito, matches, avisos: avisosPorPerrito.get(perrito.id) ?? [] };
  });

  return json({ ok: true, perritos: resultado });
}

// 👀 Avisos "Vi esta mascota" resumidos por publicación (solo del dueño).
async function obtenerAvisosPorPerrito(
  supabase: ReturnType<typeof createServerSupabase>,
  perritoIds: string[],
): Promise<Map<string, AvisoResumen[]>> {
  const mapa = new Map<string, AvisoResumen[]>();
  try {
    const { data: avisos } = await supabase
      .from('avistamientos')
      .select('id, perrito_id, creado_en')
      .in('perrito_id', perritoIds);
    const avisoIds = (avisos ?? []).map((a) => a.id);

    let mensajes: { avistamiento_id: string; autor: string; contenido: string; creado_en: string; leida: boolean }[] = [];
    if (avisoIds.length > 0) {
      const { data } = await supabase
        .from('mensajes_aviso')
        .select('avistamiento_id, autor, contenido, creado_en, leida')
        .in('avistamiento_id', avisoIds)
        .order('creado_en', { ascending: false })
        .limit(500);
      mensajes = (data ?? []) as typeof mensajes;
    }

    const porAviso = new Map<string, typeof mensajes>(avisoIds.map((id) => [id, []]));
    for (const m of mensajes) porAviso.get(m.avistamiento_id)?.push(m);

    for (const aviso of avisos ?? []) {
      const delHilo = porAviso.get(aviso.id) ?? [];
      const lista = mapa.get(aviso.perrito_id) ?? [];
      lista.push({
        aviso_id: aviso.id,
        creado_en: aviso.creado_en,
        ultimo_mensaje: delHilo[0]
          ? { autor: delHilo[0].autor as 'dueño' | 'avisador', contenido: delHilo[0].contenido, creado_en: delHilo[0].creado_en }
          : null,
        noLeidas: delHilo.filter((m) => m.autor === 'avisador' && !m.leida).length,
      });
      mapa.set(aviso.perrito_id, lista);
    }
  } catch (error) {
    console.error('Cargar avisos por publicación falló:', error);
  }
  return mapa;
}
