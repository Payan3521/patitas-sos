import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { PerritoDetalle } from '@/components/PerritoDetalle';
import { createServerSupabase } from '@/lib/supabase-server';
import type { Perrito } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: 'Mascota', description: `Reporte de mascota ${id}` };
}

export default async function PerritoPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;

  const supabase = createServerSupabase();
  const { data: perrito } = await supabase
    .from('perritos')
    .select('*, usuario:usuarios(id, nombre, telefono, email)')
    .eq('id', id)
    .maybeSingle();

  if (!perrito) notFound();

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <PerritoDetalle
          perrito={perrito as Perrito}
          token={typeof token === 'string' ? token : undefined}
        />
      </main>
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        🐾 Patitas SOS · Plataforma para reconectar mascotas perdidas con sus familias
      </footer>
    </div>
  );
}