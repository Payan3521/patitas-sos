// ============================================================
// 🐾 PATITAS SOS — POST /api/logout
//
// Borra la cookie de sesión. No requiere estar logueado.
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { cookieDeCierre } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(_request: NextRequest) {
  const response = NextResponse.json({ ok: true });
  response.headers.set('set-cookie', cookieDeCierre());
  return response;
}
