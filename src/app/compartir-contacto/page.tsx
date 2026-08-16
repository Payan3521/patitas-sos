import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { SESION_COOKIE, sesionDeToken } from '@/lib/auth';
import { chatHabilitadoPara } from '@/lib/chat';
import { textosEspecie } from '@/lib/especie';
import { verificarTokenCompartirContacto } from '@/lib/mail';
import { ladoDeRol } from '@/lib/permisos';
import { createServerSupabase } from '@/lib/supabase-server';
import { FormularioPermiso } from './FormularioPermiso';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Compartir información de contacto',
  description: 'Autoriza compartir tus datos de contacto con la contraparte de una coincidencia.',
};

interface Props {
  searchParams: Promise<{ match?: string; rol?: string; t?: string }>;
}

/**
 * 🔓 Página de consentimiento: autoriza compartir los datos de contacto
 * de una de las partes de un match. Se llega desde:
 *  - el botón del correo de coincidencia (?match&rol&t=token firmado), o
 *  - la plataforma con sesión iniciada (botones "Compartir mi contacto").
 *
 * La verificación se hace AQUÍ (servidor): sin sesión válida y sin token
 * firmado no se muestra ni el resumen de la coincidencia.
 */
export default async function CompartirContactoPage({ searchParams }: Props) {
  const { match: matchId, rol, t: token } = await searchParams;
  const rolValido = rol === 'PERDIDO' || rol === 'BUSCA_DUEÑO' ? rol : null;

  const supabase = createServerSupabase();
  const sesion = sesionDeToken((await cookies()).get(SESION_COOKIE)?.value);
  const sesionEmail = sesion?.email.toLowerCase() ?? null;

  const error = !matchId || !rolValido
    ? 'Enlace incompleto: falta la coincidencia o el rol.'
    : null;

  let data:
    | {
        matchId: string;
        rol: 'PERDIDO' | 'BUSCA_DUEÑO';
        token?: string;
        yaAutorizado: boolean;
        chatHabilitado: boolean;
        contraparte: { id: string; nombre: string; foto: string; ciudad: string; departamento: string; descripcion: string; porcentaje: number };
        misDatos: { nombre: string; telefono: string; email: string };
        sinSesion: boolean;
      }
    | undefined;

  if (!error && matchId && rolValido) {
    const lado = ladoDeRol(rolValido);

    const { data: fila } = await supabase
      .from('matches_ia')
      .select('id, perrito_perdido_id, perrito_encontrado_id, porcentaje_similitud, dueno_autorizo, encontrador_autorizo')
      .eq('id', matchId)
      .maybeSingle();

    if (!fila) {
      // Coincidencia inexistente
    } else {
      const perdidoId = fila.perrito_perdido_id;
      const encontradoId = fila.perrito_encontrado_id;
      const miId = rolValido === 'PERDIDO' ? perdidoId : encontradoId;
      const contraId = rolValido === 'PERDIDO' ? encontradoId : perdidoId;

      const { data: pares } = await supabase
        .from('perritos')
        .select('*, usuario:usuarios(id, nombre, telefono, email)')
        .in('id', [miId, contraId]);
      const mio = (pares ?? []).find((p) => p.id === miId);
      const contra = (pares ?? []).find((p) => p.id === contraId);

      // Verificación de identidad: misión de la sesión O del token firmado.
      const sesionEsMia = !!sesionEmail && (mio?.usuario?.email ?? '').toLowerCase() === sesionEmail;
      const tokenValido = verificarTokenCompartirContacto(matchId, lado, token ?? '');
      const autorizado = sesionEsMia || tokenValido;

      if (!autorizado && !sesionEsMia && !tokenValido) {
        // Sin permiso: no mostrar nada.
      } else if (mio && contra) {
        const yaAutorizado =
          rolValido === 'PERDIDO'
            ? !!fila.dueno_autorizo
            : !!fila.encontrador_autorizo;
        const nombreContra =
          contra.nombre_temporal ||
          textosEspecie(contra.especie)[contra.rol_publicacion === 'PERDIDO' ? 'perdido' : 'rescatado'];
        data = {
          matchId,
          rol: rolValido,
          token: tokenValido && !sesionEsMia ? token : undefined,
          yaAutorizado,
          chatHabilitado: chatHabilitadoPara(
            { dueno_autorizo: !!fila.dueno_autorizo, encontrador_autorizo: !!fila.encontrador_autorizo },
            rolValido,
          ),
          contraparte: {
            id: contra.id,
            nombre: nombreContra,
            foto: contra.foto_url,
            ciudad: contra.ciudad,
            departamento: contra.departamento,
            descripcion: contra.descripcion,
            porcentaje: fila.porcentaje_similitud,
          },
          misDatos: {
            nombre: mio.usuario?.nombre ?? '',
            telefono: mio.usuario?.telefono ?? '',
            email: mio.usuario?.email ?? '',
          },
          sinSesion: !sesionEsMia,
        };
      }
    }
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        {!data || error ? (
          <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center">
            <div className="text-5xl">🔒</div>
            <h1 className="mt-2 text-xl font-black text-neutral-900">Enlace no válido</h1>
            <p className="mt-1 text-sm text-neutral-600">
              {error ?? 'Esta coincidencia ya no está disponible o el enlace no es válido.'}
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-full bg-amber-500 px-8 py-3 text-base font-black text-white shadow transition hover:bg-amber-600"
            >
              Volver al inicio
            </Link>
          </div>
        ) : (
          <FormularioPermiso data={data} />
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