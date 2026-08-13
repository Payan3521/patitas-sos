import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { PublicarForm } from '@/components/PublicarForm';

export const metadata: Metadata = {
  title: 'Publicar reporte',
  description:
    'Publica el reporte de tu perrito perdido o de un perrito que rescataste tras el sismo. La IA busca coincidencias al instante.',
};

export default function PublicarPage() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-6">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Publicar un reporte</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Cuanto más clara sea la foto del rostro, más rápido la IA encontrará una coincidencia.
        </p>
        <div className="mt-6">
          <PublicarForm />
        </div>
      </main>
      <footer className="border-t border-neutral-200 bg-white py-6 text-center text-xs text-neutral-400">
        🐾 Patitas SOS · Plataforma de ayuda humanitaria post-terremoto
      </footer>
    </div>
  );
}
