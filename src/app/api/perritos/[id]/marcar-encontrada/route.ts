// ============================================================
// 🐾 PATITAS SOS — POST /api/perritos/[id]/marcar-encontrada
//
// Marca un reporte como ENCONTRADA. Verifica antes que quien lo
// solicita es el publicador del reporte, de una de estas formas:
//   1. `token`    → firma HMAC que llega en el correo de notificación.
//   2. `telefono` → teléfono con el que se publicó el reporte.
//   3. `email`    → correo con el que se publicó el reporte.
//
// Al confirmar, el reporte Y TODOS SUS PARES de matches_ia (la misma
// mascota) pasan a ENCONTRADA y aparecen en la lista "Encontradas".
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { verificarTokenEncontrada } from '@/lib/mail';
import { createServerSupabase } from '@/lib/supabase-server';
import { normalizarTelefonoColombia } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

interface Body {
  token?: string;
  telefono?: string;
  email?: string;
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

    // --- Verificación de identidad del publicador ---
    const token = typeof body.token === 'string' ? body.token : '';
    const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    let autorizado = false;

    if (token) {
      autorizado = verificarTokenEncontrada(id, token);
    } else if (telefono) {
      const normalizado = normalizarTelefonoColombia(telefono);
      autorizado = !!normalizado && normalizado === perrito.usuario?.telefono;
    } else if (email) {
      autorizado = email === (perrito.usuario?.email ?? '').toLowerCase();
    }

    if (!autorizado) {
      return json(
        {
          ok: false,
          error:
            'No pudimos verificar que eres quien publicó este reporte. Ingresa el teléfono o el correo que usaste al publicarlo.',
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