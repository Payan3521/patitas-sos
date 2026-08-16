'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Header } from '@/components/Header';
import { useAuth } from '@/components/AuthProvider';

const inputCls =
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-200';

/**
 * 🔐 Inicio de sesión propio (email + contraseña).
 * Sin código OTP, sin rate limiting: valida contra la tabla `usuarios`
 * y guarda la sesión en una cookie segura.
 */
export default function IniciarSesionPage() {
  const { session, loading, login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!loading && session) router.replace('/');
  }, [loading, session, router]);

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setInfo('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setEnviando(true);
    try {
      const { error: err } = await login(email.trim().toLowerCase(), password);
      if (err) throw new Error(err);
      router.replace('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos iniciar sesión. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-md px-4 pb-24 pt-10">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <div className="text-5xl">🔐</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-900">Iniciar sesión</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Con tu correo y tu contraseña. Sin códigos, sin esperas.
            </p>
          </div>

          <form onSubmit={entrar} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-neutral-700">Tu correo electrónico</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ej: maria@gmail.com"
                className={inputCls}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-neutral-700">Tu contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
                required
              />
            </label>
            <button
              type="submit"
              disabled={enviando}
              className="w-full rounded-full bg-amber-500 py-3.5 text-base font-black text-white shadow-lg transition hover:bg-amber-600 disabled:opacity-60"
            >
              {enviando ? 'Entrando…' : '🔓 Iniciar sesión'}
            </button>
          </form>

          {info && (
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-medium text-sky-800">
              ℹ️ {info}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <p className="mt-5 text-center text-xs leading-relaxed text-neutral-500">
            ¿No tienes cuenta?{' '}
            <Link href="/registrarse" className="font-bold text-amber-600 underline">
              Regístrate gratis
            </Link>
            <br />
            <span className="text-neutral-400">
              ¿Ya publicaste antes? Regístrate con el mismo correo para asignarle tu contraseña.
            </span>
          </p>

          <p className="mt-5 text-center text-xs leading-relaxed text-neutral-400">
            Al iniciar sesión podrás publicar reportes, ver{' '}
            <Link href="/mis-publicaciones" className="font-bold text-amber-600 underline">
              tus publicaciones
            </Link>{' '}
            y recibir{' '}
            <Link href="/notificaciones" className="font-bold text-amber-600 underline">
              notificaciones
            </Link>{' '}
            cuando la IA encuentre una coincidencia.
          </p>
        </div>
      </main>
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        🐾 Patitas SOS · Plataforma para reconectar mascotas perdidas con sus familias
      </footer>
    </div>
  );
}