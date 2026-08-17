// ============================================================
// 🐾 Patitas SOS — Motor de coincidencias con Gemini Flash
//
// Compartido por:
//  - POST /api/publicar-perrito  (match inmediato al publicar)
//  - POST /api/revisar-coincidencias (revisión diaria por cron)
//
// Flujo: candidatos ACTIVOS de rol opuesto de la MISMA especie (misma ciudad →
// departamento → resto del país) → comparación con Gemini en lotes paralelos →
// registro en `comparaciones` → los que pasan el umbral entran en `matches_ia`
// + notificaciones web + correos. Al publicar se comparan hasta
// GEMINI_MAX_CANDIDATOS_PUBLICACION (todo el rol opuesto, match "de una");
// el cron diario usa 12 por reporte con dedupe por `comparaciones`.
// ============================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  GEMINI_LIMITE_DIARIO,
  GEMINI_LOTE_PARALELO,
  GEMINI_MATCH_THRESHOLD,
  GEMINI_MAX_CANDIDATOS,
} from '@/lib/constants';
import { compararFotos, type ComparacionFoto } from '@/lib/gemini';
import { notificarMatch } from '@/lib/mail';
import type { AutorizacionContacto, NotificacionEstado, Perrito, Usuario } from '@/lib/types';

export type PerritoConUsuario = Perrito & {
  usuario?: Pick<Usuario, 'id' | 'nombre' | 'telefono' | 'email'> | null;
};

export interface ResultadoMatch {
  /** Id del par en `matches_ia` (para autorizar compartir contacto). */
  matchId: string;
  perrito: PerritoConUsuario;
  porcentaje_similitud: number;
  razon: string;
  notificacion: NotificacionEstado;
  /** Estado de las autorizaciones de contacto del par. */
  autorizacion: AutorizacionContacto;
}

export interface ContadorLlamadas {
  usadas: number;
}

export interface OpcionesBusqueda {
  /** Omite candidatos ya comparados en `comparaciones` (uso: cron diario). */
  saltarComparadas?: boolean;
  /** Límite máximo de llamadas a Gemini para esta búsqueda. */
  limiteLlamadas?: number;
  /** Contador compartido para respetar el límite diario del free tier. */
  contador?: ContadorLlamadas;
  /**
   * Máximo de candidatos a comparar. Al publicar se pasa
   * GEMINI_MAX_CANDIDATOS_PUBLICACION (300: compara todo el rol opuesto);
   * el cron usa el default GEMINI_MAX_CANDIDATOS (12 por reporte).
   */
  maxCandidatos?: number;
}

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function esErrorDeCuota(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error);
  return /429|RESOURCE_EXHAUSTED|quota|rate limit/i.test(mensaje);
}

/**
 * Extrae del 429 de Google el tiempo sugerido de espera
 * ("Please retry in 8.5s") para no martillar el límite de RPM.
 */
function retryInSegundos(error: unknown): number {
  const mensaje = error instanceof Error ? error.message : String(error);
  const coincidencia = mensaje.match(/retry in ([\d.]+)s/i);
  if (!coincidencia) return 5;
  const segundos = Number.parseFloat(coincidencia[1]);
  return Number.isFinite(segundos) ? segundos : 5;
}

/** Llama a Gemini con 1 reintento ante cuotas (429) o fallos transitorios,
 *  esperando el tiempo que Google indique cuando hay límite de RPM. */
async function llamarConReintento(
  fn: () => Promise<ComparacionFoto>,
  contador?: ContadorLlamadas,
  limite?: number,
): Promise<ComparacionFoto> {
  if (contador && limite && contador.usadas >= limite) {
    throw new Error('Límite diario de llamadas a Gemini alcanzado.');
  }
  for (let intento = 1; intento <= 2; intento++) {
    try {
      const resultado = await fn();
      if (contador) contador.usadas += 1;
      return resultado;
    } catch (error) {
      const cuota = esErrorDeCuota(error);
      if (intento === 1) {
        await esperar(cuota ? Math.min(retryInSegundos(error), 60) : 1_000);
        continue;
      }
      throw error;
    }
  }
  throw new Error('No se pudo completar la comparación.');
}

