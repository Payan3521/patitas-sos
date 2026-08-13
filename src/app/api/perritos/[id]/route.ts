// ============================================================
// 🐾 PATITAS SOS — GET /api/perritos/[id]
//
// Devuelve un reporte individual con los datos de contacto de
// quien lo publicó (para la página de detalle).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    return json({ ok: true, perrito });
  } catch (error) {
    console.error('Error en /api/perritos/[id]:', error);
    return json({ ok: false, error: 'Error interno del servidor.' }, 500);
  }
}