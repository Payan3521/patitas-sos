import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/Header';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description:
    'Cómo Patitas SOS recoge, usa y protege tus datos personales cuando reportas una mascota perdida o encontrada.',
};

const correoContacto = process.env.BREVO_FROM ?? 'el equipo de Patitas SOS';

const secciones = [
  {
    icono: '📋',
    titulo: '1. Qué datos recogemos',
    texto: [
      'Datos de cuenta: nombre, correo electrónico y teléfono, que proporcionas voluntariamente al registrarte.',
      'Datos de la publicación: fotos, descripción, especie, características y el barrio o dirección donde se perdió o se encontró la mascota.',
      'Datos técnicos básicos: fecha y hora de tus reportes y autorizaciones, con el único fin de gestionar la plataforma.',
    ],
  },
  {
    icono: '🎯',
    titulo: '2. Para qué usamos tus datos',
    texto: [
      'Mostrar tu reporte de mascota perdida o encontrada en el directorio público de la plataforma.',
      'Ejecutar el motor de coincidencias por IA que detecta si dos reportes corresponden al mismo animal.',
      'Enviarte por correo las coincidencias de tus reportes y, cuando autorices, informar a la otra parte.',
      'Mejorar y dar soporte a la plataforma.',
    ],
  },
  {
    icono: '🤝',
    titulo: '3. Con quién compartimos tus datos (y cuándo)',
    texto: [
      'Datos públicos: tu nombre, el barrio del reporte y la descripción de la mascota se muestran en el directorio público para que la comunidad pueda ayudarte. Tu teléfono, correo y dirección exacta NO son públicos.',
      'Compartir con la contraparte: si la IA encuentra una coincidencia con otra publicación, la otra persona NO ve tus datos de contacto automáticamente. Solo recibe tu nombre, teléfono y correo si TÚ lo autorizas expresamente (marcando el consentimiento en la plataforma o en el correo que recibes), y lo mismo ocurre a la inversa: tú solo ves los datos de la contraparte si esa persona lo autoriza.',
      'Tu barrio o dirección nunca se muestra a la contraparte hasta que tú autorizas el intercambio.',
      'No vendemos ni alquilamos tus datos y no los compartimos con terceros, salvo proveedores técnicos de correo (necesarios para enviarte notificaciones) o cuando la ley lo exija.',
    ],
  },
  {
    icono: '🔐',
    titulo: '4. Cómo protegemos tus datos',
    texto: [
      'Las contraseñas se almacenan encriptadas (hash seguro) y nunca en texto plano.',
      'Los reportes muestran a los visitantes solo la información mínima necesaria.',
      'Las autorizaciones de intercambio de contacto se registran con fecha y hora, y el enlace del correo usa firmas criptográficas válidas por tiempo limitado.',
    ],
  },
  {
    icono: '⚖️',
    titulo: '5. Tus derechos',
    texto: [
      'Acceder y corregir: puedes editar tu perfil y publicaciones en cualquier momento.',
      'Eliminar: puedes borrar tus publicaciones; si quieres eliminar tu cuenta y todos tus datos, escríbenos al correo de contacto.',
      'Revocar una autorización: si autorizaste compartir tus datos y cambias de opinión, escríbenos y eliminaremos esa autorización.',
      'Retención: conservamos los datos mientras tu cuenta esté activa o mientras existan publicaciones asociadas. Al borrar tu publicación o cuenta, eliminamos los datos asociados.',
    ],
  },
  {
    icono: '✉️',
    titulo: '6. Contacto',
    texto: [
      `Para ejercer cualquiera de tus derechos, dudas o solicitudes de eliminación, escríbenos a: ${correoContacto}`,
      'Respondemos a las solicitudes dentro de los 15 días hábiles siguientes a su recibo.',
    ],
  },
];

export default async function PoliticaDePrivacidadPage() {
  const fecha = new Date().toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8">
        <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-10">
          <div className="text-5xl">🧾</div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-neutral-900 sm:text-3xl">
            Política de Privacidad
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Patitas SOS · Última actualización: {fecha}
          </p>

          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            💛 <b>En resumen:</b> vemos tus reportes para encontrar a las mascotas, y tus datos de
            contacto <b>solo</b> viajan a otra persona cuando tú das el visto bueno. Sin
            consentimiento no hay intercambio.
          </div>

          <div className="mt-8 space-y-8">
            {secciones.map((s) => (
              <section key={s.titulo}>
                <h2 className="text-lg font-extrabold text-neutral-900">
                  {s.icono} {s.titulo}
                </h2>
                <ul className="mt-2 space-y-2">
                  {s.texto.map((p, i) => (
                    <li key={i} className="text-sm leading-relaxed text-neutral-600">
                      • {p}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
            <Link href="/" className="font-bold text-amber-600 underline">
              ← Volver a Patitas SOS
            </Link>
          </div>
        </div>
      </main>
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        🐾 Patitas SOS · Esta política aplica a la plataforma web de Patitas SOS
      </footer>
    </div>
  );
}