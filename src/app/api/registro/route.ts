// ============================================================
// 🐾 PATITAS SOS — POST /api/registro
//
// Crea una cuenta propia (email + contraseña, sin Supabase Auth):
//   - Si el correo NO existe → inserta un usuario nuevo con su
//     password_hash (scrypt).
//   - Si el correo YA existe (p. ej. quien publicó antes con el
//     login por código) → "reclama la cuenta": asigna/renueva la
//     contraseña y actualiza nombre/teléfono. Nunca duplica.
// Al terminar inicia sesión automáticamente (cookie httpOnly).
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookieDeSesion, hashContrasena } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  let body: { nombre?: unknown; telefono?: unknown; email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Envío inválido.' }, 400);
  }

  const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
  const telefono = typeof body.telefono === 'string' ? body.telefono.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (nombre.length < 2 || nombre.length > 100) {
    return json({ ok: false, error: 'Escribe tu nombre (mínimo 2 caracteres).' }, 400);
  }
  if (!EMAIL_RE.test(email)) {
    return json({ ok: false, error: 'Ingresa un correo electrónico válido.' }, 400);
  }
  if (!/^\+?[0-9\s-]{7,20}$/.test(telefono)) {
    return json({ ok: false, error: 'Ingresa un teléfono válido (mínimo 7 dígitos).' }, 400);
  }
  if (password.length < 6) {
    return json({ ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' }, 400);
  }

  const supabase = createServerSupabase();
  const passwordHash = hashContrasena(password);

  const { data: existing } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  let usuarioId: string;
  if (existing) {
    // Reclamar cuenta: asignar contraseña y refrescar datos de contacto.
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ nombre, telefono, password_hash: passwordHash })
      .eq('id', existing.id);
    if (updateError) {
      console.error('Reclamar cuenta falló:', updateError);
      return json({ ok: false, error: 'No pudimos actualizar tu cuenta. Intenta de nuevo.' }, 500);
    }
    usuarioId = existing.id;
  } else {
    const { data: nuevo, error: insertError } = await supabase
      .from('usuarios')
      .insert({ nombre, email, telefono, password_hash: passwordHash })
      .select('id')
      .single();
    if (insertError || !nuevo) {
      console.error('Registro falló:', insertError);
      return json({ ok: false, error: 'No pudimos crear tu cuenta. Intenta de nuevo.' }, 500);
    }
    usuarioId = nuevo.id;
  }

  const { cookie } = cookieDeSesion({ id: usuarioId, email });
  const response = json({ ok: true, email });
  response.headers.set('set-cookie', cookie);
  return response;
}
