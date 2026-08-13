// ============================================================
// 🐾 Patitas SOS — Tipos compartidos
// ============================================================

export type RolPublicacion = 'PERDIDO' | 'BUSCA_DUEÑO';
export type EstadoPerrito = 'ACTIVO' | 'ENCONTRADA' | 'RECONCILIADO';

export type CategoriaFeed = 'todos' | 'buscadas' | 'buscan-dueno' | 'encontradas';

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
  departamento: string;
  ciudad: string;
  barrio_zona: string | null;
  foto_url: string;
  aws_face_id: string | null;
  estado: EstadoPerrito;
  creado_en: string;
  /** Datos de contacto de quien publicó (join con la tabla usuarios). */
  usuario?: Pick<Usuario, 'id' | 'nombre' | 'telefono' | 'email'> | null;
}

/** Estado del envío de los correos de aviso tras un match. */
export interface NotificacionEstado {
  ok: boolean;
  enviados: number;
  total: number;
  detalle: string;
}

/** Reporte de la contraparte cuando la IA encuentra una coincidencia. */
export interface MatchInfo {
  perrito: Perrito;
  usuario: Pick<Usuario, 'id' | 'nombre' | 'telefono' | 'email'>;
  porcentaje_similitud: number;
  /** Cómo terminó el envío de los correos de aviso (dueño + rescatista). */
  notificacion?: NotificacionEstado;
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
