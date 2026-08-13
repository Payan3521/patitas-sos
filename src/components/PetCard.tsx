import Image from 'next/image';
import { timeAgo, whatsappLink } from '@/lib/format';
import type { Perrito } from '@/lib/types';

interface Props {
  perrito: Perrito;
}

const ROL_BADGE: Record<Perrito['rol_publicacion'], { text: string; className: string }> = {
  PERDIDO: { text: '🐾 PERDIDO', className: 'bg-rose-600 text-white' },
  'BUSCA_DUEÑO': { text: '🏠 BUSCA DUEÑO', className: 'bg-emerald-600 text-white' },
};

/** Tarjeta del feed: foto grande, descripción, zona y botón de WhatsApp. */
export function PetCard({ perrito }: Props) {
  const badge = ROL_BADGE[perrito.rol_publicacion];
  const telefono = perrito.usuario?.telefono ?? '';
  const nombre =
    perrito.nombre_temporal ||
    (perrito.rol_publicacion === 'PERDIDO' ? 'Mi perrito' : 'Perrito rescatado');

  return (
    <article className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="relative aspect-[4/3] bg-neutral-200">
        <Image
          src={perrito.foto_url}
          alt={`Foto de ${nombre}`}
          fill
          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-300 group-hover:scale-105"
          unoptimized
        />
        <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-xs font-bold tracking-wide ${badge.className}`}>
          {badge.text}
        </span>
        <span className="absolute bottom-3 right-3 rounded-full bg-black/50 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          {timeAgo(perrito.creado_en)}
        </span>
      </div>

      <div className="p-4">
        <h3 className="text-lg font-bold text-neutral-900">{nombre}</h3>
        <p className="mt-1 line-clamp-3 text-sm text-neutral-600">{perrito.descripcion}</p>
        <p className="mt-2 flex items-center gap-1 text-sm font-medium text-neutral-500">
          📍 {perrito.ciudad}
          {perrito.barrio_zona ? `, ${perrito.barrio_zona}` : ''}
        </p>

        {telefono && (
          <a
            href={whatsappLink(telefono)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1fb958]"
          >
            💬 Contactar por WhatsApp
          </a>
        )}
      </div>
    </article>
  );
}
