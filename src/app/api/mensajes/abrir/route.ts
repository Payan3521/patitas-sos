// ============================================================
// 🐾 PATITAS SOS — /api/mensajes/abrir
//
// POST: abre (crea o reutiliza) la conversación de un match.
//       `{ matchId }` — valida que el usuario sea parte del par
//       y que el OTRO lado haya autorizado compartir su contacto
//       (regla de habilitación del chat, lib/chat.ts).
// Devuelve la conversación existente o la recién creada.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { chatHabilitadoPara, crearConversacion, encontrarConversacion, ladoDelUsuario, participantesDeMatch } from '@/lib/chat';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function POST(request: NextRequest) {
  const sesion = leerSesion(request);
  if (!sesion?.email) return json({ ok: false, error: 'Debes iniciar sesión.' }, 401);

  let body: { matchId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido.' }, 400);
  }
  const matchId = typeof body.matchId === 'string' ? body.matchId : '';
  if (!matchId) return json({ ok: false, error: 'Falta la coincidencia.' }, 400);

  const supabase = createServerSupabase();
  const participantes = await participantesDeMatch(supabase, matchId);
  if (!participantes) return json({ ok: false, error: 'Esta coincidencia ya no existe.' }, 404);

  const { data: miUsuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase())
    .maybeSingle();
  if (!miUsuario) return json({ ok: false, error: 'Tu cuenta no está disponible.' }, 404);

  const lado = ladoDelUsuario(participantes.perdido, participantes.encontrado, miUsuario.id);
  if (!lado) return json({ ok: false, error: 'No participas en esta coincidencia.' }, 403);

  const existente = await encontrarConversacion(supabase, matchId);
  if (existente) return json({ ok: true, conversacion_id: existente.id });

  // Regla de habilitación: la contraparte debe haber autorizado su contacto.
  const rolPropio = participantes.perdido.usuario_id === miUsuario.id ? 'PERDIDO' : 'BUSCA_DUEÑO';
  if (!chatHabilitadoPara(participantes.autorizacion, rolPropio)) {
    return json(
      {
        ok: false,
        error:
          'La otra persona aún no ha autorizado compartir su contacto, así que el chat todavía no se habilita. Comparte el tuyo para desbloquear el intercambio.',
      },
      403,
    );
  }

  const nueva = await crearConversacion(supabase, matchId);
  if (!nueva) return json({ ok: false, error: 'No pudimos abrir la conversación. Intenta de nuevo.' }, 500);

  return json({ ok: true, conversacion_id: nueva.id });
}