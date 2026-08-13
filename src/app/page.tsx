'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FilterBar, type FeedFilters } from '@/components/FilterBar';
import { Header } from '@/components/Header';
import { PetCard } from '@/components/PetCard';
import { FEED_PAGE_SIZE } from '@/lib/constants';
import type { FeedResponse, Perrito } from '@/lib/types';

const EMPTY_FILTERS: FeedFilters = { ciudad: '', barrio: '', rol: '' };

/** Home / Feed principal: reportes activos con scroll infinito y filtros. */
export default function HomePage() {
  const [perritos, setPerritos] = useState<Perrito[]>([]);
  const [ciudades, setCiudades] = useState<string[]>([]);
  const [filters, setFilters] = useState<FeedFilters>(EMPTY_FILTERS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Ciudades para los filtros
  useEffect(() => {
    fetch('/api/ciudades')
      .then((res) => res.json())
      .then((data) => setCiudades(data.ciudades ?? []))
      .catch(() => {});
  }, []);

  const buildQuery = useCallback(
    (pageToLoad: number, size: number) => {
      const params = new URLSearchParams({ page: String(pageToLoad), pageSize: String(size) });
      if (filters.ciudad) params.set('ciudad', filters.ciudad);
      if (filters.barrio) params.set('barrio', filters.barrio);
      if (filters.rol) params.set('rol', filters.rol);
      return params.toString();
    },
    [filters],
  );

  const loadPage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      if (replace) setInitialLoading(true);
      else setLoadingMore(true);
      setError('');

      try {
        const res = await fetch(`/api/perritos?${buildQuery(pageToLoad, FEED_PAGE_SIZE)}`);
        if (!res.ok) throw new Error('Error de red');
        const data: FeedResponse = await res.json();

        setPerritos((prev) => (replace ? data.perritos : [...prev, ...data.perritos]));
        setTotal(data.total);
        setHasMore(data.hasMore);
        setPage(pageToLoad);
      } catch {
        setError('No pudimos cargar los reportes. Verifica tu conexión e intenta de nuevo.');
      } finally {
        setInitialLoading(false);
        setLoadingMore(false);
      }
    },
    [buildQuery],
  );

  // Carga inicial + recarga al cambiar filtros
  useEffect(() => {
    setPage(1);
    setHasMore(true);
    loadPage(1, true);
  }, [loadPage]);

  // Scroll infinito
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !initialLoading && !loadingMore) {
          loadPage(page + 1, false);
        }
      },
      { rootMargin: '300px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, initialLoading, loadingMore, page, loadPage]);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">
        {/* Hero */}
        <section className="rounded-3xl bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-6 text-white shadow-lg sm:p-10">
          <h1 className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            ¿Perdiste a tu perrito tras el sismo?
          </h1>
          <p className="mt-2 max-w-xl text-orange-50">
            Publica su foto y nuestra IA lo cruzará con los perritos rescatados en la zona.
            Juntos los reunimos con sus familias. 💛
          </p>
          <div className="mt-5">
            <Link
              href="/publicar"
              className="inline-block rounded-full bg-white px-6 py-3 font-black text-orange-600 shadow transition hover:bg-orange-50"
            >
              + Publicar reporte
            </Link>
          </div>
        </section>

        {/* Filtros */}
        <section className="mt-6">
          <FilterBar ciudades={ciudades} filters={filters} onChange={setFilters} total={total} />
        </section>

        {/* Feed */}
        <section className="mt-6">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
              ⚠️ {error}
            </div>
          )}

          {initialLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : perritos.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <div className="text-5xl">🐾</div>
              <p className="mt-3 font-bold text-neutral-700">Aún no hay reportes con estos filtros</p>
              <p className="mt-1 text-sm text-neutral-500">
                Publica el primero y ayuda a reunir a un perrito con su familia.
              </p>
              <Link
                href="/publicar"
                className="mt-4 inline-block rounded-full bg-amber-500 px-6 py-2.5 font-bold text-white transition hover:bg-amber-600"
              >
                Publicar reporte
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {perritos.map((perrito) => (
                  <PetCard key={perrito.id} perrito={perrito} />
                ))}
              </div>

              {/* Centinela del scroll infinito */}
              <div ref={sentinelRef} className="flex justify-center py-8">
                {loadingMore && <Loader />}
                {!hasMore && perritos.length > 0 && (
                  <p className="text-sm text-neutral-400">— Has visto todos los reportes —</p>
                )}
              </div>
            </>
          )}
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        🐾 Patitas SOS · Plataforma de ayuda humanitaria post-terremoto · Hecho con 💛
      </footer>
    </div>
  );
}

/** Esqueleto de carga para las tarjetas del feed. */
function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="aspect-[4/3] animate-pulse bg-neutral-200" />
      <div className="space-y-2 p-4">
        <div className="h-4 w-1/2 animate-pulse rounded bg-neutral-200" />
        <div className="h-3 w-full animate-pulse rounded bg-neutral-200" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-neutral-200" />
        <div className="h-9 w-full animate-pulse rounded-full bg-neutral-200" />
      </div>
    </div>
  );
}

/** Spinner de carga. */
function Loader() {
  return (
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
  );
}
