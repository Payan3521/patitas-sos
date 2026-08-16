// ============================================================
// 🐾 PATITAS SOS — 💬 Chat privado entre las partes de un match
//
// Regla de oro (misma filosofía que la privacidad de contacto):
// el chat queda HABILITADO para ti cuando el OTRO lado de la
// coincidencia autorizó compartir su contacto (dueno_autorizo /
// encontrador_autorizo). Sin eso, el servidor rechaza abrir una
// conversación. Una vez creada, ambos participantes responden.
//
// Entrega en tiempo real: supabase realtime con BROADCAST por
// canal `chat-<match_id>`. El canal jamás transporta mensajes:
// solo un "ping" que dispara la recarga del hilo por la API con
// sesión. El servidor emite el ping tras cada inserción.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { textosEspecie } from './especie';
import type {
  AutorizacionContacto,
  ConversacionContraparte,
  LadoAutorizacion,
  Perrito,
  RolPublicacion,
} from './types';

/** Longitud máxima de un mensaje (check de la tabla `mensajes`). */
export const MAX_MENSAJE_LEN = 2000;

/** Mensajes que devuelve el hilo (los más recientes, en orden ascendente). */
export const ULTIMOS_MENSAJES = 200;

/**
 * ¿El chat está habilitado para MÍ en este match?
 * Regla: la contraparte (el otro lado) autorizó compartir SU contacto.
 *  - yo PERDIDO → contraparte es el rescatista → encontrador_autorizo
 *  - yo BUSCA_DUEÑO → contraparte es el dueño → dueno_autorizo
 */
export function chatHabilitadoPara(
  autorizacion: AutorizacionContacto,
  rolPropio: RolPublicacion | null | undefined,
): boolean {
  if (rolPropio === 'BUSCA_DUEÑO') return autorizacion.dueno_autorizo;
  return autorizacion.encontrador_autorizo;
}

/** ¿El usuario dado es el dueño o el encontrador de este match? (null = no es parte). */
export function ladoDelUsuario(
  perdido: Perrito,
  encontrado: Perrito,
  usuarioId: string,
): LadoAutorizacion | null {
  if (perdido.usuario_id === usuarioId) return 'dueno';
  if (encontrado.usuario_id === usuarioId) return 'encontrador';
  return null;
}

export interface ParticipantesDeMatch {
  match_id: string;
  perdido: Perrito;
  encontrado: Perrito;
  porcentaje_similitud: number;
  autorizacion: AutorizacionContacto;
}
/** Los dos reportes (+ contacto de sus usuarios) de un match. Nunca lanza. */
export async function participantesDeMatch(
  supabase: SupabaseClient,
  matchId: string,
): Promise<ParticipantesDeMatch | null> {
  try {
    const { data: match } = await supabase
      .from('matches_ia')
      .select('id, perrito_perdido_id, perrito_encontrado_id, porcentaje_similitud, dueno_autorizo, encontrador_autorizo')
      .eq('id', matchId)
      .maybeSingle();
    if (!match) return null;

    const perdidoId = match.perrito_perdido_id;
    const encontradoId = match.perrito_encontrado_id;
    const { data: pares } = await supabase
      .from('perritos')
      .select('*, usuario:usuarios(id, nombre, telefono, email)')
      .in('id', [perdidoId, encontradoId]);
    const perdido = (pares ?? []).find((p) => p.id === perdidoId) as Perrito | undefined;
    const encontrado = (pares ?? []).find((p) => p.id === encontradoId) as Perrito | undefined;
    if (!perdido || !encontrado) return null;

    return {
      match_id: match.id,
      perdido,
      encontrado,
      porcentaje_similitud: match.porcentaje_similitud ?? 0,
      autorizacion: {
        dueno_autorizo: !!match.dueno_autorizo,
        encontrador_autorizo: !!match.encontrador_autorizo,
      },
    };
  } catch (error) {
    console.error('participantesDeMatch falló:', error);
    return null;
  }
}

/** Busca la conversación de un match (nunca lanza). */
export async function encontrarConversacion(
  supabase: SupabaseClient,
  matchId: string,
): Promise<{ id: string; match_id: string } | null> {
  try {
    const { data } = await supabase
      .from('conversaciones')
      .select('id, match_id')
      .eq('match_id', matchId)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

/** Crea la conversación de un match (nunca lanza). */
export async function crearConversacion(
  supabase: SupabaseClient,
  matchId: string,
): Promise<{ id: string; match_id: string } | null> {
  try {
    const { data } = await supabase
      .from('conversaciones')
      .insert({ match_id: matchId })
      .select('id, match_id')
      .maybeSingle();
    return data ?? null;
  } catch (error) {
    console.error('crearConversacion falló:', error);
    return null;
  }
}

/** Descripción pública de la contraparte para la UI del chat (sin contacto). */
export function contrapartePublica(
  contraparte: Perrito,
  porcentaje: number,
  habilitada: boolean,
): ConversacionContraparte {
  const textos = textosEspecie(contraparte.especie);
  const nombre =
    contraparte.nombre_temporal ||
    (contraparte.rol_publicacion === 'PERDIDO' ? textos.perdido : textos.rescatado);
  return {
    perrito_id: contraparte.id,
    nombre,
    foto_url: contraparte.foto_url,
    rol_publicacion: contraparte.rol_publicacion,
    especie: contraparte.especie,
    estado: contraparte.estado,
    porcentaje_similitud: porcentaje,
    habilitada,
  };
}

/** Canal de realtime de una conversación (solo ping, nunca datos). */
export function canalDeChat(matchId: string): string {
  return `chat-${matchId}`;
}

/** Emite el "ping" de mensaje nuevo en el canal del match (nunca lanza). */
export async function enviarBroadcastChat(supabase: SupabaseClient, matchId: string): Promise<void> {
  try {
    const canal = supabase.channel(canalDeChat(matchId), { config: { broadcast: { self: false } } });
    const timelimit = setTimeout(() => void supabase.removeChannel(canal), 4000);
    await canal.subscribe((estado) => {
      if (estado === 'SUBSCRIBED') {
        void canal
          .send({ type: 'broadcast', event: 'nuevo', payload: { ping: Date.now() } })
          .finally(() => {
            clearTimeout(timelimit);
            void supabase.removeChannel(canal);
          });
      } else if (estado === 'CLOSED' || estado === 'CHANNEL_ERROR') {
        clearTimeout(timelimit);
        void supabase.removeChannel(canal);
      }
    });
  } catch (error) {
    console.error('enviarBroadcastChat falló:', error);
  }
}