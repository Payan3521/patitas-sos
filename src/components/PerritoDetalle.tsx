'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { formatPhone, timeAgo, whatsappLink } from '@/lib/format';
import { textosEspecie } from '@/lib/especie';
import type { MatchedPublication, Perrito } from '@/lib/types';

interface Props {
  perrito: Perrito;
  token?: string;
  matches?: MatchedPublication[];
}

/**
 * Página de detalle de un reporte: foto grande, descripción,
 * zona, datos de contacto y botones WhatsApp / llamar.
 *
 * Solo quien publicó el reporte PERDIDO puede marcarlo como ENCONTRADA:
 * verificado por su sesión iniciada o por el token firmado del correo
 * de notificación (que solo le llega al dueño). Cualquier otro visitante
 * no ve esa sección.
 *
 * Si además hay match de la IA, solo las partes logueadas ven la
 * referencia a la publicación de la contraparte.
 */
export function PerritoDetalle({ perrito, token, matches = [] }: Props) {
  const router = useRouter();
  const { session } = useAuth();
  const [verificando, setVerificando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  const esPerdido = perrito.rol_publicacion === 'PERDIDO';
  const esEncontrada = perrito.estado === 'ENCONTRADA';
  const usuario = perrito.usuario ?? { id: '', nombre: '', telefono: '', email: null };
  const telefono = usuario.telefono ?? '';
  const nombre =
    perrito.nombre_temporal ||
    textosEspecie(perrito.especie)[esPerdido ? 'perdido' : 'rescatado'];

  const sesionEmail = (session?.email ?? '').toLowerCase();
  const esParte = !!sesionEmail && sesionEmail === (usuario.email ?? '').toLowerCase();

  const badge = esEncontrada
    ? { text: '✅ ENCONTRADA', className: 'bg-emerald-600 text-white' }
    : esPerdido
      ? { text: '🐾 SE BUSCA', className: 'bg-rose-600 text-white' }
      : { text: '🏠 BUSCA SU DUEÑO', className: 'bg-sky-600 text-white' };

  async function marcarEncontrada(payload: { token?: string }) {
    setVerificando(true);
    setError('');
    try {
      const res = await fetch(`/api/perritos/${perrito.id}/marcar-encontrada`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'No pudimos marcar el reporte como encontrado.');
      }
      setExito(true);
      router.refresh();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado. Intenta de nuevo.');
    } finally {
      setVerificando(false);
    }
  }

  return (
    <div className="space-y-5">
      {exito && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-5xl">🎉</div>
          <h2 className="mt-1 text-xl font-black text-emerald-800">¡Mascota marcada como encontrada!</h2>
          <p className="mt-1 text-sm text-emerald-700">
            Este reporte y el de la persona que la encontró ya aparecen en la lista de «Encontradas».
          </p>
        </div>
      )}

      {/* Referencia al match: solo la ven las partes (logueadas) */}
      {esParte && matches.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">
            🤝 Coincidencia de la IA
          </p>
          <p className="mt-1 text-sm font-medium text-amber-900">
            La IA encontró {matches.length === 1 ? 'esta publicación' : 'estas publicaciones'} con la
            misma mascota:
          </p>
          <div className="mt-3 space-y-2">
            {matches.map((match) => {
              const contra = match.contraparte;
              const nombreContra =
                contra.nombre_temporal ||
                textosEspecie(contra.especie)[contra.rol_publicacion === 'PERDIDO' ? 'perdido' : 'rescatado'];
              return (
                <Link
                  key={contra.id}
                  href={`/perrito/${contra.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-amber-300 bg-white p-3 transition hover:bg-amber-100"
                >
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-neutral-200">
                    <Image
                      src={contra.foto_url}
                      alt={nombreContra}
                      fill
                      sizes="56px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-extrabold text-neutral-900">{nombreContra}</p>
                    <p className="text-xs text-neutral-500">
                      {contra.departamento} · {contra.ciudad}
                    </p>
                    <p className="text-xs font-bold text-amber-700">
                      Similaridad: {match.porcentaje_similitud.toFixed(1)}%
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold text-amber-600">Ver →</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Foto principal */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-neutral-200 bg-neutral-200 shadow-sm">
        <Image
          src={perrito.foto_url}
          alt={`Foto de ${nombre}`}
          fill
          sizes="(min-width: 672px) 640px, 100vw"
          className="object-cover"
          unoptimized
        />
        <span className={`absolute left-4 top-4 rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide shadow ${badge.className}`}>
          {badge.text}
        </span>
        <span className="absolute bottom-4 right-4 rounded-full bg-black/50 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          {timeAgo(perrito.creado_en)}
        </span>
      </div>

      {/* Información */}
      <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-neutral-900">{nombre}</h1>
        <p className="mt-1 text-sm font-medium text-neutral-500">
          📍 {perrito.departamento} · {perrito.ciudad}
          {perrito.barrio_zona ? ` · ${perrito.barrio_zona}` : ''}
        </p>
        <p className="mt-4 whitespace-pre-line text-neutral-700">{perrito.descripcion}</p>
      </div>

      {/* Contacto */}
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">
          Datos de {esPerdido ? 'quien busca a la mascota' : 'quien la rescató'}
        </p>
        <p className="mt-1 text-lg font-extrabold text-neutral-900">{usuario.nombre}</p>
        <p className="text-sm text-neutral-700">📞 {formatPhone(telefono)}</p>
        {usuario.email && <p className="truncate text-sm text-neutral-700">✉️ {usuario.email}</p>}

        <div className="mt-4 space-y-2">
          {telefono && (
            <a
              href={whatsappLink(telefono)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3.5 text-base font-extrabold text-white shadow transition hover:bg-[#1fb958]"
            >
              💬 Escribir por WhatsApp
            </a>
          )}
          {telefono && (
            <a
              href={`tel:${telefono.replace(/\D/g, '')}`}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-800 transition hover:bg-neutral-50"
            >
              📞 Llamar por teléfono
            </a>
          )}
        </div>
      </div>

      {/* Marcar como encontrada — SOLO el dueño: sesión iniciada o token del correo */}
      {!esEncontrada && !exito && esPerdido && (esParte || token) && (
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wide text-neutral-500">
            ¿Es tu mascota? Márcala como encontrada
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Solo quien publicó este reporte puede marcarlo. Si vienes del correo de notificación, tu
            verificación ya está lista.
          </p>

          <button
            type="button"
            disabled={verificando}
            onClick={() => marcarEncontrada(token ? { token } : {})}
            className="mt-4 w-full rounded-full bg-emerald-600 py-3.5 text-base font-black text-white shadow transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {verificando ? 'Verificando…' : '✅ Confirmar: sí, es mi mascota — marcar como encontrada'}
          </button>

          {error && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
              ⚠️ {error}
            </div>
          )}
        </div>
      )}

      {/* Reporte del rescatista (BUSCA_DUEÑO): la confirmación es del dueño */}
      {!esEncontrada && !exito && !esPerdido && (
        <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-black uppercase tracking-wide text-neutral-500">
            ¿Reconoces a esta mascota?
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Solo la persona que publicó su pérdida puede marcarla como encontrada, desde su
            reporte o desde el enlace de su correo. Si tú perdiste a esta mascota, publica un
            reporte de búsqueda con su foto y la IA los conectará.
          </p>
          {!sesionEmail && (
            <Link
              href="/iniciar-sesion"
              className="mt-4 inline-block rounded-full bg-amber-500 px-6 py-2.5 text-sm font-black text-white shadow transition hover:bg-amber-600"
            >
              🔐 Iniciar sesión y publicar la pérdida
            </Link>
          )}
        </div>
      )}

      {esEncontrada && !exito && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          <div className="text-4xl">✅</div>
          <p className="mt-1 font-bold text-emerald-800">
            Esta mascota ya fue marcada como encontrada. ¡Gracias por ayudar! 💚
          </p>
        </div>
      )}
    </div>
  );
}