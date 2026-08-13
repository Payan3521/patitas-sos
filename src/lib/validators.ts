// ============================================================
// 🐾 Patitas SOS — Validación de los datos del formulario
// (se ejecuta en el servidor, dentro de /api/publicar-perrito)
// ============================================================

import type { RolPublicacion } from './types';

export interface PublicarInput {
  rol: RolPublicacion;
  nombre: string;
  telefono: string;
  email: string | null;
  nombreTemporal: string | null;
  descripcion: string;
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

export function validatePublicarInput(fd: FormData): Result<PublicarInput> {
  const rol = fd.get('rol');
  if (rol !== 'PERDIDO' && rol !== 'BUSCA_DUEÑO') {
    return fail('Selecciona una categoría válida: "Perdí a mi mascota" o "Encontré una mascota".');
  }

  const nombre = clean(fd.get('nombre'));
  if (nombre.length < 2 || nombre.length > 120) {
    return fail('Ingresa tu nombre (mínimo 2 caracteres).');
  }

  const telefono = clean(fd.get('telefono'));
  if (!/^[+\d][\d\s\-()]{6,19}$/.test(telefono)) {
    return fail('Ingresa un teléfono válido, con código de país si es posible.');
  }

  const emailRaw = clean(fd.get('email'));
  const email = emailRaw || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return fail('El correo electrónico no es válido.');
  }

  const nombreTemporal = clean(fd.get('nombre_temporal')) || null;
  if (nombreTemporal && nombreTemporal.length > 60) {
    return fail('El nombre temporal no puede superar los 60 caracteres.');
  }

  const descripcion = clean(fd.get('descripcion'));
  if (descripcion.length < 10 || descripcion.length > 1000) {
    return fail('Describe a la mascota (mínimo 10 caracteres).');
  }

  const ciudad = clean(fd.get('ciudad'));
  if (!ciudad || ciudad.length > 100) {
    return fail('Indica la ciudad donde se vio o se perdió.');
  }

  const barrioZona = clean(fd.get('barrio_zona')) || null;
  if (barrioZona && barrioZona.length > 120) {
    return fail('El barrio/zona no puede superar los 120 caracteres.');
  }

  return {
    ok: true,
    data: {
      rol: rol as RolPublicacion,
      nombre,
      telefono,
      email,
      nombreTemporal,
      descripcion,
      ciudad,
      barrioZona,
    },
  };
}
