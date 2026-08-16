// ============================================================
// 🐾 PATITAS SOS — Textos según el tipo de mascota (perro / gato)
//
// Centraliza los sustantivos y emojis que cambian según la especie
// del reporte, para que correos, tarjetas y avisos digan "perrito"
// o "gatito" en lugar de frases fijas con "perro".
// ============================================================

export type Especie = 'perro' | 'gato';

export interface TextosEspecie {
  /** Sustantivo de la mascota, ej: "perrito". */
  mascota: string;
  /** Reporte perdido sin nombre, ej: "Mi perrito". */
  perdido: string;
  /** Reporte de rescatista sin nombre, ej: "Perrito rescatado". */
  rescatado: string;
  /** Contraparte perdida (genérico), ej: "mascota perdida". */
  perdida: string;
  /** Emoji de la especie. */
  emoji: string;
}

const TEXTOS: Record<Especie, TextosEspecie> = {
  perro: {
    mascota: 'perrito',
    perdido: 'Mi perrito',
    rescatado: 'Perrito rescatado',
    perdida: 'Mascota perdida',
    emoji: '🐶',
  },
  gato: {
    mascota: 'gatito',
    perdido: 'Mi gatito',
    rescatado: 'Gatito rescatado',
    perdida: 'Mascota perdida',
    emoji: '🐱',
  },
};

/** Normaliza el valor del campo `especie` (default: 'perro'). */
export function normalizarEspecie(especie?: string | null): Especie {
  return especie === 'gato' ? 'gato' : 'perro';
}

/** Textos según la especie del reporte (null/undefined → perro). */
export function textosEspecie(especie?: string | null): TextosEspecie {
  return TEXTOS[normalizarEspecie(especie)];
}