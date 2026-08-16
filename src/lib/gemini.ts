// ============================================================
// 🐾 Patitas SOS — Gemini (Google GenAI SDK, Interactions API)
//
// Reemplaza a AWS Rekognition: en lugar de "indexar caras",
// compara dos fotos y pregunta al modelo si son el mismo animal.
// - compararFotos(): dictamen { es_mismo, similitud, razon }.
//
// Usa la INTERACTIONS API de Google (la API reemplazo de
// generateContent para llaves/usuarios nuevos desde 2026; los
// modelos 2.x con generateContent ya no están disponibles y los
// 3.x se sirven únicamente por esta vía).
//
// Modelo configurable con GEMINI_MODEL (default: gemini-3.5-flash;
// el más barato es gemini-3.1-flash-lite — ver docs/costos.md).
// ============================================================

import { GoogleGenAI, Type, type Schema } from '@google/genai';

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';
const TIMEOUT_MS = 25_000;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export interface ComparacionFoto {
  es_mismo: boolean;
  similitud: number;
  razon: string;
}

let client: GoogleGenAI | null = null;

function obtenerCliente(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('Falta la variable GEMINI_API_KEY en el servidor.');
  }
  if (!client) client = new GoogleGenAI({ apiKey });
  return client;
}

const PROMPT_SISTEMA = `Eres el asistente de reconocimiento visual de Patitas SOS, una app colombiana que reconecta mascotas perdidas con sus familias.

Vas a recibir DOS fotos de mascotas (FOTO A y FOTO B) y debes decidir si son EL MISMO animal (no solo la misma especie o raza: el mismo individuo).

Compara cuidadosamente:
- Especie (perro o gato) y raza aparente
- Color del pelaje y patrones / manchas (son la marca más confiable)
- Tamaño y complexión, edad aparente
- Señas particulares (collar, cicatrices, ojos, orejas)
- Contexto de la foto (fondo, personas, lugar) como pista secundaria

NO te dejes engañar por dos animales de la misma raza que no son el mismo individuo.
Si no hay suficiente detalle (foto lejana, borrosa, de espaldas), responde conservador.

Responde SIEMPRE con JSON: es_mismo (true/false), similitud (entero 0-100: qué tan seguro estás de que son el mismo animal), razon (máx 2 frases en español, menciona las marcas distintivas comparadas).`;

const ESQUEMA_RESPUESTA: Schema = {
  type: Type.OBJECT,
  properties: {
    es_mismo: { type: Type.BOOLEAN },
    similitud: { type: Type.INTEGER },
    razon: { type: Type.STRING },
  },
  required: ['es_mismo', 'similitud', 'razon'],
};

/** Descarga una imagen pública y la devuelve en base64 para Gemini. */
async function descargarBase64(url: string, mimeType: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`No se pudo descargar la foto del candidato (HTTP ${res.status}).`);
  }
  const tipo = res.headers.get('content-type') ?? mimeType;
  if (!tipo.startsWith('image/')) {
    throw new Error('La foto del candidato no es una imagen válida.');
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength === 0 || buffer.byteLength > IMAGE_MAX_BYTES) {
    throw new Error('La foto del candidato es demasiado grande o está vacía.');
  }
  return { data: buffer.toString('base64'), mimeType: tipo };
}

/** Separa la descripción de las fotos (contexto extra para la comparación). */
function contextoDescripcion(descripcion: string | null | undefined): string {
  const limpia = (descripcion ?? '').trim().slice(0, 300);
  return limpia ? limpia : 'Sin descripción';
}

/** Parsea el JSON del modelo tolerando cercos ```json y texto alrededor. */
function extraerJson(texto: string): Partial<ComparacionFoto> {
  try {
    return JSON.parse(texto) as Partial<ComparacionFoto>;
  } catch {
    const conCercos = /```(?:json)?\s*([\s\S]*?)```/.exec(texto);
    if (conCercos) return JSON.parse(conCercos[1]) as Partial<ComparacionFoto>;
    const objeto = /{[\s\S]*}/.exec(texto);
    if (objeto) return JSON.parse(objeto[0]) as Partial<ComparacionFoto>;
    throw new Error('Gemini devolvió una respuesta no válida.');
  }
}

/**
 * Compara dos fotos de mascotas con Gemini y devuelve el dictamen.
 * @param fotoABytes Bytes de la foto del reporte recién publicado.
 * @param fotoBUrl   URL pública de la foto candidata (otro reporte).
 * @param descripcionA Descripción del reporte A (raza/color, opcional).
 * @param descripcionB Descripción del reporte B (opcional).
 */
export async function compararFotos(
  fotoABytes: Uint8Array,
  fotoBUrl: string,
  descripcionA?: string,
  descripcionB?: string,
): Promise<ComparacionFoto> {
  const [fotoB] = await Promise.all([
    descargarBase64(fotoBUrl, 'image/jpeg'),
  ]);

  const prompt =
    `FOTO A (reporte "${contextoDescripcion(descripcionA)}") y FOTO B (reporte "${contextoDescripcion(descripcionB)}"): ` +
    '¿Son el mismo animal? Responde únicamente con el JSON indicado.';

  const response = await obtenerCliente().interactions.create({
    model: GEMINI_MODEL,
    store: false,
    system_instruction: PROMPT_SISTEMA,
    response_format: {
      type: 'text',
      mime_type: 'application/json',
      schema: ESQUEMA_RESPUESTA as unknown as Record<string, unknown>,
    },
    input: [
      { type: 'image', mime_type: 'image/jpeg', data: Buffer.from(fotoABytes).toString('base64') },
      { type: 'image', mime_type: fotoB.mimeType, data: fotoB.data },
      { type: 'text', text: prompt },
    ],
  });

  const texto = response.output_text?.trim();
  if (!texto) {
    throw new Error('Gemini no devolvió respuesta.');
  }

  const parsed = extraerJson(texto);
  const similitud = Math.max(0, Math.min(100, Math.round(Number(parsed.similitud) || 0)));
  return {
    es_mismo: Boolean(parsed.es_mismo),
    similitud,
    razon: String(parsed.razon ?? '').slice(0, 500),
  };
}