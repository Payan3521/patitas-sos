'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { accessTokenHeader, useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { canalDeChat } from '@/lib/chat';
import { timeAgo } from '@/lib/format';
import { createBrowserSupabase } from '@/lib/supabase-client';
import type { HiloResponse, Mensaje } from '@/lib/types';

/**
 * 💬 Hilo de una conversación: burbujas de chat en tiempo real.
 * La entrega usa Supabase Realtime SOLO como "ping" (broadcast por canal
 * chat-<matchId>): los mensajes siempre se cargan por la API con sesión.
 */
export default function HiloChatPage() {
  const params = useParams<{ id: string }>();
  const conversacionId = params.id;
  const { session, loading } = useAuth();
  const router = useRouter();

  const [hilo, setHilo] = useState<HiloResponse | null>(null);
  const [error, setError] = useState('');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);
  const enviadosRef = useRef<Record<string, boolean>>({});

  const cargar = useCallback(
    async (marcaLeidas = true) => {
      if (!session) return;
      const res = await fetch(`/api/mensajes/${conversacionId}`, { headers: accessTokenHeader(session) });
      const data = (await res.json()) as HiloResponse;
      if (res.ok && data.ok) {
        setHilo((prev) => {
          if (!prev || JSON.stringify(prev.mensajes) !== JSON.stringify(data.mensajes)) {
            return data;
          }
          return prev;
        });
        if (marcaLeidas && data.mensajes.some((m) => !m.es_mio && !m.leida)) {
          fetch(`/api/mensajes/${conversacionId}`, {
            method: 'POST',
            headers: accessTokenHeader(session),
          }).catch(() => {});
        }
        setError('');
      } else if (!res.ok) {
        setError(data.error ?? 'No pudimos cargar la conversación.');
      }
    },
    [conversacionId, session],
  );

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/iniciar-sesion');
      return;
    }
    cargar();
  }, [loading, session, router, cargar]);

  // Realtime: "ping" de mensaje nuevo → recargar el hilo (los datos no viajan por el canal).
  useEffect(() => {
    if (!hilo?.conversacion.match_id) return;
    const supabase = createBrowserSupabase();
    if (!supabase) return;

    const canal = supabase.channel(canalDeChat(hilo.conversacion.match_id));
    canal.on('broadcast', { event: 'nuevo' }, () => void cargar());
    canal.subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [hilo?.conversacion.match_id, cargar]);

  // Autoscroll al último mensaje.
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [hilo?.mensajes.length, hilo?.mensajes[hilo?.mensajes.length - 1]?.id]);

  async function enviar() {
    const contenido = texto.trim();
    if (!contenido || enviando || !session) return;
    setEnviando(true);

    const temporal: Mensaje = {
      id: `tmp-${Date.now()}`,
      conversacion_id: conversacionId,
      usuario_id: 'tmp',
      contenido,
      leida: true,
      creado_en: new Date().toISOString(),
      es_mio: true,
    };
    setHilo((prev) => (prev ? { ...prev, mensajes: [...prev.mensajes, temporal] } : prev));
    setTexto('');

    try {
      const res = await fetch('/api/mensajes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...accessTokenHeader(session) },
        body: JSON.stringify({ conversacionId, contenido }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'No se pudo enviar el mensaje.');
      enviadosRef.current[temporal.id] = true;
      void cargar(false);
    } catch (err) {
      setHilo((prev) =>
        prev ? { ...prev, mensajes: prev.mensajes.filter((m) => m.id !== temporal.id) } : prev,
      );
      setTexto(contenido);
      setError(err instanceof Error ? err.message : 'Ocurrió un error al enviar.');
      setTimeout(() => setError(''), 3000);
    } finally {
      setEnviando(false);
    }
  }

  const contraparte = hilo?.conversacion.contraparte;
  const esRescatada = contraparte?.rol_publicacion === 'BUSCA_DUEÑO';

  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <Header />
      {hilo && contraparte ? (
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
          {/* Cabecera del hilo */}
          <div className="sticky top-20 z-30 flex items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 py-3 backdrop-blur">
            <Link
              href="/chat"
              className="rounded-full border border-neutral-300 bg-white p-2 text-sm text-neutral-600 transition hover:bg-neutral-50"
            >
              ←
            </Link>
            <Link href={`/perrito/${contraparte.perrito_id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-neutral-200">
                <Image
                  src={contraparte.foto_url}
                  alt={contraparte.nombre}
                  fill
                  sizes="44px"
                  className="object-cover"
                  unoptimized
                />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-neutral-900">
                  {esRescatada ? '🏠 ' : '🐾 '}
                  {contraparte.nombre}
                </p>
                <p className="text-[10px] font-bold text-amber-700">
                  Coincidencia {contraparte.porcentaje_similitud.toFixed(1)}% · {esRescatada ? 'rescatado' : 'encontrado'}
                </p>
              </div>
            </Link>
          </div>

          {/* Mensajes */}
          <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
            {hilo.mensajes.length === 0 && (
              <div className="mx-auto mt-10 max-w-xs rounded-3xl bg-white p-6 text-center text-sm text-neutral-500 shadow-sm">
                👋 ¡Hola! Esta conversación está lista para coordinar el reencuentro. Preséntate y
                cuéntale a la contraparte cómo seguir.
              </div>
            )}
            {hilo.mensajes.map((mensaje) => (
              <div key={mensaje.id} className={`flex ${mensaje.es_mio ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-3xl px-4 py-2.5 text-sm shadow-sm ${
                    mensaje.es_mio
                      ? 'rounded-br-md bg-amber-500 text-white'
                      : 'rounded-bl-md bg-white text-neutral-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{mensaje.contenido}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      mensaje.es_mio ? 'text-amber-100' : 'text-neutral-400'
                    }`}
                  >
                    {timeAgo(mensaje.creado_en)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={finRef} />
          </div>

          {/* Input */}
          <div className="sticky bottom-0 border-t border-neutral-200 bg-white px-4 py-3">
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void enviar();
              }}
            >
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={`Escribe algo para ${esRescatada ? 'el rescatista' : 'la familia'}…`}
                maxLength={2000}
                className="min-w-0 flex-1 rounded-full border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-amber-400 focus:bg-white"
              />
              <button
                type="submit"
                disabled={!texto.trim() || enviando}
                className="rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-white shadow transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {enviando ? '…' : '➤'}
              </button>
            </form>
            {error && <p className="mt-2 text-center text-xs font-medium text-rose-600">⚠️ {error}</p>}
          </div>
        </div>
      ) : (
        <main className="mx-auto w-full max-w-md flex-1 px-4 py-10">
          {error ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center">
              <div className="text-5xl">🔒</div>
              <h1 className="mt-2 text-lg font-black text-neutral-900">No puedes ver esta conversación</h1>
              <p className="mt-1 text-sm text-neutral-600">{error}</p>
              <Link
                href="/chat"
                className="mt-5 inline-block rounded-full bg-amber-500 px-6 py-2.5 text-sm font-black text-white transition hover:bg-amber-600"
              >
                Volver al chat
              </Link>
            </div>
          ) : (
            <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center">
              <div className="animate-pulse text-5xl">💬</div>
              <p className="mt-2 text-sm font-semibold text-neutral-600">Cargando la conversación…</p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}