/** Clave canónica de una comparación (orden alfabético, sin importar quién comparó). */
function parCanonico(idA: string, idB: string): { a: string; b: string } {
  return idA < idB ? { a: idA, b: idB } : { a: idB, b: idA };
}

/** Descarga la foto pública de un reporte para enviarla a Gemini. */
async function descargarFoto(perrito: PerritoConUsuario): Promise<Uint8Array> {
  const res = await fetch(perrito.foto_url, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`No se pudo descargar la foto del reporte ${perrito.id}.`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength === 0) throw new Error('La foto del reporte está vacía.');
  return buf;
}

/**
 * Busca los candidatos ACTIVOS de rol opuesto para un reporte,
 * filtrados por la MISMA especie (comparar un perro contra gatos
 * gasta llamadas y añade ruido: el modelo siempre diría que no),
 * ordenados por cercanía (misma ciudad → mismo departamento → resto
 * del país) y luego por más recientes, hasta `maxCandidatos`.
 */
async function obtenerCandidatos(
  supabase: SupabaseClient,
  perrito: PerritoConUsuario,
  saltarComparadas: boolean,
  maxCandidatos: number,
): Promise<PerritoConUsuario[]> {
  const rolOpuesto = perrito.rol_publicacion === 'PERDIDO' ? 'BUSCA_DUEÑO' : 'PERDIDO';

  const { data, error } = await supabase
    .from('perritos')
    .select('*, usuario:usuarios(id, nombre, telefono, email)')
    .eq('rol_publicacion', rolOpuesto)
    .eq('especie', perrito.especie)
    .eq('estado', 'ACTIVO')
    .neq('id', perrito.id)
    .neq('usuario_id', perrito.usuario_id)
    .order('creado_en', { ascending: false })
    .limit(Math.min(maxCandidatos * 4, 1500));

  if (error) throw error;
  const candidatos = (data ?? []) as PerritoConUsuario[];

  let filtrados = candidatos;
  if (saltarComparadas && candidatos.length > 0) {
    const { data: previas, error: errorPrevias } = await supabase
      .from('comparaciones')
      .select('perrito_a_id, perrito_b_id')
      .or(`perrito_a_id.eq.${perrito.id},perrito_b_id.eq.${perrito.id}`);
    if (errorPrevias) throw errorPrevias;
    const yaComparados = new Set<string>();
    for (const fila of previas ?? []) {
      yaComparados.add(fila.perrito_a_id === perrito.id ? fila.perrito_b_id : fila.perrito_a_id);
    }
    filtrados = candidatos.filter((c) => !yaComparados.has(c.id));
  }

  const cercania = (c: PerritoConUsuario) =>
    c.ciudad === perrito.ciudad ? 0 : c.departamento === perrito.departamento ? 1 : 2;

  return filtrados
    .sort((x, y) => cercania(x) - cercania(y) || y.creado_en.localeCompare(x.creado_en))
    .slice(0, maxCandidatos);
}

/** Registra el resultado de una comparación (dedupe por par canónico). */
async function registrarComparacion(
  supabase: SupabaseClient,
  perritoId: string,
  candidatoId: string,
  dictamen: ComparacionFoto,
): Promise<void> {
  const par = parCanonico(perritoId, candidatoId);
  await supabase.from('comparaciones').upsert(
    {
      perrito_a_id: par.a,
      perrito_b_id: par.b,
      es_mismo: dictamen.es_mismo,
      similitud: dictamen.similitud,
      razon: dictamen.razon,
    },
    { onConflict: 'perrito_a_id,perrito_b_id', ignoreDuplicates: true },
  );
}

