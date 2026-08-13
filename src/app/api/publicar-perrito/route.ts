// ============================================================
// 🐾 PATITAS SOS — POST /api/publicar-perrito
//
// Flujo unificado (Dueño "PERDIDO" o Rescatista "BUSCA_DUEÑO"):
//   1. Recibe formulario + foto (multipart/form-data).
//   2. La foto ya llega comprimida ≤ 200 KB desde el cliente;
//      el servidor valida el tamaño por seguridad.
//   3. Sube la foto al bucket público 'fotos-perritos' (Supabase Storage).
//   4. IndexFacesCommand → registra la cara en AWS Rekognition → FaceId.
//   5. Guarda el reporte en la tabla `perritos` (incluye aws_face_id).
//   6. SearchFacesByImageCommand con umbral 85.0 %.
//   7. Si hay match con rol opuesto y reporte ACTIVO → registra en
//      `matches_ia`, marca ambos como RECONCILIADO y devuelve
//      `match: true` con los datos de contacto de la contraparte.
// ============================================================

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FACE_MATCH_THRESHOLD, FOTOS_BUCKET, MAX_IMAGE_BYTES } from '@/lib/constants';
import {
  deleteFace,
  indexFace,
  NoFaceDetectedError,
  searchFacesByImage,
  type FaceMatch,
} from '@/lib/rekognition';
import { createServerSupabase } from '@/lib/supabase-server';
import type { Perrito } from '@/lib/types';
import { validatePublicarInput, type PublicarInput } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type PerritoConUsuario = Perrito & {
  usuario?: { id: string; nombre: string; telefono: string; email: string | null } | null;
};

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function POST(request: NextRequest) {
  let supabase: SupabaseClient | null = null;
  let perritoId = '';
  let fotoPath = '';
  let fotoSubida = false;
  let faceId: string | null = null;

  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return json({ ok: false, error: 'Envío inválido. Usa el formulario de la página.' }, 400);
    }

    // --- 1. Validar los campos del formulario ---
    const validation = validatePublicarInput(formData);
    if (!validation.ok) return json({ ok: false, error: validation.error }, 400);
    const input: PublicarInput = validation.data;

    // --- 2. Validar la foto ---
    const foto = formData.get('foto');
    if (!(foto instanceof File)) {
      return json({ ok: false, error: 'Sube una foto del rostro de la mascota.' }, 400);
    }
    if (!foto.type.startsWith('image/')) {
      return json({ ok: false, error: 'El archivo debe ser una imagen (JPG, PNG o WebP).' }, 400);
    }
    if (foto.size > MAX_IMAGE_BYTES) {
      return json(
        {
          ok: false,
          error: 'La foto supera los 200 KB. Elige una foto más clara o comprímela desde tu teléfono.',
        },
        400,
      );
    }
    if (foto.size < 1024) {
      return json({ ok: false, error: 'La foto es demasiado pequeña. Envía una imagen más nítida.' }, 400);
    }

    const imageBytes = Buffer.from(await foto.arrayBuffer());
    supabase = createServerSupabase();
    perritoId = randomUUID();

    // --- 3. Reutilizar (o crear) el usuario ---
    const usuarioId = await findOrCreateUsuario(supabase, input);

    // --- 4. Subir foto al bucket público 'fotos-perritos' ---
    fotoPath = `perritos/${perritoId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(FOTOS_BUCKET)
      .upload(fotoPath, imageBytes, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
      });
    if (uploadError) {
      console.error('Upload a Supabase Storage falló:', uploadError);
      return json({ ok: false, error: 'No pudimos subir la foto. Intenta de nuevo en unos segundos.' }, 502);
    }
    fotoSubida = true;

    const { data: publicUrlData } = supabase.storage.from(FOTOS_BUCKET).getPublicUrl(fotoPath);
    const fotoUrl = publicUrlData.publicUrl;

    // --- 5. Registrar la cara en AWS Rekognition (IndexFaces) ---
    try {
      faceId = await indexFace(imageBytes, perritoId);
    } catch (error) {
      if (error instanceof NoFaceDetectedError) {
        // Limpiar la foto huérfana y pedir otra foto clara
        await supabase.storage.from(FOTOS_BUCKET).remove([fotoPath]).catch(() => {});
        return json(
          {
            ok: false,
            error:
              'No detectamos una cara clara en la foto. Por favor intenta con otra foto del rostro, de frente y con buena luz.',
          },
          422,
        );
      }
      throw error;
    }

    // --- 6. Guardar el reporte en `perritos` ---
    const { data: perrito, error: insertError } = await supabase
      .from('perritos')
      .insert({
        id: perritoId,
        usuario_id: usuarioId,
        rol_publicacion: input.rol,
        nombre_temporal: input.nombreTemporal,
        descripcion: input.descripcion,
        ciudad: input.ciudad,
        barrio_zona: input.barrioZona,
        foto_url: fotoUrl,
        aws_face_id: faceId,
        estado: 'ACTIVO',
      })
      .select('*')
      .single();

    if (insertError || !perrito) {
      console.error('Insert en perritos falló:', insertError);
      await limpiarRecursos(supabase, fotoPath, faceId);
      return json({ ok: false, error: 'No pudimos guardar el reporte. Intenta de nuevo.' }, 500);
    }

    // --- 7. Buscar coincidencias con AWS Rekognition (SearchFacesByImage, 85%) ---
    const match = await buscarCoincidencias(supabase, input, imageBytes, perritoId);

    if (match) {
      return json({
        ok: true,
        match: true,
        perritoId,
        matchInfo: {
          perrito: match.perrito,
          usuario:
            match.perrito.usuario ?? { id: '', nombre: '', telefono: '', email: null },
          porcentaje_similitud: match.porcentaje_similitud,
        },
      });
    }

    return json({ ok: true, match: false, perritoId });
  } catch (error) {
    console.error('Error en /api/publicar-perrito:', error);
    // Limpieza de emergencia
    if (supabase && fotoSubida && fotoPath) {
      await supabase.storage.from(FOTOS_BUCKET).remove([fotoPath]).catch(() => {});
    }
    if (supabase && faceId) {
      await deleteFace(faceId).catch(() => {});
    }
    return json({ ok: false, error: 'Ocurrió un error interno. Por favor intenta de nuevo.' }, 500);
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Reutiliza el usuario existente (por email o teléfono) o crea uno nuevo. */
async function findOrCreateUsuario(
  supabase: SupabaseClient,
  input: PublicarInput,
): Promise<string> {
  let query = supabase.from('usuarios').select('id');
  if (input.email) query = query.eq('email', input.email);
  else query = query.eq('telefono', input.telefono);

  const { data: existing } = await query.maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from('usuarios')
    .insert({ nombre: input.nombre, email: input.email, telefono: input.telefono })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Insert en usuarios falló:', error);
    throw new Error('No se pudo registrar el usuario.');
  }
  return data.id;
}

/**
 * Busca coincidencias faciales ≥ 85 % con reportes ACTIVOS de rol opuesto.
 * Si encuentra una válida, registra el match en `matches_ia` y marca
 * ambos reportes como RECONCILIADO.
 */
async function buscarCoincidencias(
  supabase: SupabaseClient,
  input: PublicarInput,
  imageBytes: Buffer,
  perritoId: string,
): Promise<{ perrito: PerritoConUsuario; porcentaje_similitud: number } | null> {
  let faceMatches: FaceMatch[] = [];
  try {
    faceMatches = await searchFacesByImage(imageBytes, FACE_MATCH_THRESHOLD);
  } catch (error) {
    // La búsqueda falló, pero el reporte ya quedó guardado:
    // se devuelve éxito sin match (no bloquear la publicación).
    console.error('SearchFacesByImage falló:', error);
    return null;
  }

  // Excluir la cara recién indexada (el propio reporte) y sin ExternalImageId
  const candidates = faceMatches.filter((m) => m.ExternalImageId && m.ExternalImageId !== perritoId);
  if (candidates.length === 0) return null;

  const faceIds = candidates.map((m) => m.FaceId);
  const oppositeRol = input.rol === 'PERDIDO' ? 'BUSCA_DUEÑO' : 'PERDIDO';

  const { data: existing, error } = await supabase
    .from('perritos')
    .select('*, usuario:usuarios(id, nombre, telefono, email)')
    .in('aws_face_id', faceIds)
    .eq('rol_publicacion', oppositeRol)
    .eq('estado', 'ACTIVO')
    .limit(10);

  if (error || !existing || existing.length === 0) return null;

  const similarityByFace = new Map(candidates.map((m) => [m.FaceId, m.Similarity]));
  const similarityOf = (p: PerritoConUsuario) => similarityByFace.get(p.aws_face_id ?? '') ?? 0;
  const records = existing as PerritoConUsuario[];

  // Mejor coincidencia (mayor % de similitud)
  const best = [...records].sort((a, b) => similarityOf(b) - similarityOf(a))[0];
  const porcentaje = Math.round(similarityOf(best) * 100) / 100;

  const perdidoId = input.rol === 'PERDIDO' ? perritoId : best.id;
  const encontradoId = input.rol === 'PERDIDO' ? best.id : perritoId;

  // Registrar el match (ignora si el par ya existía: ON CONFLICT DO NOTHING)
  await supabase
    .from('matches_ia')
    .upsert(
      {
        perrito_perdido_id: perdidoId,
        perrito_encontrado_id: encontradoId,
        porcentaje_similitud: porcentaje,
      },
      {
        onConflict: 'perrito_perdido_id, perrito_encontrado_id',
        ignoreDuplicates: true,
      },
    );

  // Marcar ambos reportes como RECONCILIADO (desaparecen del feed activo)
  await supabase.from('perritos').update({ estado: 'RECONCILIADO' }).in('id', [perritoId, best.id]);

  return { perrito: best, porcentaje_similitud: porcentaje };
}

/** Limpieza cuando el reporte no se pudo guardar. */
async function limpiarRecursos(supabase: SupabaseClient, fotoPath: string, faceId: string | null) {
  await supabase.storage.from(FOTOS_BUCKET).remove([fotoPath]).catch(() => {});
  if (faceId) await deleteFace(faceId).catch(() => {});
}
