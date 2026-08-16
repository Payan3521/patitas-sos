import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { AvisoAvisar } from '@/components/AvisoAvisar';
import { Header } from '@/components/Header';
import { PerritoDetalle } from '@/components/PerritoDetalle';
import { SESION_COOKIE, sesionDeToken } from '@/lib/auth';
import { contactoVisible } from '@/lib/permisos';
import { createServerSupabase } from '@/lib/supabase-server';
import type { AutorizacionContacto, MatchedPublication, Perrito } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return { title: 'Mascota', description: `Reporte de mascota ${id}` };
}

/**
 * 🔒 PRIVACIDAD: los datos de contacto de una publicación solo llegan al
 * cliente cuando (a) el visitante es quien la publicó o (b) es parte de un
 * match con ella y el publicador de este reporte autorizó compartirlos
 * (dueno_autorizo / encontrador_autorizo). Todo lo demás sale sin contacto
 * y sin barrio.
 */
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

  // Sesión del visitante (para decidir permisos desde el servidor).
  const sesion = sesionDeToken((await cookies()).get(SESION_COOKIE)?.value);
  const sesionEmail = sesion?.email.toLowerCase() ?? null;

  // Publicaciones del visitante (para saber si es parte de algún match).
  let idsVisitante = new Set<string>();
  if (sesionEmail) {
    const { data: usuarios } = await supabase.from('usuarios').select('id').eq('email', sesionEmail);
    const usuarioIds = (usuarios ?? []).map((u) => u.id);
    if (usuarioIds.length > 0) {
      const { data: perritos } = await supabase.from('perritos').select('id').in('usuario_id', usuarioIds);
      idsVisitante = new Set((perritos ?? []).map((p) => p.id));
    }
  }

  // Matches de la IA en los que participa este reporte.
  const { data: pares } = await supabase
    .from('matches_ia')
    .select('id, perrito_perdido_id, perrito_encontrado_id, porcentaje_similitud, dueno_autorizo, encontrador_autorizo')
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
    const { data: contrasData } = await supabase.from('perritos').select('*').in('id', contraIds);
    contras = ((contrasData ?? []) as Perrito[]).map((c) => ({ ...c, barrio_zona: null, usuario: null }));
  }

  const matches: MatchedPublication[] = (pares ?? [])
    .map((par) => {
      const contraId = par.perrito_perdido_id === id ? par.perrito_encontrado_id : par.perrito_perdido_id;
      const contraparte = contras.find((c) => c.id === contraId);
      if (!contraparte) return null;
      const autorizacion: AutorizacionContacto = {
        dueno_autorizo: !!par.dueno_autorizo,
        encontrador_autorizo: !!par.encontrador_autorizo,
      };
      return { match_id: par.id, contraparte, porcentaje_similitud: par.porcentaje_similitud, autorizacion };
    })
    .filter((m): m is MatchedPublication => m !== null);

  const esPublicador = !!sesionEmail && (perrito.usuario?.email ?? '').toLowerCase() === sesionEmail;

  // ¿Puede el visitante ver el contacto de ESTE reporte?
  let puedeVerContacto = esPublicador;
  if (!puedeVerContacto && matches.length > 0) {
    puedeVerContacto = matches.some((match) => {
      if (!idsVisitante.has(match.contraparte.id)) return false;
      return contactoVisible(true, perrito.rol_publicacion, match.autorizacion);
    });
  }

  const perritoVisible = puedeVerContacto
    ? (perrito as Perrito)
    : ({ ...perrito, barrio_zona: null, usuario: null } as Perrito);

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <PerritoDetalle
          perrito={perritoVisible}
          token={typeof token === 'string' ? token : undefined}
          matches={matches}
          esPublicador={esPublicador}
          puedeVerContacto={puedeVerContacto}
        />

        {/* 👀 Aviso de un testigo ("Vi esta mascota") — solo público; sin
            sesión invita a iniciarla; sin texto libre: mensajes predefinidos. */}
        {perrito.estado === 'ACTIVO' && !esPublicador && !!perrito.avisos_habilitados && (
          <AvisoAvisar perritoId={perrito.id} />
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