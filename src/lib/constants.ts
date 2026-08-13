// ============================================================
// 🐾 Patitas SOS — Constantes de negocio
// ============================================================

/** Tamaño máximo de la foto después de comprimir (200 KB). */
export const MAX_IMAGE_BYTES = 200 * 1024;

/** Bucket público de Supabase Storage donde viven las fotos. */
export const FOTOS_BUCKET = 'fotos-perritos';

/** Umbral de similitud facial de AWS Rekognition (85.0 %). */
export const FACE_MATCH_THRESHOLD = 85.0;

/** Tamaño de página del feed (scroll infinito). */
export const FEED_PAGE_SIZE = 9;
