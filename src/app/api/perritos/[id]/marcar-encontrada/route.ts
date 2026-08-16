// ============================================================
// 🐾 PATITAS SOS — POST /api/perritos/[id]/marcar-encontrada
//
// Marca un reporte como ENCONTRADA. Verifica antes que quien lo
// solicita es el DUEÑO (el publicador del reporte PERDIDO), de una
// de estas formas:
//   1. sesión → `Authorization: Bearer <token>`: sesión iniciada
//               con el mismo correo/auth_uid del publicador.
//   2. `token` → firma HMAC que llega en el correo de notificación
//                (que solo se envía al correo del dueño).
//
// NO se acepta verificación por teléfono/email: el teléfono es
// público en el reporte y cualquiera podría marcarla.
//
// Al confirmar, el reporte (SOLO el del dueño, rol PERDIDO) y todos sus
// pares de matches_ia (la misma mascota) pasan a ENCONTRADA y aparecen en
// la lista "Encontradas". El reporte del rescatista (BUSCA_DUEÑO) NO puede
// marcarla: solo el dueño decide el reencuentro.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { verificarTokenEncontrada } from '@/lib/mail';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

interface Body {
  token?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let body: Body;
    try {
      body = (await request.json()) as Body;
    } catch {
      return json({ ok: false, error: 'Envío inválido.' }, 400);
    }

    const supabase = createServerSupabase();

    const { data: perrito, error } = await supabase
      .from('perritos')
      .select('*, usuario:usuarios(id, nombre, telefono, email)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error en marcar-encontrada:', error);
      return json({ ok: false, error: 'No se pudo cargar el reporte.' }, 500);
    }
    if (!perrito) {
      return json({ ok: false, error: 'Este reporte ya no está disponible.' }, 404);
    }

    // --- Solo el dueño puede marcar como encontrada ---
    // El reporte PERDIDO es del dueño; el BUSCA_DUEÑO es del rescatista.
    if (perrito.rol_publicacion !== 'PERDIDO') {
      return json(
        {
          ok: false,
          error:
            'Solo el dueño de la mascota (quien publicó el reporte de búsqueda) puede marcarla como encontrada.',
        },
        403,
      );
    }

    // --- Verificación de identidad del dueño: sesión o token del correo ---
    const sesion = leerSesion(request);
    const token = typeof body.token === 'string' ? body.token : '';

    let autorizado = false;

    if (sesion?.email) {
      const emailCoincide =
        !!perrito.usuario?.email &&
        sesion.email.toLowerCase() === perrito.usuario.email.toLowerCase();
      autorizado = emailCoincide;
    } else if (token) {
      autorizado = verificarTokenEncontrada(id, token);
    }

    if (!autorizado) {
      return json(
        {
          ok: false,
          error:
            'Solo el dueño puede marcar este reporte como encontrado. Inicia sesión con el correo con el que lo publicaste o abre el enlace del correo de notificación.',
        },
        403,
      );
    }

    if (perrito.estado === 'ENCONTRADA') {
      return json({ ok: true, yaEncontrada: true, encontradas: [id] });
    }

    // --- Marcar como ENCONTRADA el reporte y todos sus pares (misma mascota) ---
    const { data: pares } = await supabase
      .from('matches_ia')
      .select('perrito_perdido_id, perrito_encontrado_id')
      .or(`perrito_perdido_id.eq.${id},perrito_encontrado_id.eq.${id}`);

    const idsAfectados = new Set<string>([id]);
    for (const par of pares ?? []) {
      if (par.perrito_perdido_id !== id) idsAfectados.add(par.perrito_perdido_id);
      if (par.perrito_encontrado_id !== id) idsAfectados.add(par.perrito_encontrado_id);
    }

    const { error: updateError } = await supabase
      .from('perritos')
      .update({ estado: 'ENCONTRADA' })
      .in('id', [...idsAfectados]);

    if (updateError) {
      console.error('Error al marcar como encontrada:', updateError);
      return json({ ok: false, error: 'No pudimos actualizar el reporte. Intenta de nuevo.' }, 500);
    }

    return json({ ok: true, yaEncontrada: false, encontradas: [...idsAfectados] });
  } catch (error) {
    console.error('Error en marcar-encontrada:', error);
    return json({ ok: false, error: 'Error interno del servidor.' }, 500);
  }
}