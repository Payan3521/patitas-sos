// ============================================================
// 🐾 Patitas SOS — Constantes de negocio
// ============================================================

/** Tamaño máximo de la foto después de comprimir (200 KB). */
export const MAX_IMAGE_BYTES = 200 * 1024;

/** Bucket público de Supabase Storage donde viven las fotos. */
export const FOTOS_BUCKET = 'fotos-perritos';

/** Modelo de Gemini (configurable por env; default: 3.5 Flash — bueno/precio balanceado, Interactions API; el más barato con visión es 3.1 Flash Lite). */
export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash';

/** Umbral mínimo de similitud (0-100) para considerar un match con Gemini. */
export const GEMINI_MATCH_THRESHOLD = 80;

/** Máximo de candidatos comparados por reporte (al publicar y en el cron). */
export const GEMINI_MAX_CANDIDATOS = 12;

/** Comparaciones de Gemini en paralelo por lote (respeta el límite RPM del free tier). */
export const GEMINI_LOTE_PARALELO = 4;

/** Tope de llamadas a Gemini por ejecución del cron diario (free tier: ~250/día). */
export const GEMINI_LIMITE_DIARIO = 200;

/** Días hacia atrás que abarca la revisión diaria automática. */
export const GEMINI_DIAS_REVISION = 7;

/** Secreto que protege la ruta del cron (header x-cron-secret). */
export const CRON_SECRET = process.env.CRON_SECRET ?? '';

/** Tamaño de página del feed (scroll infinito). */
export const FEED_PAGE_SIZE = 9;
