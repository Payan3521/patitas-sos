import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { PublicarForm } from '@/components/PublicarForm';

export const metadata: Metadata = {
  title: 'Publicar reporte',
  description:
    'Publica el reporte de tu mascota perdida o de una mascota que encontraste. La IA busca coincidencias al instante y avisamos por correo a la otra persona.',
};

export default function PublicarPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Publicar un reporte</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cuanto más clara sea la foto de la mascota, más rápido la IA encontrará una coincidencia. Funciona con perros y gatos.
        </p>
        <div className="mt-6">
          <PublicarForm />
        </div>
      </main>
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        🐾 Patitas SOS · Conectamos mascotas perdidas con sus familias en Colombia
      </footer>
    </div>
  );
}
