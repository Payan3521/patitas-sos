// ============================================================
// 🐾 PATITAS SOS — GET /api/perritos
//
// Feed con paginación rápida (scroll infinito) y filtros:
//   ?departamento=  ?ciudad=  ?barrio=  ?rol=PERDIDO|BUSCA_DUEÑO
//   ?estado=ACTIVO|ENCONTRADA  ?page=  ?pageSize=
//
// Categorías del home:
//   - "Se buscan"      → rol=PERDIDO, estado=ACTIVO
//   - "Buscan su dueño"→ rol=BUSCA_DUEÑO, estado=ACTIVO
//   - "Encontradas"    → estado=ENCONTRADA (cualquier rol)
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { FEED_PAGE_SIZE } from '@/lib/constants';
import { createServerSupabase } from '@/lib/supabase-server';
import type { Perrito } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sandbox de privacidad para el feed público: nunca expone datos personales
 *  (contacto del publicador ni barrio). El contacto solo llega con un match +
 *  autorización expresa (ver src/lib/permisos.ts). */
function sandboxPrivacidad(perrito: Perrito): Perrito {
  return {
    ...perrito,
    barrio_zona: null,
    usuario: null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const departamento = searchParams.get('departamento')?.trim() || null;
    const ciudad = searchParams.get('ciudad')?.trim() || null;
    const barrio = searchParams.get('barrio')?.trim() || null;
    const rol = searchParams.get('rol')?.trim() || null;
    const estado = searchParams.get('estado')?.trim() || null;
    const page = Math.max(1, Number.parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const pageSize = Math.min(
      24,
      Math.max(1, Number.parseInt(searchParams.get('pageSize') ?? String(FEED_PAGE_SIZE), 10) || FEED_PAGE_SIZE),
    );

    const supabase = createServerSupabase();

    let query = supabase
      .from('perritos')
      .select('*', { count: 'exact' })
      .order('creado_en', { ascending: false });

    if (estado === 'ACTIVO' || estado === 'ENCONTRADA') {
      query = query.eq('estado', estado);
    } else {
      // Sin estado explícito (categoría "Todos"): solo ACTIVO + ENCONTRADA,
      // nunca los reportes RECONCILIADO de la etapa anterior a la migración.
      query = query.in('estado', ['ACTIVO', 'ENCONTRADA']);
    }
    if (departamento) query = query.eq('departamento', departamento);
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

    const perritos = (data ?? []).map((p) => sandboxPrivacidad(p as Perrito));
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