// ============================================================
// 🐾 Patitas SOS — GET /api/perritos
//
// Feed con paginación rápida (scroll infinito) y filtros:
//   ?ciudad=  ?barrio=  ?rol=PERDIDO|BUSCA_DUEÑO  ?page=  ?pageSize=
// Solo devuelve reportes ACTIVOS, ordenados del más reciente al más viejo.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { FEED_PAGE_SIZE } from '@/lib/constants';
import { createServerSupabase } from '@/lib/supabase-server';
import type { Perrito } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const ciudad = searchParams.get('ciudad')?.trim() || null;
    const barrio = searchParams.get('barrio')?.trim() || null;
    const rol = searchParams.get('rol')?.trim() || null;
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(
      24,
      Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? String(FEED_PAGE_SIZE), 10) || FEED_PAGE_SIZE),
    );

    const supabase = createServerSupabase();

    let query = supabase
      .from('perritos')
      .select('*, usuario:usuarios(id, nombre, telefono, email)', { count: 'exact' })
      .eq('estado', 'ACTIVO')
      .order('creado_en', { ascending: false });

    if (ciudad) query = query.eq('ciudad', ciudad);
    if (barrio) query = query.ilike('barrio_zona', `%${barrio}%`);
    if (rol === 'PERDIDO' || rol === 'BUSCA_DUEÑO') query = query.eq('rol_publicacion', rol);

    const from = (page - 1) * pageSize;
    query = query.range(from, from + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error en /api/perritos:', error);
      return NextResponse.json(
        { perritos: [], total: 0, page, pageSize, hasMore: false, error: 'No se pudieron cargar los reportes.' },
        { status: 500 },
      );
    }

    const perritos = (data ?? []) as Perrito[];
    const total = count ?? perritos.length;

    return NextResponse.json({
      perritos,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    });
  } catch (error) {
    console.error('Error en /api/perritos:', error);
    return NextResponse.json(
      { perritos: [], total: 0, page: 1, pageSize: FEED_PAGE_SIZE, hasMore: false, error: 'Error interno del servidor.' },
      { status: 500 },
    );
  }
}
