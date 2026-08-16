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
  /** 👀 ¿El dueño recibe avisos de testigos ("Vi esta mascota")? */
  avisos_habilitados: boolean;
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

/**
 * Autorizaciones de contacto de un match (privacidad).
 * Cada parte autoriza por separado compartir SUS propios datos:
 *  - dueno_autorizo: la persona del reporte PERDIDO compartió su contacto.
 *  - encontrador_autorizo: la persona del reporte BUSCA_DUEÑO compartió el suyo.
 */
export interface AutorizacionContacto {
  dueno_autorizo: boolean;
  encontrador_autorizo: boolean;
}

export type LadoAutorizacion = 'dueno' | 'encontrador';

/** Reporte de la contraparte cuando la IA encuentra una coincidencia. */
export interface MatchInfo {
  /** Id del par en `matches_ia` (para autorizar compartir contacto). */
  matchId: string;
  /** Publicación de la contraparte (sin contacto salvo autorización). */
  perrito: Perrito;
  /** Contacto de la contraparte: SOLO si ella autorizó compartirlo. */
  usuario: Pick<Usuario, 'id' | 'nombre' | 'telefono' | 'email'> | null;
  porcentaje_similitud: number;
  /** Estado de las autorizaciones de contacto de este par. */
  autorizacion?: AutorizacionContacto;
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
  match_id: string;
  contraparte_id: string;
  porcentaje_similitud: number;
  autorizacion: AutorizacionContacto;
}

/** Publicación del usuario + los matches que la IA encontró para ella. */
export interface PerritoConMatches extends Perrito {
  matches: MatchRef[];
  /** 👀 Avisos de testigos ("Vi esta mascota") resumidos para el dueño. */
  avisos: AvisoResumen[];
}

/** Autor de un mensaje del hilo de un aviso (👀 "Vi esta mascota"). */
export type AutorAviso = 'dueño' | 'avisador';

/** Un mensaje del hilo de aviso (lo que devuelven las API). */
export interface AvisoMensaje {
  id: string;
  autor: AutorAviso;
  contenido: string;
  leida: boolean;
  creado_en: string;
}

/** Resumen de un aviso para "Mis publicaciones" (lista del dueño). */
export interface AvisoResumen {
  aviso_id: string;
  creado_en: string;
  ultimo_mensaje: Pick<AvisoMensaje, 'autor' | 'contenido' | 'creado_en'> | null;
  noLeidas: number;
}

/** Resumen de un aviso para "Mis avisos" (lista del testigo: hilos que inició). */
export interface AvisoMioResumen {
  aviso_id: string;
  creado_en: string;
  perrito: {
    id: string;
    nombre_temporal: string | null;
    foto_url: string;
    rol_publicacion: RolPublicacion;
    especie: Especie;
    estado: string;
    departamento: string;
    ciudad: string;
  };
  ultimo_mensaje: Pick<AvisoMensaje, 'autor' | 'contenido' | 'creado_en'> | null;
  noLeidas: number;
}

export interface MisPublicacionesResponse {
  ok: boolean;
  perritos: PerritoConMatches[];
  error?: string;
}

export interface MisAvisosResponse {
  ok: boolean;
  avisos: AvisoMioResumen[];
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
  /** Autorizaciones de contacto del par (privacidad). */
  autorizacion?: AutorizacionContacto | null;
  /** Id del par en matches_ia (para autorizar compartir contacto). */
  match_id?: string | null;
  /** Contacto de la contraparte: SOLO si ella autorizó compartirlo. */
  contacto?: Pick<Usuario, 'id' | 'nombre' | 'telefono' | 'email'> | null;
  /** Publicación de la contraparte (a la que apunta el aviso). */
  perrito?: (Pick<
    Perrito,
    'id' | 'nombre_temporal' | 'descripcion' | 'foto_url' | 'rol_publicacion' | 'especie' | 'estado' | 'departamento' | 'ciudad' | 'usuario_id'
  >) | null;
  /** Tu propia publicación (para saber si eres el dueño o el rescatista). */
  mi_perrito?: Pick<Perrito, 'id' | 'nombre_temporal' | 'rol_publicacion' | 'especie' | 'estado'> | null;
}

export interface NotificacionesResponse {
  ok: boolean;
  notificaciones: Notificacion[];
  noLeidas: number;
  /** 👀 Avisos "Vi esta mascota" sin leer en tus publicaciones. */
  avisosNoLeidos?: number;
  /** 👀 Avisos sin leer que te llegaron como testigo (hilos que iniciaste). */
  avisosRecibidosNoLeidos?: number;
  error?: string;
}

/** Match resuelto con la publicación de la contraparte (para la página del detalle). */
export interface MatchedPublication {
  match_id: string;
  contraparte: Perrito;
  porcentaje_similitud: number;
  autorizacion: AutorizacionContacto;
}

/** Un mensaje del chat privado de un match. */
export interface Mensaje {
  id: string;
  conversacion_id: string;
  usuario_id: string;
  contenido: string;
  leida: boolean;
  creado_en: string;
  /** Lo marca el servidor al entregarlo: ¿lo escribió el usuario de la sesión? */
  es_mio?: boolean;
}

/** Contraparte de una conversación (solo datos públicos: NUNCA contacto). */
export interface ConversacionContraparte {
  perrito_id: string;
  nombre: string;
  foto_url: string;
  rol_publicacion: RolPublicacion;
  especie: Especie;
  estado: EstadoPerrito;
  porcentaje_similitud: number;
  /** ¿Puedo escribirle yo (la contraparte autorizó su contacto)? */
  habilitada: boolean;
}

/** Conversación del listado (/api/mensajes GET). */
export interface ConversacionUI {
  conversacion_id: string;
  match_id: string;
  contraparte: ConversacionContraparte;
  ultimo_mensaje:
    | (Pick<Mensaje, 'id' | 'contenido' | 'creado_en' | 'usuario_id'> & { es_mio?: boolean })
    | null;
  noLeidas: number;
}

export interface MensajesListResponse {
  ok: boolean;
  conversaciones: ConversacionUI[];
  noLeidasTotal: number;
  error?: string;
}

export interface HiloResponse {
  ok: boolean;
  conversacion: {
    conversacion_id: string;
    match_id: string;
    contraparte: ConversacionContraparte;
  };
  mensajes: Mensaje[];
  error?: string;
}
