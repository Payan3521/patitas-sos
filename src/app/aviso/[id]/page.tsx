'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { accessTokenHeader, useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { MAX_MENSAJE_AVISO_LEN, MENSAJES_DUENO_PREDEFINIDOS } from '@/lib/avisos';
import { timeAgo } from '@/lib/format';
import { textosEspecie } from '@/lib/especie';
import type { AutorAviso, AvisoMensaje } from '@/lib/types';

/**
 * 💬 Hilo de un aviso "👀 Vi esta mascota".
 *
 * Acceso SOLO con sesión (las valida el servidor):
 *  - El testigo que creó el aviso (entra desde "Mis avisos").
 *  - El dueño de la publicación.
 *
 * 🔒 No hay enlaces privados con token ni datos de contacto: todo
 * ocurre en este hilo, y cada quien ve sus "no leídas".
 *
 * Reglas del hilo:
 *  - La primera respuesta del DUEÑO debe ser un mensaje predefinido
 *    (chips); después ambos escriben libre.
 *  - El botón 🔕 (desactivar avisos) SOLO lo ve el dueño; el testigo
 *    nunca puede pausarlos.
 */
interface Hilo {
  autor: AutorAviso;
  avisos_habilitados: boolean;
  perrito: {
    id: string;
    nombre_temporal: string | null;
    foto_url: string;
    rol_publicacion: 'PERDIDO' | 'BUSCA_DUEÑO';
    especie: 'perro' | 'gato';
    estado: string;
    departamento: string;
    ciudad: string;
  };
  mensajes: AvisoMensaje[];
}

