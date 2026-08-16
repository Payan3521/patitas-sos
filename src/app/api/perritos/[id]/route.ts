// ============================================================
// 🐾 PATITAS SOS — GET /api/perritos/[id]
//
// 🔒 PRIVACIDAD: el contacto del publicador (nombre, teléfono,
// correo) y el barrio solo se entregan si el visitante:
//   1) es quien publicó el reporte (sesión), o
//   2) es parte de un match con él Y el publicador de este reporte
//      autorizó compartir sus datos (matches_ia.dueno_autorizo /
//      encontrador_autorizo — ver src/lib/permisos.ts).
// Cualquier otro visitante recibe el reporte "sandboxeado".
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { autorizacionDeMatch, contactoVisible } from '@/lib/permisos';
import { createServerSupabase } from '@/lib/supabase-server';
import type { AutorizacionContacto, Perrito } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = createServerSupabase();
    const { data: perrito, error } = await supabase
      .from('perritos')
      .select('*, usuario:usuarios(id, nombre, telefono, email)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error en /api/perritos/[id]:', error);
      return json({ ok: false, error: 'No se pudo cargar el reporte.' }, 500);
    }
    if (!perrito) {
      return json({ ok: false, error: 'Este reporte ya no está disponible.' }, 404);
    }

    const sesion = leerSesion(request);
    const sesionEmail = sesion?.email.toLowerCase() ?? null;
    const esPublicador = !!sesionEmail && (perrito.usuario?.email ?? '').toLowerCase() === sesionEmail;

    // ¿El visitante es parte de algún match con este reporte?
    let parteAutorizada = false;
    let autorizacion: AutorizacionContacto = { dueno_autorizo: false, encontrador_autorizo: false };
    if (!esPublicador && sesionEmail) {
      const { data: pares } = await supabase
        .from('matches_ia')
        .select('perrito_perdido_id, perrito_encontrado_id')
        .or(`perrito_perdido_id.eq.${id},perrito_encontrado_id.eq.${id}`);

      for (const par of pares ?? []) {
        const contraId = par.perrito_perdido_id === id ? par.perrito_encontrado_id : par.perrito_perdido_id;
        const { data: contra } = (await supabase
          .from('perritos')
          .select('usuario:usuarios(email)')
          .eq('id', contraId)
          .maybeSingle()) as { data: { usuario: { email: string } | null } | null };
        if (!contra?.usuario?.email) continue;
        if (contra.usuario.email.toLowerCase() !== sesionEmail) continue;

        autorizacion = await autorizacionDeMatch(supabase, par.perrito_perdido_id, par.perrito_encontrado_id);
        parteAutorizada = contactoVisible(true, perrito.rol_publicacion, autorizacion);
        break;
      }
    }

    const puedeVerContacto = esPublicador || parteAutorizada;
    const perritoRespuesta: Perrito = puedeVerContacto
      ? (perrito as Perrito)
      : ({ ...perrito, barrio_zona: null, usuario: null } as Perrito);

    return json({
      ok: true,
      perrito: perritoRespuesta,
      autorizacion,
      puedeVerContacto,
      esPublicador,
    });
  } catch (error) {
    console.error('Error en /api/perritos/[id]:', error);
    return json({ ok: false, error: 'Error interno del servidor.' }, 500);
  }
}