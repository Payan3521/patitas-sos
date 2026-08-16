'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { accessTokenHeader, useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { timeAgo } from '@/lib/format';
import { textosEspecie } from '@/lib/especie';
import type { MisPublicacionesResponse, PerritoConMatches } from '@/lib/types';

/**
 * 📋 Mis publicaciones: tus reportes (perdidos y encontrados) con el estado
 * actual y, si la IA encontró una coincidencia, el enlace directo a la
 * publicación de la contraparte.
 */
export default function MisPublicacionesPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [perritos, setPerritos] = useState<PerritoConMatches[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/iniciar-sesion');
      return;
    }
    fetch('/api/mis-publicaciones', { headers: accessTokenHeader(session) })
      .then(async (res) => {
        const data: MisPublicacionesResponse = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? 'No pudimos cargar tus publicaciones.');
        setPerritos(data.perritos);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ocurrió un error.'));
  }, [loading, session, router]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">📋 Mis publicaciones</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Tus reportes y las coincidencias que la IA haya encontrado.
            </p>
          </div>
          <Link
            href="/publicar"
            className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-amber-600"
          >
            + Nueva publicación
          </Link>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {perritos === null && !error && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
              Cargando tus publicaciones…
            </div>
          )}

          {perritos !== null && perritos.length === 0 && (
            <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center">
              <div className="text-5xl">🐾</div>
              <h2 className="mt-2 text-lg font-black text-neutral-800">Aún no has publicado nada</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Publica el reporte de tu mascota perdida o de una que encontraste y te avisaremos si
                la IA encuentra una coincidencia.
              </p>
              <Link
                href="/publicar"
                className="mt-5 inline-block rounded-full bg-amber-500 px-8 py-3 text-base font-black text-white shadow-lg transition hover:bg-amber-600"
              >
                + Publicar mi primer reporte
              </Link>
            </div>
          )}

          {perritos?.map((perrito) => {
            const esPerdido = perrito.rol_publicacion === 'PERDIDO';
            const badge =
              perrito.estado === 'ENCONTRADA'
                ? 'bg-emerald-600 text-white'
                : esPerdido
                  ? 'bg-rose-600 text-white'
                  : 'bg-sky-600 text-white';
            const nombre = perrito.nombre_temporal || textosEspecie(perrito.especie)[esPerdido ? 'perdido' : 'rescatado'];

            return (
              <div key={perrito.id} className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
                <Link href={`/perrito/${perrito.id}`} className="flex gap-4 p-4 transition hover:bg-neutral-50">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-neutral-200">
                    <Image
                      src={perrito.foto_url}
                      alt={nombre}
                      fill
                      sizes="96px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-lg font-extrabold text-neutral-900">{nombre}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black tracking-wide ${badge}`}>
                        {perrito.estado === 'ENCONTRADA'
                          ? '✅ ENCONTRADA'
                          : esPerdido
                            ? '🐾 SE BUSCA'
                            : '🏠 BUSCA DUEÑO'}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-neutral-500">
                      📍 {perrito.departamento} · {perrito.ciudad}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">🕐 {timeAgo(perrito.creado_en)}</p>
                  </div>
                </Link>

                {perrito.matches.length > 0 && (
                  <div className="border-t border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-wide text-amber-700">
                      🤝 La IA encontró {perrito.matches.length === 1 ? 'una coincidencia' : `${perrito.matches.length} coincidencias`}
                    </p>
                    <div className="mt-2 space-y-1.5">
                      {perrito.matches.map((match) => (
                        <Link
                          key={match.contraparte_id}
                          href={`/perrito/${match.contraparte_id}`}
                          className="block rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
                        >
                          👀 Ver la publicación de la contraparte ·{' '}
                          <span className="font-black">{match.porcentaje_similitud.toFixed(1)}%</span>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        🐾 Patitas SOS · Plataforma para reconectar mascotas perdidas con sus familias
      </footer>
    </div>
  );
}
