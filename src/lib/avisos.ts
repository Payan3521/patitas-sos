// ============================================================
// 🐾 PATITAS SOS — 👀 Avisos de testigos ("Vi esta mascota")
//
// Cualquier persona CON CUENTA puede avisar al dueño de una
// publicación con un mensaje PREDEFINIDO (anti-spam: no hay texto
// libre para crear el aviso ni para la PRIMERA respuesta del
// dueño; después ambos escriben libre). Si el dueño responde, se
// abre un mini-chat en la app al que el testigo siempre puede
// volver desde "Mis avisos".
//
// Privacidad:
//   - Los avisos solo se leen y escriben con sesión iniciada
//     (testigo = autor del aviso, dueño = autor de la publicación).
//   - No hay datos de contacto de por medio: todo ocurre en el hilo.
//   - El dueño puede desactivar los avisos (botón 🔕, visible solo
//     para él): no llegan avisos nuevos y el testigo no puede
//     escribir más; el dueño sí puede leer y responder.
// ============================================================

/** Mensajes predefinidos del aviso inicial (el dueño NUNCA recibe texto libre para crear un hilo). */
export const MENSAJES_AVISO_PREDEFINIDOS = [
  '👀 La vi hace poco, pero no se dejó coger. ¡Anda rondando por esta zona!',
  '🐾 La vi por aquí y no pude atraparla. Les aviso si la vuelvo a ver.',
  '👀 Vi una mascota parecida a esta por la zona. Ojalá les sirva.',
  '🏃 No la pude alcanzar, corre mucho. ¡Sigan buscando por esta zona!',
  '🐕 La reconocí de pasada y no pude deternerme. ¡Mucha suerte encontrándola!',
] as const;

/**
 * Mensajes predefinidos de la PRIMERA respuesta del dueño (le da al testigo
 * una vía cómoda para seguir hablando sin presionarlo por datos de contacto;
 * después de eso el dueño escribe libre).
 */
export const MENSAJES_DUENO_PREDEFINIDOS = [
  '¡Hola! Gracias por avisar 🙂 ¡Creo que sí puede ser mi mascota! ¿Me cuentas más por aquí?',
  '¡Hola! Muchas gracias por tu aviso. ¿Todavía la viste por la zona?',
  'Hola, ¡qué alegría saber que la viste! Estamos muy preocupados, ¿podemos hablar por este chat?',
  'Hola, gracias por escribir. ¿Cómo era la mascota que viste?',
] as const;

export type MensajeAvisoPredefinido = (typeof MENSAJES_AVISO_PREDEFINIDOS)[number];
export type MensajeDuenoPredefinido = (typeof MENSAJES_DUENO_PREDEFINIDOS)[number];

/** Máx. avisos NUEVOS por publicación por día (anti-spam global). */
export const AVISOS_MAX_DIARIOS_POR_PUBLICACION = 5;

/** Longitud máxima de un mensaje del hilo (misma regla que el chat). */
export const MAX_MENSAJE_AVISO_LEN = 2000;