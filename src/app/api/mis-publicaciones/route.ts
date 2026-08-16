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
import type { MatchRef } from '@/lib/types';

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
  let pares: { perrito_perdido_id: string; perrito_encontrado_id: string; porcentaje_similitud: number }[] = [];
  if (ids.length > 0) {
    const { data: matchesData } = await supabase
      .from('matches_ia')
      .select('perrito_perdido_id, perrito_encontrado_id, porcentaje_similitud')
      .or(`perrito_perdido_id.in.(${ids.join(',')}),perrito_encontrado_id.in.(${ids.join(',')})`);
    pares = matchesData ?? [];
  }

  const resultado = (perritos ?? []).map((perrito) => {
    const matches: MatchRef[] = pares
      .filter((m) => m.perrito_perdido_id === perrito.id || m.perrito_encontrado_id === perrito.id)
      .map((m) => ({
        contraparte_id: m.perrito_perdido_id === perrito.id ? m.perrito_encontrado_id : m.perrito_perdido_id,
        porcentaje_similitud: m.porcentaje_similitud,
      }));
    return { ...perrito, matches };
  });

  return json({ ok: true, perritos: resultado });
}
