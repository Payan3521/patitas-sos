'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

export interface SesionPropia {
  email: string;
  nombre: string;
  telefono: string;
}

interface AuthContextValue {
  session: SesionPropia | null;
  loading: boolean;
  email: string | null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 🔐 Sesión PROPIA de Patitas SOS (email + contraseña).
 * Nada de Supabase Auth: la sesión vive en una cookie httpOnly y se
 * restaura consultando /api/yo. Sin rate limiting, sin OTP.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SesionPropia | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch('/api/yo')
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (!data.session) {
          setSession(null);
          return;
        }
        setSession({
          email: data.session.email ?? '',
          nombre: data.session.nombre ?? '',
          telefono: data.session.telefono ?? '',
        });
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        return { error: typeof data.error === 'string' ? data.error : 'No pudimos iniciar sesión.' };
      }
      // Hidratar el perfil (nombre/teléfono) para prellenar los formularios.
      try {
        const yo = await (await fetch('/api/yo')).json();
        if (yo.session) {
          setSession({
            email: yo.session.email ?? data.email,
            nombre: yo.session.nombre ?? '',
            telefono: yo.session.telefono ?? '',
          });
          return { error: null };
        }
      } catch {
        // Si falla la hidratación, la sesión se rellena en la siguiente carga.
      }
      setSession({ email: data.email, nombre: '', telefono: '' });
      return { error: null };
    } catch {
      return { error: 'No pudimos iniciar sesión. Intenta de nuevo.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch {
      // Igual limpiamos la sesión local.
    }
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        email: session?.email ?? null,
        login,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return ctx;
}

/**
 * Header de autorización para las API Routes. Con la sesión en cookie
 * httpOnly ya no hace falta enviar nada: se conserva por compatibilidad.
 */
export function accessTokenHeader(_session: unknown): Record<string, string> {
  return {};
}
