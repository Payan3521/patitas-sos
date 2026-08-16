// ============================================================
// 🐾 PATITAS SOS — POST /api/perritos/[id]/avisos
//
// Activa/desactiva los avisos "👀 Vi esta mascota" de una de MIS
// publicaciones (botón 🔕 del dueño).
//
// Body: { habilitados: boolean }  — Verifica sesión: solo el dueño
// (mismo email en la sesión y en la publicación).
//
// Efectos:
//   - habilitados=false → no se crean avisos nuevos y el testigo ya
//     no puede escribir más; el dueño sí puede leer y responder.
//   - habilitados=true  → la publicación vuelve a recibir avisos.
//   - Los hilos existentes nunca se borran.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = leerSesion(request);
  if (!sesion?.email) return json({ ok: false, error: 'Debes iniciar sesión.' }, 401);

  let body: { habilitados?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ ok: false, error: 'Solicitud inválida.' }, 400);
  }
  if (typeof body.habilitados !== 'boolean') {
    return json({ ok: false, error: 'Falta el estado de los avisos.' }, 400);
  }

  const supabase = createServerSupabase();
  const { data: perrito } = await supabase
    .from('perritos')
    .select('id, usuario_id')
    .eq('id', id)
    .maybeSingle();
  if (!perrito) return json({ ok: false, error: 'Esta publicación ya no existe.' }, 404);

  const { data: miUsuario } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase())
    .maybeSingle();
  if (!miUsuario || miUsuario.id !== perrito.usuario_id) {
    return json({ ok: false, error: 'Solo la persona que publicó puede cambiar los avisos.' }, 403);
  }

  const { error } = await supabase
    .from('perritos')
    .update({ avisos_habilitados: body.habilitados })
    .eq('id', id);
  if (error) {
    console.error('Actualizar avisos_habilitados falló:', error);
    return json({ ok: false, error: 'No pudimos actualizar los avisos. Intenta de nuevo.' }, 500);
  }

  return json({ ok: true, avisos_habilitados: body.habilitados });
}