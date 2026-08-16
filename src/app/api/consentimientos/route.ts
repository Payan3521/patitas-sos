// ============================================================
// 🐾 PATITAS SOS — POST /api/consentimientos
//
// Autoriza compartir los DATOS DE CONTACTO de una de las partes
// de un match (privacidad por defecto).
//
// Body: { matchId, rol: 'PERDIDO' | 'BUSCA_DUEÑO', token?, aceptado: true }
//  - `rol` es el rol de la publicación de QUIEN AUTORIZA:
//      PERDIDO     → autoriza el dueño (dueno_autorizo)
//      BUSCA_DUEÑO → autoriza el encontrador (encontrador_autorizo)
//  - Autenticación: sesión iniciada (el correo de la sesión debe ser
//    del dueño de esa publicación) O token HMAC firmado (llega en el
//    botón del correo de match: el usuario aún no necesita registrarse).
//  - `aceptado` debe ser true (el cliente exige checkbox de política).
//
// Efecto (idempotente, nunca bloquea):
//   1. Marca el flag en matches_ia + registra la fila en `consentimientos`.
//   2. Envía a la contraparte el correo con los datos compartidos
//      (solo la primera vez).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { leerSesion } from '@/lib/auth';
import {
  ladoDeRol,
  POLITICA_PRIVACIDAD_VERSION,
  TEXTO_CONSENTIMIENTO_CONTACTO,
  yaAutorizado,
} from '@/lib/permisos';
import { createServerSupabase } from '@/lib/supabase-server';
import { notificarContactoCompartido } from '@/lib/mail';
import { verificarTokenCompartirContacto } from '@/lib/mail';
import type { LadoAutorizacion, NotificacionEstado, RolPublicacion } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

interface FilaMatch {
  id: string;
  perrito_perdido_id: string;
  perrito_encontrado_id: string;
  porcentaje_similitud: number;
  dueno_autorizo: boolean;
  encontrador_autorizo: boolean;
}

export async function POST(request: NextRequest) {
  try {
    let body: { matchId?: unknown; rol?: unknown; token?: unknown; aceptado?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return json({ ok: false, error: 'Solicitud inválida.' }, 400);
    }

    const matchId = typeof body.matchId === 'string' ? body.matchId : '';
    const rol = body.rol;
    const token = typeof body.token === 'string' ? body.token : '';
    const aceptado = body.aceptado === true;

    if (!matchId) return json({ ok: false, error: 'Falta el identificador de la coincidencia.' }, 400);
    if (rol !== 'PERDIDO' && rol !== 'BUSCA_DUEÑO') {
      return json({ ok: false, error: 'Selecciona un rol válido.' }, 400);
    }
    if (!aceptado) {
      return json({ ok: false, error: 'Debes aceptar la Política de Privacidad para compartir tus datos.' }, 400);
    }

    const lado: LadoAutorizacion = ladoDeRol(rol as RolPublicacion);
    const supabase = createServerSupabase();

    // --- 1. Traer el match con ambas publicaciones ---
    const { data: fila, error: errorMatch } = await supabase
      .from('matches_ia')
      .select(
        'id, perrito_perdido_id, perrito_encontrado_id, porcentaje_similitud, dueno_autorizo, encontrador_autorizo',
      )
      .eq('id', matchId)
      .maybeSingle();

    if (errorMatch) return json({ ok: false, error: 'No pudimos verificar la coincidencia.' }, 500);
    if (!fila) return json({ ok: false, error: 'Esta coincidencia ya no existe.' }, 404);
    const match = fila as FilaMatch;

    // --- 2. Verificar identidad: sesión del dueño del lado O token firmado ---
    const { data: pares } = await supabase
      .from('perritos')
      .select('*, usuario:usuarios(id, nombre, telefono, email)')
      .in('id', [match.perrito_perdido_id, match.perrito_encontrado_id]);

    const perdido = (pares ?? []).find((p) => p.id === match.perrito_perdido_id);
    const encontrado = (pares ?? []).find((p) => p.id === match.perrito_encontrado_id);
    if (!perdido || !encontrado) return json({ ok: false, error: 'Faltan datos del match.' }, 500);

    const quienAutoriza = lado === 'dueno' ? perdido : encontrado;
    const correoDelLado = (quienAutoriza?.usuario?.email ?? '').toLowerCase();

    const sesion = leerSesion(request);
    const sesionValida = !!sesion?.email && correoDelLado !== '' && sesion.email.toLowerCase() === correoDelLado;
    const tokenValido = verificarTokenCompartirContacto(matchId, lado, token);

    if (!sesionValida && !tokenValido) {
      return json(
        { ok: false, error: 'No puedes autorizar este intercambio: la sesión no corresponde a esta publicación.' },
        403,
      );
    }

    const autorizacion = {
      dueno_autorizo: !!match.dueno_autorizo,
      encontrador_autorizo: !!match.encontrador_autorizo,
    };

    // --- 3. Idempotente: si ya autorizó, solo devolver el estado ---
    const yaEra = yaAutorizado(autorizacion, lado);
    if (!yaEra) {
      await registrarConsentimiento(supabase, {
        match_id: matchId,
        usuario_id: quienAutoriza?.usuario?.id ?? '',
        lado,
      });

      await supabase
        .from('matches_ia')
        .update(lado === 'dueno' ? { dueno_autorizo: true } : { encontrador_autorizo: true })
        .eq('id', matchId);
    }

    // --- 4. Correo a la contraparte SOLO la primera vez (nunca bloquea) ---
    let notificacion: NotificacionEstado | undefined;
    if (!yaEra) {
      const receptor = lado === 'dueno' ? encontrado : perdido;
      notificacion = await notificarContactoCompartido({
        matchId,
        porcentajeSimilitud: match.porcentaje_similitud,
        compartidor: {
          perrito: quienAutoriza,
          usuario: quienAutoriza.usuario ?? { nombre: '', telefono: '', email: null },
        },
        receptor: {
          perrito: receptor,
          usuario: receptor.usuario ?? { nombre: '', telefono: '', email: null },
        },
      });
    }

    const ahora = {
      dueno_autorizo: lado === 'dueno' || autorizacion.dueno_autorizo,
      encontrador_autorizo: lado === 'encontrador' || autorizacion.encontrador_autorizo,
    };

    return json({
      ok: true,
      autorizacion: ahora,
      notificacion,
      mensaje: yaEra
        ? 'Ya habías autorizado compartir tus datos de contacto con la contraparte.'
        : 'Listo: tus datos de contacto ahora están disponibles para la contraparte y le enviamos un correo con ellos.',
    });
  } catch (error) {
    console.error('Error en /api/consentimientos:', error);
    return json({ ok: false, error: 'Ocurrió un error interno. Intenta de nuevo.' }, 500);
  }
}

/** Registra la autorización en la tabla de auditoría (no bloquea). */
async function registrarConsentimiento(
  supabase: SupabaseClient,
  registro: { match_id: string; usuario_id: string; lado: LadoAutorizacion },
): Promise<void> {
  try {
    await supabase.from('consentimientos').upsert(
      {
        ...registro,
        tipo: 'compartir_contacto',
        texto_aceptado: `${TEXTO_CONSENTIMIENTO_CONTACTO} [${POLITICA_PRIVACIDAD_VERSION}]`,
      },
      { onConflict: 'match_id,usuario_id,lado,tipo', ignoreDuplicates: true },
    );
  } catch (error) {
    console.error('Registrar consentimiento falló:', error);
  }
}