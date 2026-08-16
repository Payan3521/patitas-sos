'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { accessTokenHeader, useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { timeAgo } from '@/lib/format';
import type { ConversacionUI, MensajesListResponse } from '@/lib/types';

/**
 * 💬 Bandeja de conversaciones del chat privado entre las partes de un match.
 * Se habilita cuando la contraparte autorizó compartir su contacto; aquí solo
 * se muestran datos públicos de la contraparte (foto y nombre), nunca contacto.
 */
export default function ChatListPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [conversaciones, setConversaciones] = useState<ConversacionUI[] | null>(null);
  const [noLeidas, setNoLeidas] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/iniciar-sesion');
      return;
    }
    fetch('/api/mensajes', { headers: accessTokenHeader(session) })
      .then(async (res) => {
        const data: MensajesListResponse = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? 'No pudimos cargar las conversaciones.');
        setConversaciones(data.conversaciones);
        setNoLeidas(data.noLeidasTotal);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ocurrió un error.'));
  }, [loading, session, router]);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50">
      <Header />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-24 pt-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black tracking-tight text-neutral-900">💬 Chat</h1>
          {noLeidas > 0 && (
            <span className="rounded-full bg-rose-500 px-3 py-1 text-xs font-black text-white">
              {noLeidas} sin leer
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-neutral-500">
          Conversaciones con las personas que ya compartieron su contacto contigo. Privado, seguro y
          sin exponer números en el feed.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-6 space-y-3">
          {conversaciones === null && !error && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
              Cargando conversaciones…
            </div>
          )}

          {conversaciones !== null && conversaciones.length === 0 && (
            <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center">
              <div className="text-5xl">💬</div>
              <h2 className="mt-2 text-lg font-black text-neutral-800">Aún no tienes conversaciones</h2>
              <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
                Cuando la IA encuentre una coincidencia y la otra persona autorice compartir su
                contacto, podrás chatear con ella desde{' '}
                <Link href="/mis-publicaciones" className="font-bold text-amber-600 underline">
                  Mis publicaciones
                </Link>{' '}
                o desde las notificaciones.
              </p>
            </div>
          )}

          {conversaciones?.map((conversacion) => {
            const contraparte = conversacion.contraparte;
            const esRescatada = contraparte.rol_publicacion === 'BUSCA_DUEÑO';
            return (
              <Link
                key={conversacion.conversacion_id}
                href={`/chat/${conversacion.conversacion_id}`}
                className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-3 shadow-sm transition hover:border-amber-300 hover:bg-amber-50/50"
              >
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-neutral-200">
                  <Image
                    src={contraparte.foto_url}
                    alt={contraparte.nombre}
                    fill
                    sizes="56px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-extrabold text-neutral-900">
                      {esRescatada ? '🏠 ' : '🐾 '}
                      {contraparte.nombre}
                    </p>
                    <span className="shrink-0 text-[10px] font-semibold text-neutral-400">
                      {conversacion.ultimo_mensaje ? timeAgo(conversacion.ultimo_mensaje.creado_en) : 'recién abierta'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <p className="truncate text-xs text-neutral-500">
                      {conversacion.ultimo_mensaje ? (
                        <>
                          {conversacion.ultimo_mensaje.es_mio && <b className="text-neutral-600">Tú: </b>}
                          {conversacion.ultimo_mensaje.contenido}
                        </>
                      ) : (
                        <span className="font-semibold text-amber-600">
                          Di hola para coordinar el reencuentro 👋
                        </span>
                      )}
                    </p>
                    {conversacion.noLeidas > 0 && (
                      <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-white">
                        {conversacion.noLeidas > 9 ? '9+' : conversacion.noLeidas}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[10px] font-bold text-amber-700">
                    Coincidencia de la IA: {contraparte.porcentaje_similitud.toFixed(1)}%
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