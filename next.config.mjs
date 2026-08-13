/** @type {import('next').NextConfig} */
const nextConfig = {
  // Salida standalone: permite desplegar con Docker de forma liviana
  // (el build genera .next/standalone con todo lo necesario para correr).
  output: 'standalone',

  poweredByHeader: false,

  images: {
    // Las fotos viven en Supabase Storage y se sirven directamente.
    // Evita requerir sharp en la imagen de Docker.
    unoptimized: true,
  },
};

export default nextConfig;
