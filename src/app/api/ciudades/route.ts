// ============================================================
// 🐾 Patitas SOS — GET /api/ciudades
//
// Devuelve la lista de ciudades con reportes ACTIVOS (para los
// filtros del feed y el autocompletado del formulario).
// ============================================================

import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createServerSupabase();

    const { data, error } = await supabase
      .from('perritos')
      .select('ciudad')
      .eq('estado', 'ACTIVO')
      .not('ciudad', 'is', null)
      .order('ciudad', { ascending: true });

    if (error) throw error;

    const ciudades = [
      ...new Set((data ?? []).map((row) => (row.ciudad as string).trim()).filter(Boolean)),
    ];

    return NextResponse.json({ ciudades });
  } catch (error) {
    console.error('Error en /api/ciudades:', error);
    return NextResponse.json({ ciudades: [] });
  }
}
