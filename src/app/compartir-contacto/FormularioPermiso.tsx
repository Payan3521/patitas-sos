'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

interface DatosPermiso {
  matchId: string;
  rol: 'PERDIDO' | 'BUSCA_DUEÑO';
  token?: string;
  yaAutorizado: boolean;
  chatHabilitado: boolean;
  contraparte: {
    id: string;
    nombre: string;
    foto: string;
    ciudad: string;
    departamento: string;
    descripcion: string;
    porcentaje: number;
  };
  misDatos: { nombre: string; telefono: string; email: string };
  sinSesion: boolean;
}

/** 🔓 Formulario de consentimiento: checkbox obligatorio + botón de autorizar. */
export function FormularioPermiso({ data }: { data: DatosPermiso }) {
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState<{ mensaje: string; notificacion?: string } | null>(null);

  async function autorizar() {
    if (!acepto || enviando) return;
    setEnviando(true);
    setError('');
    try {
      const res = await fetch('/api/consentimientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId: data.matchId,
          rol: data.rol,
          token: data.token,
          aceptado: true,
        }),
      });
      const body = (await res.json()) as {
        ok: boolean;
        mensaje?: string;
        notificacion?: { ok: boolean; detalle: string };
        error?: string;
      };
      if (!res.ok || !body.ok) {
        throw new Error(body.error ?? 'No pudimos registrar tu autorización. Intenta de nuevo.');
      }
      setResultado({ mensaje: body.mensaje ?? '¡Listo!', notificacion: body.notificacion?.detalle });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
    } finally {
      setEnviando(false);
    }
  }

  if (data.yaAutorizado && !resultado) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="mt-2 text-xl font-black text-emerald-800">Ya compartiste tus datos de contacto</h1>
        <p className="mt-1 text-sm text-emerald-700">
          Esta autorización ya estaba registrada para esta coincidencia: la contraparte recibió (o
          ya recibió) un correo con tus datos.
        </p>
        <Link
          href="/notificaciones"
          className="mt-5 inline-block rounded-full bg-emerald-600 px-8 py-3 text-base font-black text-white shadow transition hover:bg-emerald-700"
        >
          🔔 Ir a mis notificaciones
        </Link>
      </div>
    );
  }

  if (resultado) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <div className="text-5xl">🔓</div>
        <h1 className="mt-2 text-xl font-black text-emerald-800">¡Gracias por autorizar!</h1>
        <p className="mx-auto mt-1 max-w-sm text-sm text-emerald-700">{resultado.mensaje}</p>
        {resultado.notificacion && (
          <p className="mt-2 rounded-xl bg-white/70 px-4 py-2 text-xs text-emerald-800">
            📧 {resultado.notificacion}
          </p>
        )}
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link
            href="/notificaciones"
            className="rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-black text-white transition hover:bg-emerald-700"
          >
            🔔 Ir a mis notificaciones
          </Link>
          <Link
            href={`/perrito/${data.contraparte.id}`}
            className="rounded-full border border-emerald-600 px-6 py-2.5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-100"
          >
            🐾 Ver la publicación de la contraparte
          </Link>
          {data.chatHabilitado && (
            <Link
              href={`/chat/abrir?match=${data.matchId}`}
              className="rounded-full bg-neutral-900 px-6 py-2.5 text-sm font-black text-white transition hover:bg-neutral-700"
            >
              💬 Chatear con la contraparte
            </Link>
          )}
        </div>
        {!data.chatHabilitado && (
          <p className="mt-3 text-xs text-emerald-700">
            Cuando la contraparte autorice su contacto, podrás chatear con ella desde{' '}
            <Link href="/mis-publicaciones" className="font-bold underline">
              Mis publicaciones
            </Link>
            .
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="bg-gradient-to-br from-amber-500 to-orange-600 px-6 py-6 text-center text-white">
        <div className="text-5xl">🔓</div>
        <h1 className="mt-2 text-2xl font-black uppercase tracking-tight">
          Compartir información de contacto
        </h1>
        <p className="mt-1 text-sm font-medium text-amber-100">
          Tú decides con quién compartir tus datos. Nada se muestra sin tu autorización.
        </p>
      </div>

      <div className="space-y-5 p-5">
        {/* Resumen de la coincidencia */}
        <div className="flex gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-neutral-200">
            <Image
              src={data.contraparte.foto}
              alt={data.contraparte.nombre}
              fill
              sizes="80px"
              className="object-cover"
              unoptimized
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-neutral-900">{data.contraparte.nombre}</p>
            <p className="text-xs text-neutral-500">
              📍 {data.contraparte.departamento} · {data.contraparte.ciudad}
            </p>
            <p className="text-xs font-bold text-amber-700">
              Coincidencia de la IA: {data.contraparte.porcentaje.toFixed(1)}%
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-neutral-600">{data.contraparte.descripcion}</p>
          </div>
        </div>

        {/* Qué se comparte */}
        <div className="rounded-2xl border border-neutral-200 bg-white p-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-neutral-500">
            Compartirás con esta persona
          </p>
          <ul className="mt-2 space-y-1 text-sm text-neutral-700">
            <li>👤 Tu nombre: <b>{data.misDatos.nombre}</b></li>
            <li>📞 Tu teléfono: <b>{data.misDatos.telefono}</b></li>
            <li>✉️ Tu correo: <b>{data.misDatos.email}</b></li>
            <li>📍 Tu barrio/dirección del reporte</li>
          </ul>
          <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
            La contraparte recibirá un <b>correo con estos datos</b> al confirmar. Tu reporte y tus
            demás datos siguen protegidos.
          </p>
        </div>

        {/* Consentimiento */}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <input
            type="checkbox"
            checked={acepto}
            onChange={(e) => setAcepto(e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-amber-500"
          />
          <span className="text-xs leading-relaxed text-neutral-600">
            <b>Acepto la{' '}
              <Link href="/politica-de-privacidad" className="font-bold text-amber-600 underline">
                Política de Privacidad
              </Link>{' '}
              de Patitas SOS</b> y autorizo compartir mi nombre, teléfono, correo electrónico y barrio
            <b> únicamente</b> con la persona de esta coincidencia, para coordinar el reencuentro de la mascota.
          </span>
        </label>

        {data.sinSesion && (
          <p className="rounded-xl bg-neutral-100 px-4 py-2.5 text-xs text-neutral-500">
            ℹ️ Viniste desde el correo: tu autorización queda registrada sin necesidad de iniciar
            sesión. Si quieres gestionar tus reportes en la plataforma, puedes{' '}
            <Link href="/registrarse" className="font-bold text-amber-600 underline">
              crear tu cuenta con el mismo correo
            </Link>
            .
          </p>
        )}

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
            ⚠️ {error}
          </div>
        )}

        <button
          type="button"
          disabled={!acepto || enviando}
          onClick={autorizar}
          className="w-full rounded-full bg-amber-500 py-4 text-base font-black text-white shadow-lg transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? 'Registrando tu autorización…' : '🔓 Confirmar y compartir mis datos'}
        </button>

        <p className="text-center text-xs text-neutral-400">
          Puedes revocar esta autorización contactándonos (ver Política de Privacidad).
        </p>
      </div>
    </div>
  );
}