'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { accessTokenHeader, useAuth } from '@/components/AuthProvider';
import { MENSAJES_AVISO_PREDEFINIDOS } from '@/lib/avisos';

interface Props {
  perritoId: string;
}

/**
 * 👀 "¿Viste esta mascota?" — Aviso al dueño de una publicación.
 *
 * Requiere cuenta (si no, invita a iniciar sesión): así el testigo
 * SIEMPRE puede volver a la conversación desde "Mis avisos".
 * El testigo elige UNO de los mensajes predefinidos (anti-spam: el
 * dueño nunca recibe texto libre). No hay datos de contacto de por
 * medio: todo ocurre en el hilo interno. Quien publica NUNCA ve
 * este bloque en su propia página.
 */
export function AvisoAvisar({ perritoId }: Props) {
  const router = useRouter();
  const { session, loading } = useAuth();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function enviar(mensaje: string) {
    if (enviando) return;
    setEnviando(mensaje);
    setError('');
    try {
      const res = await fetch('/api/avistamientos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...accessTokenHeader(session) },
        body: JSON.stringify({ perrito_id: perritoId, mensaje }),
      });
      const data = (await res.json()) as { ok: boolean; url?: string; error?: string };
      if (!res.ok || !data.ok || !data.url) {
        throw new Error(data.error ?? 'No pudimos enviar tu aviso. Intenta de nuevo.');
      }
      router.push(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
      setEnviando(null);
    }
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div className="h-4 w-40 rounded bg-neutral-100" />
        <div className="mt-3 space-y-2">
          <div className="h-10 rounded-2xl bg-neutral-100" />
          <div className="h-10 rounded-2xl bg-neutral-100" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">
          👀 ¿Viste esta mascota?
        </p>
        <p className="mt-1 text-sm text-neutral-700">
          ¿La viste pasar y no pudiste cogerla? Avísale a quien publicó con un mensaje
          predefinido — <b>sin texto libre ni datos personales</b>. Inicia sesión con tu cuenta
          para poder seguir la conversación si la persona responde.
        </p>
        <Link
          href="/iniciar-sesion"
          className="mt-3 inline-block rounded-full bg-amber-500 px-6 py-2.5 text-sm font-black text-white shadow transition hover:bg-amber-600"
        >
          Iniciar sesión para avisar
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-wide text-neutral-500">
        👀 ¿Viste esta mascota?
      </p>
      <p className="mt-1 text-sm text-neutral-600">
        ¿La viste pasar y no pudiste cogerla? Avisa a quien publicó con un mensaje
        predefinido: <b>sin texto libre, sin datos personales</b>. Si la persona responde, se abre
        un chat privado que encontrarás en <b>Mis avisos</b>.
      </p>

      <div className="mt-3 space-y-2">
        {MENSAJES_AVISO_PREDEFINIDOS.map((mensaje) => (
          <button
            key={mensaje}
            type="button"
            disabled={enviando !== null}
            onClick={() => enviar(mensaje)}
            className="block w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-left text-sm font-medium text-neutral-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-neutral-900 disabled:opacity-60"
          >
            {enviando === mensaje ? 'Enviando…' : mensaje}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-700">
          ⚠️ {error}
        </div>
      )}

      <p className="mt-3 text-[11px] text-neutral-400">
        🔒 Tu mensaje llega privado a la persona que publicó. Un aviso por publicación desde tu
        cuenta.
      </p>
    </div>
  );
}