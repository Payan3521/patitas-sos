import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { PerritoDetalle } from '@/components/PerritoDetalle';
import { createServerSupabase } from '@/lib/supabase-server';
import type { MatchedPublication, Perrito } from '@/lib/types';

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

  // Matches de la IA en los que participa este reporte (para las partes).
  const { data: pares } = await supabase
    .from('matches_ia')
    .select('perrito_perdido_id, perrito_encontrado_id, porcentaje_similitud')
    .or(`perrito_perdido_id.eq.${id},perrito_encontrado_id.eq.${id}`);

  const contraIds = [
    ...new Set(
      (pares ?? []).map((par) =>
        par.perrito_perdido_id === id ? par.perrito_encontrado_id : par.perrito_perdido_id,
      ),
    ),
  ];

  let contras: Perrito[] = [];
  if (contraIds.length > 0) {
    const { data: contrasData } = await supabase
      .from('perritos')
      .select('*')
      .in('id', contraIds);
    contras = (contrasData ?? []) as Perrito[];
  }

  const matches: MatchedPublication[] = (pares ?? [])
    .map((par) => {
      const contraId = par.perrito_perdido_id === id ? par.perrito_encontrado_id : par.perrito_perdido_id;
      const contraparte = contras.find((c) => c.id === contraId);
      return contraparte ? { contraparte, porcentaje_similitud: par.porcentaje_similitud } : null;
    })
    .filter((m): m is MatchedPublication => m !== null);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <PerritoDetalle
          perrito={perrito as Perrito}
          token={typeof token === 'string' ? token : undefined}
          matches={matches}
        />
      </main>
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        🐾 Patitas SOS · Plataforma para reconectar mascotas perdidas con sus familias
      </footer>
    </div>
  );
}