export default function AvisoPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { session, loading } = useAuth();

  const [hilo, setHilo] = useState<Hilo | null>(null);
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [contenido, setContenido] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const finalRef = useRef<HTMLDivElement | null>(null);

  const cargar = useCallback(() => {
    setError('');
    setEstado('cargando');
    fetch(`/api/avistamientos/${params.id}`, { headers: accessTokenHeader(session) })
      .then(async (res) => {
        const data = (await res.json()) as { ok: boolean; error?: string } & Hilo;
        if (!res.ok || !data.ok) throw new Error(data.error ?? 'No tienes acceso a este hilo.');
        setHilo(data);
        setEstado('listo');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'No tienes acceso a este hilo.');
        setEstado('error');
      });
  }, [params.id, session]);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/iniciar-sesion');
      return;
    }
    cargar();
  }, [loading, session, cargar, router]);

  useEffect(() => {
    finalRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [hilo?.mensajes.length]);

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || enviando || !hilo) return;
    setEnviando(true);
    setError('');
    try {
      const res = await fetch(`/api/avistamientos/${params.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...accessTokenHeader(session) },
        body: JSON.stringify({ contenido: limpio }),
      });
      const data = (await res.json()) as { ok: boolean; mensaje?: AvisoMensaje; error?: string };
      if (!res.ok || !data.ok || !data.mensaje) {
        throw new Error(data.error ?? 'No pudimos enviar el mensaje.');
      }
      setHilo((h) => (h ? { ...h, mensajes: [...h.mensajes, data.mensaje!] } : h));
      setContenido('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setEnviando(false);
    }
  }

  /** Activa/desactiva los avisos de la publicación (SOLO el dueño la ve). */
  async function alternarAvisos() {
    if (!hilo) return;
    const habilitados = !hilo.avisos_habilitados;
    setHilo({ ...hilo, avisos_habilitados: habilitados });
    try {
      const res = await fetch(`/api/perritos/${hilo.perrito.id}/avisos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...accessTokenHeader(session) },
        body: JSON.stringify({ habilitados }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'No pudimos actualizar los avisos.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pudimos actualizar los avisos.');
      setHilo((h) => (h ? { ...h, avisos_habilitados: !habilitados } : h));
    }
  }

  const soyAvisador = hilo?.autor === 'avisador';
  // El dueño aún no respondió → debe elegir UNO de los mensajes predefinidos.
  const duenoSinResponder = !!hilo && !soyAvisador && !hilo.mensajes.some((m) => m.autor === 'dueño');
  const nombre = hilo
    ? hilo.perrito.nombre_temporal ||
      textosEspecie(hilo.perrito.especie)[
        hilo.perrito.rol_publicacion === 'PERDIDO' ? 'perdido' : 'rescatado'
      ]
    : 'la mascota';

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        {estado === 'cargando' && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-10 text-center text-sm text-neutral-400">
            Cargando el hilo…
          </div>
        )}

        {estado === 'error' && (
          <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center">
            <div className="text-5xl">🔒</div>
            <h1 className="mt-2 text-xl font-black text-neutral-900">Sin acceso a este hilo</h1>
            <p className="mt-1 text-sm text-neutral-500">{error}</p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-amber-500 px-8 py-3 text-base font-black text-white shadow transition hover:bg-amber-600"
            >
              Volver al inicio
            </Link>
          </div>
        )}

        {hilo && (
          <>
            {/* Cabecera del reporte (solo datos públicos) */}
            <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
              <div className="flex items-center gap-4 p-4">
                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-neutral-200">
                  <Image
                    src={hilo.perrito.foto_url}
                    alt={nombre}
                    fill
                    sizes="64px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                    💬 Aviso "Vi esta mascota"
                  </p>
                  <p className="truncate text-lg font-extrabold text-neutral-900">{nombre}</p>
                  <p className="text-xs text-neutral-500">
                    📍 {hilo.perrito.departamento} · {hilo.perrito.ciudad}
                  </p>
                </div>
                {!soyAvisador && (
                  <button
                    type="button"
                    onClick={() => void alternarAvisos()}
                    title={hilo.avisos_habilitados ? 'Dejar de recibir avisos de testigos' : 'Recibir avisos de testigos de nuevo'}
                    className="ml-auto shrink-0 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50"
                  >
                    {hilo.avisos_habilitados ? '🔕 Pausar avisos' : '🔔 Activar avisos'}
                  </button>
                )}
              </div>

              {soyAvisador && !hilo.avisos_habilitados && (
                <div className="border-t border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  🔕 Quien publicó este reporte desactivó los mensajes: ya no puedes escribir. Puedes
                  seguir viendo la conversación.
                </div>
              )}
              {!soyAvisador && (
                <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                  👀 Eres quien publicó este reporte. La otra persona vio a la mascota y te avisó con
                  un mensaje predefinido: respóndele (primero con un mensaje predefinido, luego con
                  texto libre). El botón 🔕 de arriba solo lo ves tú.
                </div>
              )}
            </div>

            {/* Hilo */}
            <div className="mt-4 space-y-2.5">
              {hilo.mensajes.map((mensaje) => {
                const esDeAvisador = mensaje.autor === 'avisador';
                const mioPropio = soyAvisador ? esDeAvisador : !esDeAvisador;
                return (
                  <div
                    key={mensaje.id}
                    className={`max-w-[85%] rounded-3xl border px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      mioPropio
                        ? 'ml-auto rounded-br-lg border-amber-200 bg-amber-100 text-neutral-900'
                        : 'mr-auto rounded-bl-lg border-neutral-200 bg-white text-neutral-800'
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                      {mioPropio
                        ? 'Tú'
                        : soyAvisador
                          ? 'La persona que publica'
                          : 'La persona que vio a la mascota'}
                    </p>
                    <p className="mt-0.5 whitespace-pre-line">{mensaje.contenido}</p>
                    <p className="mt-1 text-right text-[10px] text-neutral-400">
                      {timeAgo(mensaje.creado_en)}
                    </p>
                  </div>
                );
              })}
              {hilo.mensajes.length === 1 && (
                <p className="py-4 text-center text-xs text-neutral-400">
                  Aún no hay respuesta. Si {soyAvisador ? 'la persona que publica' : 'la otra persona'} ve este
                  hilo, la conversación continúa aquí.
                </p>
              )}
              <div ref={finalRef} />
            </div>

            {/* Redactor */}
            {hilo.avisos_habilitados || !soyAvisador ? (
              <div className="sticky bottom-4 mt-4 rounded-3xl border border-neutral-200 bg-white p-3 shadow-lg">
                {error && (
                  <div className="mb-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-700">
                    ⚠️ {error}
                  </div>
                )}

                {duenoSinResponder && (
                  <div className="mb-2">
                    <p className="mb-1.5 px-1 text-[11px] font-black uppercase tracking-wide text-neutral-400">
                      👋 Tu primera respuesta (toca uno):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {MENSAJES_DUENO_PREDEFINIDOS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          disabled={enviando}
                          onClick={() => void enviar(preset)}
                          className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-left text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-60"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <textarea
                    value={contenido}
                    onChange={(e) => setContenido(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void enviar(contenido);
                      }
                    }}
                    rows={2}
                    maxLength={MAX_MENSAJE_AVISO_LEN}
                    placeholder={
                      duenoSinResponder
                        ? 'Elige un mensaje de arriba (tu primera respuesta es predefinida)…'
                        : soyAvisador
                          ? 'Escribe a quien publicó…'
                          : 'Responde a quien la vio…'
                    }
                    className="min-w-0 flex-1 resize-none rounded-2xl border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-amber-400 focus:bg-white"
                  />
                  <button
                    type="button"
                    disabled={enviando || !contenido.trim()}
                    onClick={() => void enviar(contenido)}
                    className="shrink-0 rounded-full bg-amber-500 px-5 py-3 text-sm font-black text-white shadow transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {enviando ? '…' : 'Enviar ➤'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="sticky bottom-4 mt-4 rounded-3xl border border-neutral-200 bg-neutral-50 p-4 text-center text-sm text-neutral-500">
                🔕 Los mensajes están desactivados para este reporte.
              </div>
            )}
          </>
        )}
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