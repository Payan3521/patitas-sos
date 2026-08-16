'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { accessTokenHeader, useAuth } from '@/components/AuthProvider';

/**
 * Encabezado sticky con la marca, el estado de la sesión y el CTA de publicación.
 * Si hay sesión: email, "Mis publicaciones", "Mis avisos" (con badge de
 * no leídas de los hilos que iniciaste), campana de notificaciones con
 * contador de no leídas y botón para cerrar sesión.
 */
export function Header() {
  const { session, email, loading, signOut } = useAuth();
  const [noLeidas, setNoLeidas] = useState(0);
  const [chatNoLeidas, setChatNoLeidas] = useState(0);
  const [misAvisosNoLeidas, setMisAvisosNoLeidas] = useState(0);

  useEffect(() => {
    if (!session) {
      setNoLeidas(0);
      setChatNoLeidas(0);
      setMisAvisosNoLeidas(0);
      return;
    }
    let cancel = false;
    let intervalo: ReturnType<typeof setInterval> | null = null;

    const actualizar = () => {
      fetch('/api/notificaciones', { headers: accessTokenHeader(session) })
        .then((res) => res.json())
        .then((data) => {
          if (!cancel) {
            const avisos = typeof data.avisosNoLeidos === 'number' ? data.avisosNoLeidos : 0;
            setNoLeidas((typeof data.noLeidas === 'number' ? data.noLeidas : 0) + avisos);
            setMisAvisosNoLeidas(
              typeof data.avisosRecibidosNoLeidos === 'number' ? data.avisosRecibidosNoLeidos : 0,
            );
          }
        })
        .catch(() => {});
      fetch('/api/mensajes', { headers: accessTokenHeader(session) })
        .then((res) => res.json())
        .then((data) => {
          if (!cancel) setChatNoLeidas(typeof data.noLeidasTotal === 'number' ? data.noLeidasTotal : 0);
        })
        .catch(() => {});
    };

    actualizar();
    intervalo = setInterval(actualizar, 30_000);
    return () => {
      cancel = true;
      if (intervalo) clearInterval(intervalo);
    };
  }, [session]);

  async function cerrarSesion() {
    await signOut();
    // Navegación dura: tras borrar la cookie, una carga completa evita que el
    // guard de sesión de la página actual (router.replace('/iniciar-sesion'))
    // gane la carrera contra router.push y deje al usuario en el login.
    window.location.assign('/');
  }

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-neutral-900">
          <span className="text-2xl">🐾</span>
          Patitas <span className="text-amber-500">SOS</span>
        </Link>

        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {!loading && !session && (
            <Link
              href="/iniciar-sesion"
              className="rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 sm:text-sm"
            >
              Iniciar sesión
            </Link>
          )}

          {!loading && session && (
            <>
              <span className="hidden max-w-40 truncate text-xs font-semibold text-neutral-600 md:inline">
                {email}
              </span>
              <Link
                href="/mis-publicaciones"
                title="Mis publicaciones"
                className="rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 sm:text-sm"
              >
                📋 Mis publicaciones
              </Link>
              <Link
                href="/mis-avisos"
                title="Mis avisos"
                className="relative rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-700 transition hover:bg-neutral-50 sm:text-sm"
              >
                👀 Mis avisos
                {misAvisosNoLeidas > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1 text-[10px] font-black text-white">
                    {misAvisosNoLeidas > 9 ? '9+' : misAvisosNoLeidas}
                  </span>
                )}
              </Link>
              <Link
                href="/chat"
                title="Chat"
                className="relative rounded-full border border-neutral-300 bg-white p-2.5 text-sm transition hover:bg-neutral-50"
              >
                💬
                {chatNoLeidas > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-black text-white">
                    {chatNoLeidas > 9 ? '9+' : chatNoLeidas}
                  </span>
                )}
              </Link>
              <Link
                href="/notificaciones"
                title="Notificaciones"
                className="relative rounded-full border border-neutral-300 bg-white p-2.5 text-sm transition hover:bg-neutral-50"
              >
                🔔
                {noLeidas > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
                    {noLeidas > 9 ? '9+' : noLeidas}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={cerrarSesion}
                className="rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-bold text-neutral-500 transition hover:bg-neutral-50 sm:text-sm"
              >
                Salir
              </button>
            </>
          )}

          <Link
            href="/publicar"
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
          >
            + Publicar
          </Link>
        </div>
      </div>
    </header>
  );
}
