'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { accessTokenHeader, useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { timeAgo } from '@/lib/format';
import { textosEspecie } from '@/lib/especie';
import type { MisAvisosResponse } from '@/lib/types';

/**
 * 👀 Mis avisos: los hilos "Vi esta mascota" que INICIASTE.
 *
 * Aquí es donde SIEMPRE puedes volver a hablar con la persona que
 * publicó, aunque hayas cerrado la sesión en medio de la
 * conversación: con tu cuenta, el hilo te espera. El botón 🔕 de
 * "dejar de recibir avisos" solo lo tiene la persona que publicó.
 */
export default function MisAvisosPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [avisos, setAvisos] = useState<MisAvisosResponse['avisos'] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/iniciar-sesion');
      return;
    }
    fetch('/api/mis-avisos', { headers: accessTokenHeader(session) })
      .then(async (res) => {
        const data: MisAvisosResponse = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? 'No pudimos cargar tus avisos.');
        setAvisos(data.avisos);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ocurrió un error.'));
  }, [loading, session, router]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight sm:text-3xl">👀 Mis avisos</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Los hilos que iniciaste al avisar "Vi esta mascota": si te responden, la conversación
            vive aquí con tu cuenta.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {avisos === null && !error && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
              Cargando tus avisos…
            </div>
          )}

          {avisos !== null && avisos.length === 0 && (
            <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center">
              <div className="text-5xl">🐾</div>
              <h2 className="mt-2 text-lg font-black text-neutral-800">Aún no has avisado a nadie</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Cuando veas una publicación de una mascota perdida o en busca de hogar y avises{" "}
                <b>"Vi esta mascota"</b>, el hilo aparecerá aquí.
              </p>
              <Link
                href="/"
                className="mt-5 inline-block rounded-full bg-amber-500 px-8 py-3 text-base font-black text-white shadow-lg transition hover:bg-amber-600"
              >
                Ver publicaciones
              </Link>
            </div>
          )}

          {avisos?.map((aviso) => {
            const esPerdido = aviso.perrito.rol_publicacion === 'PERDIDO';
            const nombre =
              aviso.perrito.nombre_temporal ||
              textosEspecie(aviso.perrito.especie)[esPerdido ? 'perdido' : 'rescatado'];
            const ultimo = aviso.ultimo_mensaje;
            return (
              <Link
                key={aviso.aviso_id}
                href={`/aviso/${aviso.aviso_id}`}
                className="flex items-center gap-4 rounded-3xl border border-neutral-200 bg-white p-4 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/40"
              >
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-200">
                  <Image
                    src={aviso.perrito.foto_url}
                    alt={nombre}
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {aviso.noLeidas > 0 && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" title="Tienes mensajes sin leer" />
                    )}
                    <p className="truncate text-base font-extrabold text-neutral-900">{nombre}</p>
                  </div>
                  <p className="truncate text-xs text-neutral-500">
                    📍 {aviso.perrito.departamento} · {aviso.perrito.ciudad}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-neutral-600">
                    {ultimo
                      ? `${ultimo.autor === 'dueño' ? 'La persona que publica' : 'Tú'}: ${ultimo.contenido}`
                      : 'Sin mensajes aún'}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-neutral-400">{timeAgo(aviso.creado_en)}</p>
                  <p className={`mt-1 text-xs font-bold ${aviso.noLeidas > 0 ? 'text-rose-600' : 'text-sky-700'}`}>
                    {aviso.noLeidas > 0 ? `${aviso.noLeidas} sin leer · ` : ''}Abrir →
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        🐾 Patitas SOS ·{' '}
        <a href="/politica-de-privacidad" className="underline">
          Política de Privacidad
        </a>
      </footer>
    </div>
  );
}