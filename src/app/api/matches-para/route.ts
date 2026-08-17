// ============================================================
// 🐾 PATITAS SOS — GET /api/matches-para
//
// Polling del match en background: tras publicar, el cliente consulta
// cada pocos segundos si la IA ya encontró una coincidencia para su
// reporte (mientras el trabajo corre fuera de la request de
// publicación).
//
// Query: ?perrito_id=<id>  — exige sesión del DUEÑO del reporte.
// Devuelve el MEJOR match (por similitud) con la misma forma de
// `matchInfo` que /api/publicar-perrito (mismo contracto del modal
// 🎉). 🔒 El contacto de la contraparte solo viaja si ella autorizó
// compartirlo (contactoVisible).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { contactoVisible } from '@/lib/permisos';
import { createServerSupabase } from '@/lib/supabase-server';
import type { AutorizacionContacto, MatchInfo } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function GET(request: NextRequest) {
  const sesion = leerSesion(request);
  if (!sesion?.email) return json({ ok: false, error: 'Debes iniciar sesión.' }, 401);

  const perritoId = request.nextUrl.searchParams.get('perrito_id') ?? '';
  if (!perritoId) return json({ ok: false, error: 'Falta la publicación.' }, 400);

  const supabase = createServerSupabase();
  const { data: miUsuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase())
    .maybeSingle();
  if (!miUsuario) return json({ ok: false, error: 'Debes iniciar sesión.' }, 401);

  const { data: perrito } = await supabase
    .from('perritos')
    .select('id, usuario_id, rol_publicacion')
    .eq('id', perritoId)
    .maybeSingle();
  if (!perrito) return json({ ok: false, error: 'Esta publicación ya no existe.' }, 404);
  if (perrito.usuario_id !== miUsuario.id) {
    return json({ ok: false, error: 'No tienes acceso a esta publicación.' }, 403);
  }

  const { data: fila } = await supabase
    .from('matches_ia')
    .select(
      'id, perrito_perdido_id, perrito_encontrado_id, porcentaje_similitud, dueno_autorizo, encontrador_autorizo, razon',
    )
    .or(`perrito_perdido_id.eq.${perritoId},perrito_encontrado_id.eq.${perritoId}`)
    .order('porcentaje_similitud', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!fila) return json({ ok: true, match: false, perritoId });

  const contraId =
    fila.perrito_perdido_id === perritoId ? fila.perrito_encontrado_id : fila.perrito_perdido_id;

  const { data: pares } = await supabase
    .from('perritos')
    .select('*, usuario:usuarios(id, nombre, telefono, email)')
    .eq('id', contraId)
    .maybeSingle();
  if (!pares) return json({ ok: true, match: false, perritoId });

  const autorizacion: AutorizacionContacto = {
    dueno_autorizo: !!fila.dueno_autorizo,
    encontrador_autorizo: !!fila.encontrador_autorizo,
  };
  const contactoVisibleContraparte = contactoVisible(true, pares.rol_publicacion, autorizacion);

  const matchInfo: MatchInfo = {
    matchId: fila.id,
    perrito: {
      ...pares,
      // 🔒 El barrio es dato personal (Política): solo viaja si la
      // contraparte autorizó compartir su contacto (igual que `usuario`).
      usuario: null,
      barrio_zona: contactoVisibleContraparte ? (pares.barrio_zona ?? null) : null,
    },
    usuario: contactoVisibleContraparte ? (pares.usuario ?? null) : null,
    porcentaje_similitud: Number(fila.porcentaje_similitud ?? 0),
    autorizacion,
  };

  return json({ ok: true, match: true, perritoId, matchInfo });
}