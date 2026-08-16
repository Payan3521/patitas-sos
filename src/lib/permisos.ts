// ============================================================
// 🐾 PATITAS SOS — Privacidad: permisos de datos de contacto
//
// Regla de oro (Política de Privacidad): los datos personales
// (nombre, teléfono, correo, barrio) de una publicación SOLO se
// entregan cuando:
//   1) Hay un match real entre la publicación visitada y la del
//      visitante (ambas son parte del mismo par en `matches_ia`), Y
//   2) La persona dueña de esos datos autorizó compartirlos
//      (dueno_autorizo / encontrador_autorizo en `matches_ia`).
//
// Todo el servidor usa estas funciones: ningún endpoint entrega
// contacto sin pasar por aquí (no basta esconderlo en el frontend).
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AutorizacionContacto, LadoAutorizacion, RolPublicacion } from './types';

/** Autorizaciones de contacto de un par de `matches_ia` (nunca lanza). */
export async function autorizacionDeMatch(
  supabase: SupabaseClient,
  perdidoId: string,
  encontradoId: string,
): Promise<AutorizacionContacto> {
  try {
    const { data } = await supabase
      .from('matches_ia')
      .select('dueno_autorizo, encontrador_autorizo')
      .eq('perrito_perdido_id', perdidoId)
      .eq('perrito_encontrado_id', encontradoId)
      .maybeSingle();

    return {
      dueno_autorizo: !!data?.dueno_autorizo,
      encontrador_autorizo: !!data?.encontrador_autorizo,
    };
  } catch {
    return { dueno_autorizo: false, encontrador_autorizo: false };
  }
}

/**
 * ¿La sesión puede ver el contacto de la publicación que se visita?
 * - `esParteDelMatch`: el visitante es una de las dos partes del par.
 * - `rolPublicacion`: rol de la publicación VISITADA (el contacto es de
 *   quien la publicó): PERDIDO → lo autoriza el dueño; BUSCA_DUEÑO →
 *   lo autoriza el encontrador.
 */
export function contactoVisible(
  esParteDelMatch: boolean,
  rolPublicacion: RolPublicacion | null | undefined,
  autorizacion: AutorizacionContacto,
): boolean {
  if (!esParteDelMatch) return false;
  if (rolPublicacion === 'BUSCA_DUEÑO') return autorizacion.encontrador_autorizo;
  return autorizacion.dueno_autorizo;
}

/** Lado de `matches_ia` correspondiente a un rol de publicación. */
export function ladoDeRol(rol: RolPublicacion | null | undefined): LadoAutorizacion {
  return rol === 'BUSCA_DUEÑO' ? 'encontrador' : 'dueno';
}

/** ¿Esta autorización ya está concedida para el lado indicado? */
export function yaAutorizado(autorizacion: AutorizacionContacto, lado: LadoAutorizacion): boolean {
  return lado === 'dueno' ? autorizacion.dueno_autorizo : autorizacion.encontrador_autorizo;
}

/** Versión de la Política de Privacidad que se guarda con cada consentimiento. */
export const POLITICA_PRIVACIDAD_VERSION = 'politica-privacidad-v1-2026';

/** Texto exacto del consentimiento (lo que registra la auditoría). */
export const TEXTO_CONSENTIMIENTO_CONTACTO = `Autorizo a Patitas SOS compartir mis datos de contacto (nombre, teléfono, correo electrónico y barrio) únicamente con la persona que publicó la contraparte de esta coincidencia, para poder comunicarnos y reunir a la mascota con su familia. Entiendo que puedo revocar este permiso contactando a la plataforma. Acepto la Política de Privacidad (${POLITICA_PRIVACIDAD_VERSION}).`;