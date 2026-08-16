// ============================================================
// 🐾 Patitas SOS — Tipos compartidos
// ============================================================

export type RolPublicacion = 'PERDIDO' | 'BUSCA_DUEÑO';
export type EstadoPerrito = 'ACTIVO' | 'ENCONTRADA' | 'RECONCILIADO';
/** Tipo de mascota del reporte (perro por defecto). */
export type Especie = 'perro' | 'gato';

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
  especie: Especie;
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

/** Referencia a un match de la IA: la publicación de la contraparte. */
export interface MatchRef {
  contraparte_id: string;
  porcentaje_similitud: number;
}

/** Publicación del usuario + los matches que la IA encontró para ella. */
export interface PerritoConMatches extends Perrito {
  matches: MatchRef[];
}

export interface MisPublicacionesResponse {
  ok: boolean;
  perritos: PerritoConMatches[];
  error?: string;
}

/** Notificación web (aparece cuando hay un match; no depende del correo). */
export interface Notificacion {
  id: string;
  usuario_id: string;
  perrito_id: string;
  mi_perrito_id: string;
  porcentaje_similitud: number | null;
  tipo: string;
  leida: boolean;
  creado_en: string;
  /** Publicación de la contraparte (a la que apunta el aviso). */
  perrito?: (Pick<
    Perrito,
    'id' | 'nombre_temporal' | 'descripcion' | 'foto_url' | 'rol_publicacion' | 'especie' | 'estado' | 'departamento' | 'ciudad'
  > & {
    usuario?: Pick<Usuario, 'id' | 'nombre' | 'telefono' | 'email'> | null;
  }) | null;
  /** Tu propia publicación (para saber si eres el dueño o el rescatista). */
  mi_perrito?: Pick<Perrito, 'id' | 'nombre_temporal' | 'rol_publicacion' | 'especie' | 'estado'> | null;
}

export interface NotificacionesResponse {
  ok: boolean;
  notificaciones: Notificacion[];
  noLeidas: number;
  error?: string;
}

/** Match resuelto con la publicación de la contraparte (para la página del detalle). */
export interface MatchedPublication {
  contraparte: Perrito;
  porcentaje_similitud: number;
}
