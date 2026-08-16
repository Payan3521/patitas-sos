// ============================================================
// 🐾 PATITAS SOS — POST /api/login
//
// Inicio de sesión PROPIO (email + contraseña) validado contra la
// tabla `usuarios`. Sin rate limiting y sin correos OTP: ya no hay
// ningún bloqueo de Supabase Auth.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookieDeSesion, verificarContrasena } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Envío inválido.' }, 400);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return json({ ok: false, error: 'Ingresa tu correo y tu contraseña.' }, 400);
  }

  const supabase = createServerSupabase();
  const { data: usuario } = await supabase
    .from('usuarios')
    .select('id, email, password_hash')
    .eq('email', email)
    .maybeSingle();

  if (!usuario?.email || !usuario.password_hash) {
    return json(
      {
        ok: false,
        error:
          'Correo o contraseña incorrectos. Si nunca te registraste, crea tu cuenta con este correo para asignar tu contraseña.',
      },
      401,
    );
  }

  if (!verificarContrasena(password, usuario.password_hash)) {
    return json({ ok: false, error: 'Correo o contraseña incorrectos.' }, 401);
  }

  const { cookie } = cookieDeSesion({ id: usuario.id, email: usuario.email });
  const response = json({ ok: true, email: usuario.email });
  response.headers.set('set-cookie', cookie);
  return response;
}
