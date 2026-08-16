// ============================================================
// 🐾 PATITAS SOS — /api/avistamientos/[id]
//
// GET : el hilo de un aviso "👀 Vi esta mascota".
//       Acceso SOLO con sesión iniciada:
//         - el testigo que creó el aviso (avistamientos.usuario_id)
//         - el dueño de la publicación (perritos.usuario_id)
//       🔒 NUNCA devuelve datos de contacto de nadie: solo datos
//       públicos del reporte + los mensajes del hilo.
// POST: envía un mensaje al hilo `{ contenido }`.
//         - La PRIMERA respuesta del dueño debe ser uno de los
//           mensajes predefinidos (MENSAJES_DUENO_PREDEFINIDOS):
//           después de eso, texto libre; el testigo ya dio su
//           predefinido al crear el aviso.
//         - Si el testigo quiere escribir y el dueño desactivó los
//           mensajes → 403.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { MAX_MENSAJE_AVISO_LEN, MENSAJES_DUENO_PREDEFINIDOS } from '@/lib/avisos';
import { createServerSupabase } from '@/lib/supabase-server';
import type { AutorAviso } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

type Contexto = { params: Promise<{ id: string }> };

interface Acceso {
  avisoId: string;
  perrito: { id: string; usuario_id: string; estado: string; avisos_habilitados: boolean };
  autor: AutorAviso;
  soyDueno: boolean;
}

/**
 * Resuelve quién accede al hilo con su sesión: el testigo que lo creó
 * o el dueño de la publicación. Devuelve null si nadie tiene acceso.
 */
async function accesoAlAviso(request: NextRequest, avisoId: string): Promise<Acceso | null> {
  const sesion = leerSesion(request);
  if (!sesion?.email) return null;

  const supabase = createServerSupabase();
  const { data: miUsuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase())
    .maybeSingle();
  if (!miUsuario) return null;

  const { data: aviso } = await supabase
    .from('avistamientos')
    .select('id, perrito_id, usuario_id')
    .eq('id', avisoId)
    .maybeSingle();
  if (!aviso) return null;

  const { data: perrito } = await supabase
    .from('perritos')
    .select('id, usuario_id, estado, avisos_habilitados')
    .eq('id', aviso.perrito_id)
    .maybeSingle();
  if (!perrito) return null;

  if (miUsuario.id === aviso.usuario_id) {
    return { avisoId, perrito, autor: 'avisador', soyDueno: false };
  }
  if (miUsuario.id === perrito.usuario_id) {
    return { avisoId, perrito, autor: 'dueño', soyDueno: true };
  }
  return null;
}

export async function GET(request: NextRequest, { params }: Contexto) {
  const { id } = await params;
  const supabase = createServerSupabase();
  const acceso = await accesoAlAviso(request, id);
  if (!acceso) return json({ ok: false, error: 'No tienes acceso a este hilo.' }, 403);

  // Marcas de leída BIDIRECCIONALES:
  //  - el dueño abre el hilo → leidas sus filas del testigo (`leida`)
  //  - el testigo abre el hilo → leídas sus filas del dueño (`leida_avisador`)
  try {
    await supabase
      .from('mensajes_aviso')
      .update(acceso.soyDueno ? { leida: true } : { leida_avisador: true })
      .eq('avistamiento_id', id)
      .eq('autor', acceso.soyDueno ? 'avisador' : 'dueño');
  } catch (error) {
    console.error('Marcar mensajes del aviso como leídas falló:', error);
  }

  const { data: mensajes } = await supabase
    .from('mensajes_aviso')
    .select('id, autor, contenido, leida, creado_en')
    .eq('avistamiento_id', id)
    .order('creado_en', { ascending: true })
    .limit(200);

  const { data: publicacion } = await supabase
    .from('perritos')
    .select('id, nombre_temporal, foto_url, rol_publicacion, especie, estado, departamento, ciudad')
    .eq('id', acceso.perrito.id)
    .maybeSingle();

  return json({
    ok: true,
    autor: acceso.autor,
    perrito: publicacion,
    avisos_habilitados: acceso.perrito.avisos_habilitados,
    mensajes: (mensajes ?? []).map((m) => ({
      id: m.id,
      autor: m.autor as AutorAviso,
      contenido: m.contenido,
      leida: m.leida,
      creado_en: m.creado_en,
    })),
  });
}

export async function POST(request: NextRequest, { params }: Contexto) {
  const { id } = await params;
  const supabase = createServerSupabase();
  const acceso = await accesoAlAviso(request, id);
  if (!acceso) return json({ ok: false, error: 'No tienes acceso a este hilo.' }, 403);

  let body: { contenido?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'Solicitud inválida.' }, 400);
  }
  const contenido = typeof body.contenido === 'string' ? body.contenido.trim() : '';
  if (contenido.length < 1 || contenido.length > MAX_MENSAJE_AVISO_LEN) {
    return json({ ok: false, error: `El mensaje debe tener entre 1 y ${MAX_MENSAJE_AVISO_LEN} caracteres.` }, 400);
  }

  // El testigo no puede escribir más cuando el dueño desactivó los mensajes.
  if (acceso.autor === 'avisador' && !acceso.perrito.avisos_habilitados) {
    return json(
      { ok: false, error: 'Quien publicó este reporte desactivó los mensajes.' },
      403,
    );
  }

  // La PRIMERA respuesta del dueño debe ser un predefinido (así el testigo
  // nunca recibe presión por datos de contacto de golpe); luego, texto libre.
  if (acceso.autor === 'dueño') {
    const { count: yaEscribio } = await supabase
      .from('mensajes_aviso')
      .select('id', { count: 'exact', head: true })
      .eq('avistamiento_id', id)
      .eq('autor', 'dueño');
    if ((yaEscribio ?? 0) === 0 && !MENSAJES_DUENO_PREDEFINIDOS.includes(contenido as never)) {
      return json(
        { ok: false, error: 'Elige uno de los mensajes predefinidos para tu primera respuesta.' },
        400,
      );
    }
  }

  const { data: mensaje, error } = await supabase
    .from('mensajes_aviso')
    .insert({ avistamiento_id: id, autor: acceso.autor, contenido })
    .select('id, autor, contenido, leida, creado_en')
    .single();

  if (error || !mensaje) {
    console.error('Enviar mensaje del aviso falló:', error);
    return json({ ok: false, error: 'No pudimos enviar el mensaje. Intenta de nuevo.' }, 500);
  }

  return json({
    ok: true,
    mensaje: {
      id: mensaje.id,
      autor: mensaje.autor as AutorAviso,
      contenido: mensaje.contenido,
      leida: mensaje.leida,
      creado_en: mensaje.creado_en,
    },
  });
}