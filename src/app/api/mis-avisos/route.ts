// ============================================================
// 🐾 PATITAS SOS — GET /api/mis-avisos
//
// Los hilos "👀 Vi esta mascota" que el testigo INICIÓ (con su
// sesión): con la publicación pública y el último mensaje, para
// que siempre pueda volver a la conversación (sin enlaces
// privados: el acceso es por cuenta).
//
// 🔒 Solo datos públicos de la publicación; nunca datos de
// contacto del dueño.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase-server';
import type { AvisoMioResumen, AutorAviso } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function GET(request: NextRequest) {
  const sesion = leerSesion(request);
  if (!sesion?.email) return json({ ok: false, error: 'Debes iniciar sesión.' }, 401);

  const supabase = createServerSupabase();
  const { data: miUsuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase())
    .maybeSingle();
  if (!miUsuario) return json({ ok: false, error: 'Debes iniciar sesión.' }, 401);

  const { data: avisos } = await supabase
    .from('avistamientos')
    .select('id, perrito_id, creado_en')
    .eq('usuario_id', miUsuario.id)
    .order('creado_en', { ascending: false })
    .limit(100);

  let perritos = new Map<string, AvisoMioResumen['perrito']>();
  let mensajes: { avistamiento_id: string; autor: string; contenido: string; creado_en: string; leida: boolean; leida_avisador: boolean }[] = [];

  const perritoIds = [...new Set((avisos ?? []).map((a) => a.perrito_id))];
  if (perritoIds.length > 0) {
    const { data } = await supabase
      .from('perritos')
      .select('id, nombre_temporal, foto_url, rol_publicacion, especie, estado, departamento, ciudad')
      .in('id', perritoIds);
    perritos = new Map((data ?? []).map((p) => [p.id, p]));
  }

  const avisoIds = (avisos ?? []).map((a) => a.id);
  if (avisoIds.length > 0) {
    const { data } = await supabase
      .from('mensajes_aviso')
      .select('avistamiento_id, autor, contenido, creado_en, leida, leida_avisador')
      .in('avistamiento_id', avisoIds)
      .order('creado_en', { ascending: false })
      .limit(500);
    mensajes = (data ?? []) as typeof mensajes;
  }

  const porAviso = new Map<string, typeof mensajes>(avisoIds.map((id) => [id, []]));
  for (const m of mensajes) porAviso.get(m.avistamiento_id)?.push(m);

  const lista: AvisoMioResumen[] = [];
  for (const aviso of avisos ?? []) {
    const delHilo = porAviso.get(aviso.id) ?? [];
    const perrito = perritos.get(aviso.perrito_id);
    if (!perrito) continue;
    lista.push({
      aviso_id: aviso.id,
      creado_en: aviso.creado_en,
      perrito,
      ultimo_mensaje: delHilo[0]
        ? {
            autor: delHilo[0].autor as AutorAviso,
            contenido: delHilo[0].contenido,
            creado_en: delHilo[0].creado_en,
          }
        : null,
      noLeidas: delHilo.filter((m) => m.autor === 'dueño' && !m.leida_avisador).length,
    });
  }

  return json({ ok: true, avisos: lista });
}