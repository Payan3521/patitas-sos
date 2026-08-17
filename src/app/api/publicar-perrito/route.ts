// ============================================================
// 🐾 PATITAS SOS — POST /api/publicar-perrito
//
// Flujo unificado (Dueño "PERDIDO" o Rescatista "BUSCA_DUEÑO"):
//   1. Recibe formulario + foto (multipart/form-data).
//   2. La foto ya llega comprimida ≤ 200 KB desde el cliente;
//      el servidor valida el tamaño por seguridad.
//   3. Sube la foto al bucket público 'fotos-perritos' (Supabase Storage).
//   4. Guarda el reporte en la tabla `perritos`.
//   5. Gemini Flash compara la foto contra los reportes ACTIVOS de rol
//      opuesto (misma ciudad → departamento → país, hasta 12).
//   6. Si hay match (es_mismo y similitud ≥ 80 %):
//      - Registra el par en `matches_ia` (SIN cambiar estados).
//      - Notifica por EMAIL a ambas partes (dueño + rescatista) con
//        enlace a la publicación y botón para marcar como encontrada.
//      - Inserta notificaciones WEB para ambas partes (tabla `notificaciones`).
//      - Devuelve `match: true` con los datos de contacto de la contraparte.
//   La publicación NUNCA falla por la IA: si Gemini no responde, el reporte
//   queda guardado igual y la revisión diaria lo cruzará después.
//
// IMPORTANTE: EXIGE SESIÓN iniciada (login propio: email + contraseña en
// cookie httpOnly). El email del formulario ya no existe: se toma de la
// sesión. Sin sesión válida se responde 401 y el reporte NO se publica.
//
// IMPORTANTE: la publicación NUNCA se elimina ni se reconcilia de forma
// automática. Solo el dueño (o el publicador verificado) puede marcarla
// como ENCONTRADA desde su página o desde el enlace del correo.
// ============================================================

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FOTOS_BUCKET, GEMINI_MAX_CANDIDATOS_PUBLICACION, MAX_IMAGE_BYTES } from '@/lib/constants';
import { buscarCoincidenciasPara } from '@/lib/matcher';
import { contactoVisible } from '@/lib/permisos';
import { leerSesion } from '@/lib/auth';
import { createServerSupabase } from '@/lib/supabase-server';
import { validatePublicarInput, type PublicarInput } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export async function POST(request: NextRequest) {
  let supabase: SupabaseClient | null = null;
  let perritoId = '';
  let fotoPath = '';
  let fotoSubida = false;

  try {
    // --- 0. Exigir sesión iniciada (login propio: email + contraseña) ---
    const sesion = leerSesion(request);
    if (!sesion?.email) {
      return json({ ok: false, error: 'Debes iniciar sesión para publicar un reporte.' }, 401);
    }
    const emailSesion = sesion.email.toLowerCase();

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
      return json({ ok: false, error: 'Sube una foto de la mascota.' }, 400);
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

    // --- 3. Reutilizar (o crear) el usuario ligado a la sesión ---
    const usuarioId = await findOrCreateUsuario(supabase, {
      nombre: input.nombre,
      telefono: input.telefono,
      email: emailSesion,
    });

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

    // --- 5. Guardar el reporte en `perritos` ---
    const { data: perritoNuevo, error: insertError } = await supabase
      .from('perritos')
      .insert({
        id: perritoId,
        usuario_id: usuarioId,
        rol_publicacion: input.rol,
        especie: input.especie,
        nombre_temporal: input.nombreTemporal,
        descripcion: input.descripcion,
        departamento: input.departamento,
        ciudad: input.ciudad,
        barrio_zona: input.barrioZona,
        foto_url: fotoUrl,
        estado: 'ACTIVO',
      })
      .select('*')
      .single();

    if (insertError || !perritoNuevo) {
      console.error('Insert en perritos falló:', insertError);
      await supabase.storage.from(FOTOS_BUCKET).remove([fotoPath]).catch(() => {});
      return json({ ok: false, error: 'No pudimos guardar el reporte. Intenta de nuevo.' }, 500);
    }

    // --- 6. Buscar coincidencias con Gemini Flash (en background) ---
    //     La publicación responde al instante: esperamos la IA SOLO hasta
    //     ~3 s (si la primera ronda alcanza, el modal de match sale en la
    //     misma respuesta); si no, sigue corriendo en segundo plano y el
    //     cliente hace polling a GET /api/matches-para (~90 s) mientras se
    //     comparan TODOS los candidatos del rol opuesto (hasta 300, ranking
    //     por cercanía). Si nada termina, el cron diario y las notificaciones
    //     web/correo lo cubren.
    //     El match NO toca los estados: solo registra el par y avisa.
    //     Si la IA falla, el reporte ya quedó publicado (match: false).
    const promesaMatch = buscarCoincidenciasPara(supabase, perritoId, {
      maxCandidatos: GEMINI_MAX_CANDIDATOS_PUBLICACION,
    });
    let match: Awaited<ReturnType<typeof buscarCoincidenciasPara>> = null;
    try {
      match = await Promise.race([
        promesaMatch,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3_000)),
      ]);
    } catch {
      match = null;
    }
    if (!match) {
      // Background: el trabajo sigue (descarga de fotos + Gemini) aunque la
      // request ya haya respondido; el polling del cliente lo recoge.
      void promesaMatch.catch((error) => console.error('Match en background falló:', error));
    }

    if (match) {
      // 🔒 Privacidad: el contacto de la contraparte solo viaja si ella
      // autorizó compartirlo (match recién creado → normalmente no).
      const autorizacion = match.autorizacion;
      const contactoVisibleContraparte = contactoVisible(true, match.perrito.rol_publicacion, autorizacion);

      return json({
        ok: true,
        match: true,
        perritoId,
        matchInfo: {
          matchId: match.matchId,
          // 🔒 El barrio es dato personal (Política): solo viaja si la
          // contraparte autorizó compartir su contacto (igual que `usuario`).
          perrito: {
            ...match.perrito,
            usuario: null,
            barrio_zona: contactoVisibleContraparte ? (match.perrito.barrio_zona ?? null) : null,
          },
          usuario: contactoVisibleContraparte ? (match.perrito.usuario ?? null) : null,
          porcentaje_similitud: match.porcentaje_similitud,
          autorizacion,
          notificacion: match.notificacion,
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
    return json({ ok: false, error: 'Ocurrió un error interno. Por favor intenta de nuevo.' }, 500);
  }
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

/** Reutiliza el usuario existente (por email) o crea uno nuevo. */
async function findOrCreateUsuario(
  supabase: SupabaseClient,
  input: { nombre: string; telefono: string; email: string },
): Promise<string> {
  const { data: existing } = await supabase
    .from('usuarios')
    .select('id')
    .eq('email', input.email)
    .maybeSingle();

  if (existing) {
    // Mantener actualizados nombre/teléfono
    const { error: updateError } = await supabase
      .from('usuarios')
      .update({ nombre: input.nombre, telefono: input.telefono })
      .eq('id', existing.id);
    if (updateError) console.error('Actualizar usuario falló:', updateError);
    return existing.id;
  }

  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      nombre: input.nombre,
      email: input.email,
      telefono: input.telefono,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('Insert en usuarios falló:', error);
    throw new Error('No se pudo registrar el usuario.');
  }
  return data.id;
}