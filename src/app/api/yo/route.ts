// ============================================================
// 🐾 PATITAS SOS — GET /api/yo
//
// Devuelve la sesión actual con los datos de perfil del usuario:
//   { session: { email, nombre, telefono } | null }
// El navegador la consulta al cargar para restaurar la sesión y
// prellenar los formularios con los datos de contacto guardados.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { leerSesion } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sesion = leerSesion(request);
  if (!sesion?.email) {
    return NextResponse.json({ ok: true, session: null });
  }

  const supabase = createServerSupabase();
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('nombre, telefono')
    .eq('email', sesion.email.toLowerCase())
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    session: {
      email: sesion.email,
      nombre: usuario?.nombre ?? '',
      telefono: usuario?.telefono ?? '',
    },
  });
}