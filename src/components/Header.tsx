import Link from 'next/link';

/** Encabezado sticky con la marca y el CTA de publicación. */
export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-tight text-neutral-900">
          <span className="text-2xl">🐾</span>
          Patitas <span className="text-amber-500">SOS</span>
        </Link>
        <Link
          href="/publicar"
          className="rounded-full bg-amber-500 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-amber-600"
        >
          + Publicar
        </Link>
      </div>
    </header>
  );
}