/** Registra el par en matches_ia + notificaciones web (nunca bloquea). */
async function registrarMatch(
  supabase: SupabaseClient,
  perdidoId: string,
  encontradoId: string,
  porcentaje: number,
  razon: string,
): Promise<void> {
  try {
    await supabase.from('matches_ia').upsert(
      {
        perrito_perdido_id: perdidoId,
        perrito_encontrado_id: encontradoId,
        porcentaje_similitud: porcentaje,
        razon: razon.slice(0, 500),
      },
      { onConflict: 'perrito_perdido_id, perrito_encontrado_id', ignoreDuplicates: true },
    );
  } catch (error) {
    console.error('Upsert en matches_ia falló:', error);
  }

  // Notificaciones WEB para ambas partes (canal de reemplazo del correo)
  try {
    const { data: pares } = await supabase
      .from('perritos')
      .select('*, usuario:usuarios(id, nombre, telefono, email)')
      .in('id', [perdidoId, encontradoId]);

    const perdido = (pares ?? []).find((p) => p.id === perdidoId) as PerritoConUsuario | undefined;
    const encontrado = (pares ?? []).find((p) => p.id === encontradoId) as PerritoConUsuario | undefined;

    const notificaciones = [
      {
        usuario_id: perdido?.usuario?.id,
        perrito_id: encontradoId,
        mi_perrito_id: perdidoId,
        porcentaje_similitud: porcentaje,
      },
      {
        usuario_id: encontrado?.usuario?.id,
        perrito_id: perdidoId,
        mi_perrito_id: encontradoId,
        porcentaje_similitud: porcentaje,
      },
    ].filter((n) => n.usuario_id);
    if (notificaciones.length > 0) {
      await supabase.from('notificaciones').upsert(notificaciones, {
        onConflict: 'usuario_id,perrito_id,mi_perrito_id',
        ignoreDuplicates: true,
      });
    }
  } catch (error) {
    console.error('Insertar notificaciones web falló:', error);
  }
}

/** Notifica por email (solo la primera vez, nunca bloquea). */
async function notificarPorEmail(
  supabase: SupabaseClient,
  perdidoId: string,
  encontradoId: string,
  matchId: string,
  porcentaje: number,
): Promise<NotificacionEstado> {
  const sinEnviar: NotificacionEstado = {
    ok: false,
    enviados: 0,
    total: 2,
    detalle: 'El par ya había sido notificado por correo.',
  };
  try {
    const { data: par } = await supabase
      .from('matches_ia')
      .select('notificados')
      .eq('perrito_perdido_id', perdidoId)
      .eq('perrito_encontrado_id', encontradoId)
      .maybeSingle();

    if (par?.notificados) return sinEnviar;

    const { data: pares } = await supabase
      .from('perritos')
      .select('*, usuario:usuarios(id, nombre, telefono, email)')
      .in('id', [perdidoId, encontradoId]);

    const perdido = (pares ?? []).find((p) => p.id === perdidoId) as PerritoConUsuario | undefined;
    const encontrado = (pares ?? []).find((p) => p.id === encontradoId) as PerritoConUsuario | undefined;

    if (!perdido || !encontrado) {
      return { ok: false, enviados: 0, total: 2, detalle: 'Faltan datos de una de las partes.' };
    }

    const resultado = await notificarMatch({ perdido, encontrado, matchId, porcentajeSimilitud: porcentaje });
    if (resultado.ok) {
      await supabase
        .from('matches_ia')
        .update({ notificados: true })
        .eq('perrito_perdido_id', perdidoId)
        .eq('perrito_encontrado_id', encontradoId);
    } else {
      console.warn('Notificación de match falló:', resultado.detalle);
    }
    return resultado;
  } catch (error) {
    console.error('Error al notificar el match por email:', error);
    return { ok: false, enviados: 0, total: 2, detalle: 'Error al notificar por correo.' };
  }
}

/**
 * Busca coincidencias para un reporte usando Gemini Flash.
 * NUNCA lanza excepciones por fallos de la IA: si algo falla devuelve null
 * (la publicación siempre queda guardada).
 */
