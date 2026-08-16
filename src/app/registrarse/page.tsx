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
 * 📝 Registro gratuito (email + contraseña, sin confirmación por correo).
 * Si el correo ya existe (alguien que publicó antes), "reclama" la cuenta
 * y le asigna su contraseña. Al registrarte quedas con sesión iniciada.
 */
export default function RegistrarsePage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', password: '', confirmacion: '' });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (!loading && session) router.replace('/');
  }, [loading, session, router]);

  async function registrarse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setInfo('');
    if (form.nombre.trim().length < 2) {
      setError('Escribe tu nombre (mínimo 2 caracteres).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('Ingresa un correo electrónico válido.');
      return;
    }
    if (!/^\+?[0-9\s-]{7,20}$/.test(form.telefono.trim())) {
      setError('Ingresa un teléfono válido (mínimo 7 dígitos).');
      return;
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (form.password !== form.confirmacion) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          telefono: form.telefono.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'No pudimos crear tu cuenta.');
      }
      setInfo('¡Cuenta lista! Ya iniciaste sesión. 🔓');
      setTimeout(() => router.replace('/'), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos crear tu cuenta. Intenta de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  const set = (campo: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [campo]: e.target.value }));

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-md px-4 pb-24 pt-10">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <div className="text-5xl">🐾</div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-900">Crear mi cuenta</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Gratis y sin confirmación por correo. Publiques reportes y recibe avisos cuando la IA
              encuentre una coincidencia.
            </p>
          </div>

          <form onSubmit={registrarse} className="mt-5 space-y-3">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-neutral-700">Tu nombre</span>
              <input
                type="text"
                autoComplete="name"
                value={form.nombre}
                onChange={set('nombre')}
                placeholder="ej: María Pérez"
                className={inputCls}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-neutral-700">Tu teléfono</span>
              <input
                type="tel"
                autoComplete="tel"
                value={form.telefono}
                onChange={set('telefono')}
                placeholder="ej: 310 123 4567"
                className={inputCls}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-neutral-700">Tu correo electrónico</span>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={set('email')}
                placeholder="ej: maria@gmail.com"
                className={inputCls}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-neutral-700">Contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={set('password')}
                placeholder="Mínimo 6 caracteres"
                className={inputCls}
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-neutral-700">Repite la contraseña</span>
              <input
                type="password"
                autoComplete="new-password"
                value={form.confirmacion}
                onChange={set('confirmacion')}
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
              {enviando ? 'Creando cuenta…' : '📝 Crear mi cuenta'}
            </button>
          </form>

          {info && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
              ✅ {info}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
              ⚠️ {error}
            </div>
          )}

          <p className="mt-5 text-center text-xs leading-relaxed text-neutral-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/iniciar-sesion" className="font-bold text-amber-600 underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </main>
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        🐾 Patitas SOS · Plataforma para reconectar mascotas perdidas con sus familias
      </footer>
    </div>
  );
}