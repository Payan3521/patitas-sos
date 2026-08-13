'use client';

import Image from 'next/image';
import { useEffect } from 'react';
import { whatsappLink } from '@/lib/format';
import type { MatchInfo } from '@/lib/types';

interface Props {
  matchInfo: MatchInfo;
  onClose: () => void;
}

/**
 * 🎉 Modal gigante de éxito cuando la IA encuentra una coincidencia.
 * Congela la pantalla (bloquea el scroll del fondo) y muestra la foto
 * del otro reporte junto con los datos de contacto de la contraparte.
 */
export function MatchModal({ matchInfo, onClose }: Props) {
  // 🧊 Congelar la pantalla mientras el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const { perrito, usuario, porcentaje_similitud } = matchInfo;
  const telefono = usuario.telefono ?? '';
  const esRescatista = perrito.rol_publicacion === 'BUSCA_DUEÑO';
  const nombre = perrito.nombre_temporal || (esRescatista ? 'Perrito rescatado' : 'Perrito perdido');

  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="animate-pop-in relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Encabezado de éxito */}
        <div className="bg-gradient-to-br from-emerald-500 to-green-600 px-6 pb-6 pt-8 text-center text-white">
          <div className="text-6xl">🎉</div>
          <h2 className="mt-2 text-2xl font-black uppercase leading-tight tracking-tight">
            ¡La IA encontró una coincidencia!
          </h2>
          <p className="mt-1 text-sm font-medium text-emerald-100">
            Similaridad facial:{' '}
            <span className="font-extrabold text-white">{porcentaje_similitud.toFixed(1)}%</span>
          </p>
        </div>

        <div className="p-5">
          {/* Foto del otro reporte */}
          <div className="flex gap-3">
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
              <p className="font-bold text-neutral-900">{nombre}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                📍 {perrito.departamento}, {perrito.ciudad}
                {perrito.barrio_zona ? `, ${perrito.barrio_zona}` : ''}
              </p>
              <p className="mt-1 line-clamp-3 text-xs text-neutral-600">{perrito.descripcion}</p>
            </div>
          </div>

          {/* Datos de contacto de la contraparte */}
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">
              Datos de {esRescatista ? 'la persona que lo rescató' : 'la persona que lo busca'}
            </p>
            <p className="mt-1 text-base font-extrabold text-neutral-900">{usuario.nombre}</p>
            <p className="text-sm text-neutral-700">📞 {telefono}</p>
            {usuario.email && <p className="truncate text-sm text-neutral-700">✉️ {usuario.email}</p>}
          </div>

          {/* Acciones */}
          <div className="mt-5 space-y-2.5">
            <a
              href={whatsappLink(telefono)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3.5 text-base font-extrabold text-white shadow transition hover:bg-[#1fb958]"
            >
              💬 Escribir por WhatsApp
            </a>
            <a
              href={`tel:${telefono}`}
              className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-800 transition hover:bg-neutral-50"
            >
              📞 Llamar ahora
            </a>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full py-2 text-sm font-semibold text-neutral-500 underline-offset-2 hover:underline"
            >
              Cerrar y ver mi reporte
            </button>
          </div>

          <p className="mt-4 rounded-xl bg-neutral-100 px-4 py-3 text-xs leading-relaxed text-neutral-600">
            💌 Tu reporte <b>sigue publicado</b>. También enviamos un correo a{' '}
            {esRescatista ? 'la persona que busca a la mascota' : 'quien la encontró'} con tus datos
            y esta coincidencia. Si confirma que es la misma mascota, ambos reportes pasarán a la
            lista de <b>Encontradas</b>.
          </p>
        </div>
      </div>
    </div>
  );
}
