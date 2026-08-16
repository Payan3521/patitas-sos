// ============================================================
// 🐾 PATITAS SOS — /api/notificaciones
//
// GET : lista las notificaciones web del usuario logueado
//       (con el perrito de la contraparte y el contacto del
//       publicador) + conteo de no leídas.
// POST: marca como leída una notificación (`{ id }`) o todas
//       (`{}`).
//
// ⚠️ La tabla notificaciones tiene DOS llaves foráneas a perritos
//    (perrito_id y mi_perrito_id): los joins SIEMPRE deben indicar
//    la FK explícita (perritos!notificaciones_perrito_id_fkey / 
//    perritos!notificaciones_mi_perrito_id_fkey), o PostgREST
//    responde PGRST201 (relación ambigua) y la bandeja se ve vacía.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

async function obtenerUsuarioIds(request: NextRequest): Promise<{ ids: string[]; error?: Response }> {
  const sesion = leerSesion(request);
  if (!sesion?.email) return { ids: [], error: json({ ok: false, error: 'Debes iniciar sesión.' }, 401) };

  const supabase = createServerSupabase();
  const { data: usuarios, error: usuarioError } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', sesion.email.toLowerCase());

  if (usuarioError) {
    console.error('Error buscando el usuario de la sesión:', usuarioError);
    return { ids: [], error: json({ ok: false, error: 'No pudimos cargar tus datos. Intenta de nuevo.' }, 500) };
  }
  return { ids: (usuarios ?? []).map((u) => u.id) };
}

export async function GET(request: NextRequest) {
  const { ids, error } = await obtenerUsuarioIds(request);
  if (error) return error;
  if (ids.length === 0) return json({ ok: true, notificaciones: [], noLeidas: 0 });

  const supabase = createServerSupabase();
  const { data: notificaciones, error: queryError } = await supabase
    .from('notificaciones')
    .select(
      `*, perrito:perritos!notificaciones_perrito_id_fkey(id, nombre_temporal, descripcion, foto_url, rol_publicacion, estado, departamento, ciudad, usuario:usuarios(id, nombre, telefono, email)), mi_perrito:perritos!notificaciones_mi_perrito_id_fkey(id, nombre_temporal, rol_publicacion, estado)`,
    )
    .in('usuario_id', ids)
    .order('creado_en', { ascending: false })
    .limit(50);

  if (queryError) {
    console.error('Error cargando notificaciones:', queryError);
    return json({ ok: false, error: 'No pudimos cargar las notificaciones. Intenta de nuevo.' }, 500);
  }

  const lista = notificaciones ?? [];
  return json({
    ok: true,
    notificaciones: lista,
    noLeidas: lista.filter((n) => !n.leida).length,
  });
}

export async function POST(request: NextRequest) {
  const { ids, error } = await obtenerUsuarioIds(request);
  if (error) return error;
  if (ids.length === 0) return json({ ok: false, error: 'Debes iniciar sesión.' }, 401);

  let id: string | null = null;
  try {
    const body = (await request.json()) as { id?: string };
    id = typeof body.id === 'string' ? body.id : null;
  } catch {
    // sin body = marcar todas
  }

  const supabase = createServerSupabase();
  let query = supabase.from('notificaciones').update({ leida: true }).in('usuario_id', ids);
  if (id) query = query.eq('id', id);

  const { error: updateError } = await query;
  if (updateError) {
    console.error('Marcar notificaciones como leídas falló:', updateError);
    return json({ ok: false, error: 'No pudimos actualizar las notificaciones.' }, 500);
  }

  return json({ ok: true });
}