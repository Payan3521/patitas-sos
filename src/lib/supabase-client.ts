// ============================================================
// 🐾 Patitas SOS — Cliente de Supabase para el NAVEGADOR
//
// ⚠️ Usa la NEXT_PUBLIC_SUPABASE_ANON_KEY (llave pública).
//    Se usa SOLO para el chat en tiempo real (canales de
//    broadcast): los datos del chat NUNCA viajan por aquí —
//    siempre salen de las API Routes con la sesión del usuario.
//    NUNCA importes esto en Server Components / API Routes.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

export function createBrowserSupabase(): SupabaseClient | null {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin anon key el chat sigue funcionando (sin el ping en tiempo real):
  // la página refresca al entrar y al enviar. No lanzamos error.
  if (!url || !anonKey) return null;

  cached = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cached;
}