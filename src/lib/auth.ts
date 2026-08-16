// ============================================================
// 🐾 Patitas SOS — Sesión propia (login email + contraseña)
//
// Reemplaza a Supabase Auth por completo:
//   - Contraseñas: hash scrypt (node:crypto, sin dependencias nuevas)
//     con comparación timing-safe contra ataques de fuerza bruta.
//   - Sesión: token firmado HMAC-SHA256 con APP_TOKEN_SECRET.
//     Se entrega como cookie HttpOnly + SameSite=Lax (30 días).
//   - Sin rate limiting: el usuario accede las veces que quiera.
// ============================================================

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

export const SESION_COOKIE = 'patitas_sesion';
const SESION_DIAS = 30;
const SESION_MS = SESION_DIAS * 24 * 60 * 60 * 1000;

export interface SesionPropia {
  uid: string;
  email: string;
  exp: number;
}

function secreto(): string {
  const secret = process.env.APP_TOKEN_SECRET;
  if (!secret) throw new Error('Falta APP_TOKEN_SECRET en las variables de entorno.');
  return secret;
}

// ----------------------------------------------------------------------------
// Contraseñas (scrypt)
// ----------------------------------------------------------------------------

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

/** Formato: scrypt$N$r$p$salt$hash (todo hex/base64 sin depender de la plataforma). */
export function hashContrasena(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  }).toString('hex');
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${hash}`;
}

export function verificarContrasena(password: string, stored: string): boolean {
  try {
    const [algo, n, r, p, salt, hash] = stored.split('$');
    if (algo !== 'scrypt' || !hash) return false;
    const expected = Buffer.from(hash, 'hex');
    const actual = scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Token de sesión (HMAC-SHA256)
// ----------------------------------------------------------------------------

function firmarToken(payload: Omit<SesionPropia, 'exp'> & { exp: number }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const firma = createHmac('sha256', secreto()).update(body).digest('base64url');
  return `${body}.${firma}`;
}

export function sesionDeToken(token: string | null | undefined): SesionPropia | null {
  if (!token) return null;
  const [body, firma] = token.split('.');
  if (!body || !firma) return null;

  const firmaEsperada = createHmac('sha256', secreto()).update(body).digest('base64url');
  const a = Buffer.from(firma);
  const b = Buffer.from(firmaEsperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SesionPropia;
    if (typeof payload.uid !== 'string' || typeof payload.email !== 'string') return null;
    if (typeof payload.exp !== 'number' || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Lee la sesión de la cookie httpOnly o del header Authorization: Bearer. */
export function leerSesion(request: NextRequest): SesionPropia | null {
  const deCookie = sesionDeToken(request.cookies.get(SESION_COOKIE)?.value);
  if (deCookie) return deCookie;

  const authHeader = request.headers.get('authorization') ?? '';
  const deBearer = sesionDeToken(authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '');
  return deBearer;
}

export function cookieDeSesion(usuario: { id: string; email: string }): {
  token: string;
  cookie: string;
} {
  const payload = {
    uid: usuario.id,
    email: usuario.email.toLowerCase(),
    exp: Date.now() + SESION_MS,
  };
  const token = firmarToken(payload);
  const cookie = `${SESION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESION_DIAS * 86400}`;
  return { token, cookie };
}

export function cookieDeCierre(): string {
  return `${SESION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
