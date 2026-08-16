'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { accessTokenHeader, useAuth } from '@/components/AuthProvider';
import { Header } from '@/components/Header';
import { chatHabilitadoPara } from '@/lib/chat';
import { formatPhone, timeAgo, whatsappLink } from '@/lib/format';
import { textosEspecie } from '@/lib/especie';
import type { Notificacion, NotificacionesResponse } from '@/lib/types';

/**
 * 🔔 Notificaciones web: la bandeja de avisos de coincidencias de la IA.
 * Funciona como un Gmail interno: cada aviso llega a AMBAS partes (dueño y
 * rescatista) con el mismo contenido que el correo — foto, % de similitud,
 * datos de contacto de la contraparte y, para el dueño, el botón para
 * marcar la mascota como encontrada. No depende de abrir Gmail.
 */
export default function NotificacionesPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  const [notificaciones, setNotificaciones] = useState<Notificacion[] | null>(null);
  const [error, setError] = useState('');
  const [marcadas, setMarcadas] = useState<Record<string, 'ok' | 'error'>>({});

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/iniciar-sesion');
      return;
    }
    fetch('/api/notificaciones', { headers: accessTokenHeader(session) })
      .then(async (res) => {
        const data: NotificacionesResponse = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error ?? 'No pudimos cargar las notificaciones.');
        setNotificaciones(data.notificaciones);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Ocurrió un error.'));
  }, [loading, session, router]);

  const marcarLeida = useCallback(
    async (id: string) => {
      setNotificaciones((prev) => prev?.map((n) => (n.id === id ? { ...n, leida: true } : n)) ?? null);
      await fetch('/api/notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...accessTokenHeader(session) },
        body: JSON.stringify({ id }),
      }).catch(() => {});
    },
    [session],
  );

  const marcarTodas = useCallback(async () => {
    setNotificaciones((prev) => prev?.map((n) => ({ ...n, leida: true })) ?? null);
    await fetch('/api/notificaciones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...accessTokenHeader(session) },
      body: JSON.stringify({}),
    }).catch(() => {});
  }, [session]);

  /** El dueño confirma desde la bandeja: su sesión autoriza (mismo correo). */
  const marcarEncontrada = useCallback(async (notificacion: Notificacion) => {
    setMarcadas((prev) => ({ ...prev, [notificacion.id]: 'ok' }));
    try {
      const res = await fetch(`/api/perritos/${notificacion.mi_perrito_id}/marcar-encontrada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'No pudimos marcar la mascota como encontrada.');
      }
      setMarcadas((prev) => ({ ...prev, [notificacion.id]: 'ok' }));
    } catch (err) {
      setMarcadas((prev) => ({
        ...prev,
        [notificacion.id]: 'error',
      }));
      setError(err instanceof Error ? err.message : 'No pudimos marcar la mascota como encontrada.');
    }
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">🔔 Notificaciones</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Tu bandeja de avisos: cada coincidencia de la IA llega aquí para ambas partes, tal
              como al correo.
            </p>
          </div>
          {notificaciones && notificaciones.length > 0 && (
            <button
              type="button"
              onClick={marcarTodas}
              className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-bold text-neutral-600 transition hover:bg-neutral-50"
            >
              Marcar todas como leídas
            </button>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
            ⚠️ {error}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {notificaciones === null && !error && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-400">
              Cargando notificaciones…
            </div>
          )}

          {notificaciones !== null && notificaciones.length === 0 && (
            <div className="rounded-3xl border border-neutral-200 bg-white p-10 text-center">
              <div className="text-5xl">🔕</div>
              <h2 className="mt-2 text-lg font-black text-neutral-800">No tienes notificaciones</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Cuando la IA encuentre una coincidencia con tus publicaciones, aquí aparecerá el
                aviso con el mismo contenido que te llega por correo.
              </p>
            </div>
          )}

          {notificaciones?.map((notificacion) => {
            const contraparte = notificacion.perrito;
            const esDueño = notificacion.mi_perrito?.rol_publicacion === 'PERDIDO';
            const esContraparteRescatada = contraparte?.rol_publicacion === 'BUSCA_DUEÑO';
            const nombreContraparte =
              contraparte?.nombre_temporal ||
              textosEspecie(contraparte?.especie)[esContraparteRescatada ? 'rescatado' : 'perdida'];
            const contacto = notificacion.contacto ?? null;
            const autorizacion = notificacion.autorizacion ?? { dueno_autorizo: false, encontrador_autorizo: false };
            const miRol = notificacion.mi_perrito?.rol_publicacion;
            const yaAutorice =
              miRol === 'PERDIDO' ? autorizacion.dueno_autorizo : autorizacion.encontrador_autorizo;
            const chatHabilitado =
              !!notificacion.match_id && chatHabilitadoPara(autorizacion, miRol);
            const yaMarcada = marcadas[notificacion.id] === 'ok';
            const falloMarcada = marcadas[notificacion.id] === 'error';

            return (
              <div
                key={notificacion.id}
                className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${
                  notificacion.leida ? 'border-neutral-200' : 'border-amber-300'
                }`}
              >
                {/* --- Cabecera del aviso (click = marcar leída) --- */}
                <button
                  type="button"
                  onClick={() => !notificacion.leida && marcarLeida(notificacion.id)}
                  className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition hover:bg-neutral-50"
                >
                  {!notificacion.leida && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />}
                  <span className="text-lg">{esDueño ? '🥹' : '🐶💛'}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-neutral-900">
                      {esDueño ? '¡Alguien posiblemente encontró a tu mascota!' : '¡Un posible dueño apareció!'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-400">🕐 {timeAgo(notificacion.creado_en)}</p>
                  </div>
                </button>

                {/* --- Contenido: la publicación de la contraparte --- */}
                <div className="p-4">
                  <p className="text-sm text-neutral-600">
                    La IA encontró un{' '}
                    <span className="font-extrabold text-amber-600">
                      {notificacion.porcentaje_similitud?.toFixed(1) ?? '—'}%
                    </span>{' '}
                    de similitud facial con{' '}
                    {esDueño
                      ? `un ${textosEspecie(contraparte?.especie).mascota} que alguien reportó como encontrado`
                      : `un ${textosEspecie(notificacion.mi_perrito?.especie).mascota} perdido que alguien está buscando`}
                    {contacto?.nombre ? <> por <b className="text-neutral-800">{contacto.nombre}</b></> : null}.
                  </p>

                  <Link
                    href={`/perrito/${notificacion.perrito_id}`}
                    onClick={() => !notificacion.leida && marcarLeida(notificacion.id)}
                    className="mt-3 flex items-center gap-4 rounded-2xl border border-neutral-200 p-3 transition hover:bg-neutral-50"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-neutral-200">
                      {contraparte?.foto_url ? (
                        <Image
                          src={contraparte.foto_url}
                          alt={nombreContraparte}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-neutral-900">
                        {esContraparteRescatada ? '🏠 ' : '🐾 '}
                        {nombreContraparte}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{contraparte?.descripcion}</p>
                      {contraparte?.ciudad ? (
                        <p className="mt-0.5 text-[11px] font-semibold text-neutral-400">
                          📍 {contraparte.departamento} · {contraparte.ciudad}
                        </p>
                      ) : null}
                    </div>
                  </Link>

                  {/* --- Datos de contacto — 🔒 SOLO si la contraparte autorizó --- */}
                  {contacto?.nombre || contacto?.telefono || contacto?.email ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-amber-700">
                        {esDueño ? 'Datos de quien la encontró' : 'Datos de la persona que la busca'}
                      </p>
                      <div className="mt-1.5 space-y-0.5 text-sm">
                        {contacto.nombre ? <p className="font-bold text-neutral-800">{contacto.nombre}</p> : null}
                        {contacto.telefono ? (
                          <p className="text-neutral-600">📞 {formatPhone(contacto.telefono)}</p>
                        ) : null}
                        {contacto.email ? (
                          <p className="truncate text-neutral-500">✉️ {contacto.email}</p>
                        ) : null}
                      </div>
                      {contacto.telefono && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <a
                            href={whatsappLink(contacto.telefono)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-emerald-700"
                          >
                            💬 Escribir por WhatsApp
                          </a>
                          <a
                            href={`tel:${contacto.telefono}`}
                            className="rounded-full border border-neutral-300 bg-white px-3.5 py-1.5 text-xs font-bold text-neutral-700 transition hover:bg-neutral-100"
                          >
                            📞 Llamar
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50/80 p-3">
                      <p className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        🔒 Datos de contacto protegidos
                      </p>
                      {yaAutorice ? (
                        <p className="mt-1 text-xs text-neutral-600">
                          Ya compartiste tu contacto con esta persona (le llegó un correo). La otra
                          persona aún no autoriza mostrar los suyos.
                        </p>
                      ) : (
                        <>
                          <p className="mt-1 text-xs text-neutral-600">
                            Por privacidad, los datos solo se muestran cuando cada persona los
                            autoriza. Comparte los tuyos para que la contraparte pueda contactarte.
                          </p>
                          <Link
                            href={`/compartir-contacto?match=${notificacion.match_id ?? ''}&rol=${miRol ?? 'PERDIDO'}`}
                            className="mt-2 inline-block rounded-full bg-amber-500 px-4 py-2 text-xs font-black text-white shadow transition hover:bg-amber-600"
                          >
                            🔓 Compartir mi información de contacto
                          </Link>
                        </>
                      )}
                    </div>
                  )}

                  {/* --- Acciones --- */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/perrito/${notificacion.perrito_id}`}
                      onClick={() => !notificacion.leida && marcarLeida(notificacion.id)}
                      className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-emerald-700"
                    >
                      🐾 Ver la mascota {esDueño ? 'encontrada' : 'perdida'}
                    </Link>

                    {chatHabilitado && (
                      <Link
                        href={`/chat/abrir?match=${notificacion.match_id}`}
                        className="rounded-full bg-neutral-900 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-neutral-700"
                      >
                        💬 Chatear
                      </Link>
                    )}

                    {esDueño && !yaMarcada && notificacion.mi_perrito?.estado !== 'ENCONTRADA' && (
                      <button
                        type="button"
                        onClick={() => marcarEncontrada(notificacion)}
                        className="rounded-full bg-amber-500 px-4 py-2 text-sm font-black text-white shadow transition hover:bg-amber-600"
                      >
                        ✅ Sí, ¡es mi mascota! Marcarla como encontrada
                      </button>
                    )}
                    {esDueño && (yaMarcada || notificacion.mi_perrito?.estado === 'ENCONTRADA') && (
                      <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700">
                        ✅ ¡Reencuentro confirmado! Ya aparece en Encontradas
                      </span>
                    )}
                    {esDueño && falloMarcada && (
                      <span className="text-xs font-semibold text-rose-600">No pudimos marcarla. Intenta de nuevo.</span>
                    )}
                  </div>
                </div>
              </div>
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