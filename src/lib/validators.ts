// ============================================================
// 🐾 PATITAS SOS — Validación de los datos del formulario
// (se ejecuta en el servidor, dentro de /api/publicar-perrito)
//
// El país de la plataforma es SOLO Colombia: los teléfonos se
// normalizan a +57XXXXXXXXXX y la ubicación usa departamento y
// municipio de la lista DANE.
// ============================================================

import type { Especie, RolPublicacion } from './types';

export interface PublicarInput {
  rol: RolPublicacion;
  especie: Especie;
  nombre: string;
  telefono: string;
  nombreTemporal: string | null;
  descripcion: string;
  departamento: string;
  ciudad: string;
  barrioZona: string | null;
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Limpia caracteres de control y recorta espacios. */
function clean(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

/**
 * Normaliza un teléfono colombiano a +57XXXXXXXXXX.
 * Acepta "3001234567", "+57 300 123 4567", "573001234567", etc.
 * Solo se permiten móviles (10 dígitos que inician con 3).
 */
export function normalizarTelefonoColombia(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let local = digits;
  if (local.startsWith('57')) local = local.slice(2);
  if (local.length === 11 && local.startsWith('0')) local = local.slice(1);

  if (local.length !== 10 || !/^3\d{9}$/.test(local)) return null;
  return `+57${local}`;
}

export function validatePublicarInput(fd: FormData): Result<PublicarInput> {
  const rol = fd.get('rol');
  if (rol !== 'PERDIDO' && rol !== 'BUSCA_DUEÑO') {
    return fail('Selecciona una categoría válida: "Perdí a mi mascota" o "Encontré una mascota".');
  }

  const especie = clean(fd.get('especie')) || 'perro';
  if (especie !== 'perro' && especie !== 'gato') {
    return fail('Selecciona un tipo de mascota válido (perro o gato).');
  }

  const nombre = clean(fd.get('nombre'));
  if (nombre.length < 2 || nombre.length > 120) {
    return fail('Ingresa tu nombre (mínimo 2 caracteres).');
  }

  const telefono = normalizarTelefonoColombia(clean(fd.get('telefono')));
  if (!telefono) {
    return fail('Ingresa un teléfono móvil colombiano válido (Ej: 300 123 4567).');
  }

  const emailRaw = clean(fd.get('email'));
  if (emailRaw && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) || emailRaw.length > 254)) {
    return fail('El correo electrónico no es válido.');
  }
  // El email ya no viene del formulario: se toma de la sesión del usuario.

  const departamento = clean(fd.get('departamento'));
  if (!departamento || departamento.length > 100) {
    return fail('Selecciona el departamento donde se vio o se perdió.');
  }

  const ciudad = clean(fd.get('ciudad'));
  if (!ciudad || ciudad.length > 120) {
    return fail('Selecciona el municipio donde se vio o se perdió.');
  }

  const nombreTemporal = clean(fd.get('nombre_temporal')) || null;
  if (nombreTemporal && nombreTemporal.length > 60) {
    return fail('El nombre temporal no puede superar los 60 caracteres.');
  }

  const descripcion = clean(fd.get('descripcion'));
  if (descripcion.length < 10 || descripcion.length > 1000) {
    return fail('Describe a la mascota (mínimo 10 caracteres).');
  }

  const barrioZona = clean(fd.get('barrio_zona')) || null;
  if (barrioZona && barrioZona.length > 120) {
    return fail('La dirección/barrio no puede superar los 120 caracteres.');
  }

  return {
    ok: true,
    data: {
      rol: rol as RolPublicacion,
      especie: especie as Especie,
      nombre,
      telefono,
      nombreTemporal,
      descripcion,
      departamento,
      ciudad,
      barrioZona,
    },
  };
}