// ============================================================
// 🐾 Patitas SOS — Tipos compartidos
// ============================================================

export type RolPublicacion = 'PERDIDO' | 'BUSCA_DUEÑO';
export type EstadoPerrito = 'ACTIVO' | 'RECONCILIADO';

export interface Usuario {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string;
  creado_en: string;
}

export interface Perrito {
  id: string;
  usuario_id: string;
  rol_publicacion: RolPublicacion;
  nombre_temporal: string | null;
  descripcion: string;
  ciudad: string;
  barrio_zona: string | null;
  foto_url: string;
  aws_face_id: string | null;
  estado: EstadoPerrito;
  creado_en: string;
  /** Datos de contacto de quien publicó (join con la tabla usuarios). */
  usuario?: Pick<Usuario, 'id' | 'nombre' | 'telefono' | 'email'> | null;
}

/** Reporte de la contraparte cuando la IA encuentra una coincidencia. */
export interface MatchInfo {
  perrito: Perrito;
  usuario: Pick<Usuario, 'id' | 'nombre' | 'telefono' | 'email'>;
  porcentaje_similitud: number;
}

export interface PublicarResponse {
  ok: boolean;
  match?: boolean;
  perritoId?: string;
  matchInfo?: MatchInfo;
  error?: string;
}

export interface FeedResponse {
  perritos: Perrito[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  error?: string;
}
