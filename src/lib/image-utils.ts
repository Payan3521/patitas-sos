// ============================================================
// 🐾 Patitas SOS — Compresión de imágenes en el navegador
//
// Reduce la foto con <canvas> hasta que pese ≤ 200 KB:
//   1) Baja la calidad JPEG progresivamente.
//   2) Si aún pesa mucho, reduce también las dimensiones.
// Así ahorramos almacenamiento en el plan gratuito de Supabase
// y cumplimos el límite de AWS Rekognition.
// ============================================================

export const MAX_IMAGE_BYTES = 200 * 1024; // 200 KB

/** Lado más largo permitido tras la primera escala. */
const MAX_DIMENSION = 1280;

const JPEG_QUALITY_START = 0.85;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo comprimir la imagen.'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * Comprime cualquier foto (JPG/PNG/WebP/HEIC) a JPEG ≤ 200 KB.
 * @returns Un File JPEG listo para subir al servidor.
 */
export async function compressImageToJpeg(file: File, maxBytes = MAX_IMAGE_BYTES): Promise<File> {
  const dataUrl = await readAsDataURL(file);
  const image = await loadImage(dataUrl);

  let width = image.naturalWidth || image.width;
  let height = image.naturalHeight || image.height;
  if (!width || !height) throw new Error('La imagen no tiene dimensiones válidas.');

  // Escala inicial: máximo 1280 px en el lado más largo
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Tu navegador no soporta la compresión de imágenes.');

  const render = (quality: number): Promise<Blob> => {
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(image, 0, 0, width, height);
    return canvasToBlob(canvas, quality);
  };

  let quality = JPEG_QUALITY_START;
  let blob = await render(quality);

  // 1) Bajar la calidad progresivamente (0.85 → 0.75 → …)
  while (blob.size > maxBytes && quality > 0.3) {
    quality -= 0.1;
    blob = await render(quality);
  }

  // 2) Si aún pesa mucho, reducir dimensiones
  while (blob.size > maxBytes && width > 320) {
    width = Math.round(width * 0.8);
    height = Math.round(height * 0.8);
    quality = 0.7;
    blob = await render(quality);
  }

  return new File([blob], 'foto.jpg', { type: 'image/jpeg' });
}
