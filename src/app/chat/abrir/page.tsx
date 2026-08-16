'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { accessTokenHeader, useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';

/**
 * 💬 Puente para abrir (crear) la conversación de un match:
 * llama a POST /api/mensajes/abrir y redirige al hilo recién creado.
 * Si la contraparte aún no autorizó su contacto, muestra la explicación
 * con la salida hacia "Compartir mi contacto".
 */
function AbrirConversacion() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const matchId = searchParams.get('match') ?? '';
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/iniciar-sesion');
      return;
    }
    if (!matchId) {
      setError('Falta la coincidencia a abrir.');
      return;
    }
    let cancel = false;
    fetch('/api/mensajes/abrir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...accessTokenHeader(session) },
      body: JSON.stringify({ matchId }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { ok: boolean; conversacion_id?: string; error?: string };
        if (!res.ok || !data.ok) throw new Error(data.error ?? 'No pudimos abrir la conversación.');
        if (!cancel) router.replace(`/chat/${data.conversacion_id}`);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ocurrió un error.'));
    return () => {
      cancel = true;
    };
  }, [loading, session, router, matchId]);

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-24 pt-10">
      {error ? (
        <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-2 text-xl font-black text-neutral-900">El chat aún no está disponible</h1>
          <p className="mt-1 text-sm text-neutral-600">{error}</p>
          <p className="mt-2 text-xs text-neutral-500">
            El chat se habilita cuando la otra persona autoriza compartir su contacto. Mientras, puedes
            compartir el tuyo para desbloquear el intercambio.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href={`/compartir-contacto?match=${matchId}&rol=PERDIDO`}
              className="rounded-full bg-amber-500 px-6 py-2.5 text-sm font-black text-white transition hover:bg-amber-600"
            >
              🔓 Compartir mi contacto
            </Link>
            <Link
              href="/chat"
              className="rounded-full border border-neutral-300 px-6 py-2.5 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50"
            >
              Volver al chat
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center">
          <div className="animate-pulse text-5xl">💬</div>
          <p className="mt-2 text-sm font-semibold text-neutral-600">Abriendo la conversación…</p>
        </div>
      )}
    </main>
  );
}

export default function AbrirChatPage() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <Header />
      <Suspense fallback={null}>
        <AbrirConversacion />
      </Suspense>
    </div>
  );
}