export async function buscarCoincidenciasPara(
  supabase: SupabaseClient,
  perritoId: string,
  opciones: OpcionesBusqueda = {},
): Promise<ResultadoMatch | null> {
  const contador = opciones.contador ?? { usadas: 0 };
  const limiteLlamadas = opciones.limiteLlamadas ?? GEMINI_LIMITE_DIARIO;
  const maxCandidatos = opciones.maxCandidatos ?? GEMINI_MAX_CANDIDATOS;

  try {
    const { data: perrito } = await supabase
      .from('perritos')
      .select('*, usuario:usuarios(id, nombre, telefono, email)')
      .eq('id', perritoId)
      .maybeSingle();
    if (!perrito || perrito.estado !== 'ACTIVO') return null;
    const reporte = perrito as PerritoConUsuario;

    const candidatos = await obtenerCandidatos(supabase, reporte, opciones.saltarComparadas ?? false, maxCandidatos);
    if (candidatos.length === 0) return null;

    const fotoA = await descargarFoto(reporte);

    const resultados: { candidato: PerritoConUsuario; dictamen: ComparacionFoto }[] = [];
    for (let i = 0; i < candidatos.length; i += GEMINI_LOTE_PARALELO) {
      const lote = candidatos.slice(i, i + GEMINI_LOTE_PARALELO);
      const dictamenes = await Promise.allSettled(
        lote.map((candidato) =>
          llamarConReintento(
            () =>
              compararFotos(
                fotoA,
                candidato.foto_url,
                reporte.descripcion,
                candidato.descripcion,
              ),
            contador,
            limiteLlamadas,
          ),
        ),
      );

      for (let j = 0; j < lote.length; j++) {
        const candidato = lote[j];
        const resultado = dictamenes[j];
        if (resultado.status === 'rejected') {
          console.warn(`Comparación fallida con ${candidato.id}:`, resultado.reason);
          continue;
        }
        resultados.push({ candidato, dictamen: resultado.value });
        await registrarComparacion(supabase, reporte.id, candidato.id, resultado.value).catch(() => {});
      }
    }

    // Filtro de match: el modelo dice que es el mismo animal Y supera el umbral
    const coincidencias = resultados.filter(
      (r) => r.dictamen.es_mismo && r.dictamen.similitud >= GEMINI_MATCH_THRESHOLD,
    );
    if (coincidencias.length === 0) return null;

    coincidencias.sort((a, b) => b.dictamen.similitud - a.dictamen.similitud);
    const mejor = coincidencias[0];
    const porcentaje = Math.round(mejor.dictamen.similitud * 100) / 100;

    const perdidoId =
      reporte.rol_publicacion === 'PERDIDO' ? reporte.id : mejor.candidato.id;
    const encontradoId =
      reporte.rol_publicacion === 'PERDIDO' ? mejor.candidato.id : reporte.id;

    await registrarMatch(supabase, perdidoId, encontradoId, porcentaje, mejor.dictamen.razon);

    const { data: filaMatch } = await supabase
      .from('matches_ia')
      .select('id, dueno_autorizo, encontrador_autorizo')
      .eq('perrito_perdido_id', perdidoId)
      .eq('perrito_encontrado_id', encontradoId)
      .maybeSingle();

    const matchId = filaMatch?.id ?? '';
    const autorizacion: AutorizacionContacto = {
      dueno_autorizo: !!filaMatch?.dueno_autorizo,
      encontrador_autorizo: !!filaMatch?.encontrador_autorizo,
    };

    const notificacion = await notificarPorEmail(supabase, perdidoId, encontradoId, matchId, porcentaje);

    return {
      matchId,
      perrito: mejor.candidato,
      porcentaje_similitud: porcentaje,
      razon: mejor.dictamen.razon,
      notificacion,
      autorizacion,
    };
  } catch (error) {
    console.error('buscarCoincidenciasPara falló (no bloquea la publicación):', error);
    return null;
  }
}

/** Obtiene los reportes ACTIVOS recientes con comparaciones pendientes (cron). */
export async function obtenerReportesParaRevision(
  supabase: SupabaseClient,
  dias: number,
  limite: number,
): Promise<PerritoConUsuario[]> {
  const { data, error } = await supabase
    .from('perritos')
    .select('*, usuario:usuarios(id, nombre, telefono, email)')
    .eq('estado', 'ACTIVO')
    .gte('creado_en', new Date(Date.now() - dias * 86_400_000).toISOString())
    .order('creado_en', { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as PerritoConUsuario[];
}