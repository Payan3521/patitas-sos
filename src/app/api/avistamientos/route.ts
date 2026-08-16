// ============================================================
// 🐾 PATITAS SOS — POST /api/avistamientos
//
// Crea un aviso "👀 Vi esta mascota" para una publicación. El
// testigo DEBE tener sesión iniciada (así siempre puede volver a
// la conversación desde "Mis avisos").
//
// Body: { perrito_id, mensaje } — `mensaje` DEBE ser uno de los
// predefinidos (anti-spam: el dueño nunca recibe texto libre para
// crear un aviso; si responde, se abre el mini-chat).
//
// Reglas:
//   - Sesión obligatoria (401 si no) y el dueño no puede
//     avisarse a sí mismo (400).
//   - Un aviso por (publicación + testigo): si ya existe, devuelve
//     el del existente (`reutilizado: true`), no crea otro.
//   - Máx. AVISOS_MAX_DIARIOS_POR_PUBLICACION avisos nuevos/día.
//   - Si el dueño desactivó los avisos (avisos_habilitados=false) → 409.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { AVISOS_MAX_DIARIOS_POR_PUBLICACION, MENSAJES_AVISO_PREDEFINIDOS } from '@/lib/avisos';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function POST(request: NextRequest) {
  let body: { perrito_id?: unknown; mensaje?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'Solicitud inválida.' }, 400);
  }

  const perritoId = typeof body.perrito_id === 'string' ? body.perrito_id.trim() : '';
  const mensaje = typeof body.mensaje === 'string' ? body.mensaje.trim() : '';
  if (!perritoId) return json({ ok: false, error: 'Falta la publicación.' }, 400);
  if (!MENSAJES_AVISO_PREDEFINIDOS.includes(mensaje as never)) {
    return json({ ok: false, error: 'Elige uno de los mensajes predefinidos.' }, 400);
  }

  // El testigo debe tener cuenta (por eso la cookie y el enlace privado
  // con token desaparecieron: el acceso al hilo es SIEMPRE por sesión).
  const sesion = leerSesion(request);
  if (!sesion?.email) {
    return json({ ok: false, error: 'Debes iniciar sesión para avisar.' }, 401);
  }

  const supabase = createServerSupabase();
  const { data: miUsuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase())
    .maybeSingle();
  if (!miUsuario) {
    return json({ ok: false, error: 'Debes iniciar sesión para avisar.' }, 401);
  }

  const { data: perrito } = await supabase
    .from('perritos')
    .select('id, usuario_id, estado, avisos_habilitados')
    .eq('id', perritoId)
    .maybeSingle();

  if (!perrito) return json({ ok: false, error: 'Esta publicación ya no existe.' }, 404);
  if (perrito.estado !== 'ACTIVO') {
    return json({ ok: false, error: 'Esta publicación ya no está activa.' }, 400);
  }
  if (!perrito.avisos_habilitados) {
    return json(
      { ok: false, error: 'Quien publicó este reporte desactivó los mensajes.' },
      409,
    );
  }
  if (perrito.usuario_id === miUsuario.id) {
    return json({ ok: false, error: 'No puedes avisarte en tu propia publicación.' }, 400);
  }

  // Dedupe: un aviso por (publicación + testigo) → reutiliza el hilo.
  const { data: existente } = await supabase
    .from('avistamientos')
    .select('id')
    .eq('perrito_id', perritoId)
    .eq('usuario_id', miUsuario.id)
    .maybeSingle();
  if (existente) {
    return json({ ok: true, aviso_id: existente.id, url: `/aviso/${existente.id}`, reutilizado: true });
  }

  // Tope diario por publicación (anti-spam global).
  const { count: hoy } = await supabase
    .from('avistamientos')
    .select('id', { count: 'exact', head: true })
    .eq('perrito_id', perritoId)
    .gte('creado_en', new Date(Date.now() - 24 * 3_600_000).toISOString());
  if ((hoy ?? 0) >= AVISOS_MAX_DIARIOS_POR_PUBLICACION) {
    return json(
      { ok: false, error: 'Hoy ya hay suficientes avisos para esta publicación. Intenta mañana.' },
      429,
    );
  }

  const { data: aviso, error: errorAviso } = await supabase
    .from('avistamientos')
    .insert({ perrito_id: perritoId, usuario_id: miUsuario.id })
    .select('id')
    .single();
  if (errorAviso) {
    // Carrera de dos avisos a la vez: gana el dedupe (índice único).
    if (/duplicate/i.test(String(errorAviso.message ?? ''))) {
      const { data: yaExiste } = await supabase
        .from('avistamientos')
        .select('id')
        .eq('perrito_id', perritoId)
        .eq('usuario_id', miUsuario.id)
        .maybeSingle();
      if (yaExiste) {
        return json({ ok: true, aviso_id: yaExiste.id, url: `/aviso/${yaExiste.id}`, reutilizado: true });
      }
    }
    console.error('Insert en avistamientos falló:', errorAviso);
    return json({ ok: false, error: 'No pudimos registrar tu aviso. Intenta de nuevo.' }, 500);
  }

  // El mensaje predefinido es la primera fila del hilo (fuente única).
  const { error: errorMensaje } = await supabase.from('mensajes_aviso').insert({
    avistamiento_id: aviso.id,
    autor: 'avisador',
    contenido: mensaje,
    leida: false,
    leida_avisador: false,
  });
  if (errorMensaje) {
    console.error('Insert del mensaje de aviso falló:', errorMensaje);
    try {
      await supabase.from('avistamientos').delete().eq('id', aviso.id);
    } catch {
      // no bloquea
    }
    return json({ ok: false, error: 'No pudimos registrar tu aviso. Intenta de nuevo.' }, 500);
  }

  return json({ ok: true, aviso_id: aviso.id, url: `/aviso/${aviso.id}` }, 201);
}