// ============================================================
// 🐾 Patitas SOS — Cliente de Supabase (Navegador)
//
// Usa la NEXT_PUBLIC_SUPABASE_ANON_KEY (llave anónima pública).
// Solo es necesaria si algún día quieres leer Supabase
// directamente desde el frontend. Hoy toda la app pasa por las
// API Routes del backend (más seguro), pero este cliente queda
// disponible para el equipo.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }

  browserClient = createClient(url, anonKey);
  return browserClient;
}
