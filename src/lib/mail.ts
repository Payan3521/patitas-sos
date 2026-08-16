// ============================================================
// 🐾 PATITAS SOS — Correos de notificación de coincidencias
//
// Proveedor configurable con MAIL_PROVIDER:
//   - "brevo" (por defecto): API https://api.brevo.com/v3/smtp/email
//     (300 correos/día gratis, sin tarjeta, sin dominio propio: solo
//     hay que verificar el remitente por clic). Variables: BREVO_*.
//   - "resend": modo pruebas solo entrega al email de la cuenta;
//     para cualquier destinatario requiere dominio verificado.
//     Variables: RESEND_API_KEY, EMAIL_FROM.
// Comunes: APP_URL (enlaces de los correos), APP_TOKEN_SECRET (firma).
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import { textosEspecie } from './especie';
import type { NotificacionEstado, Perrito } from './types';

const MAIL_HEADER_STYLE =
  'background:linear-gradient(135deg,#f59e0b,#f97316,#f43f5e);padding:28px 32px;text-align:center;color:#fff';
const BUTTON_WHATSAPP =
  'display:inline-block;background:#25D366;color:#fff;text-decoration:none;font-weight:bold;padding:12px 24px;border-radius:999px;margin:4px';

export function appUrl(path = ''): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    process.env.APP_URL?.replace(/\/$/, '') ??
    'http://localhost:3000';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

// ----------------------------------------------------------------------------
// Firma "marcar como encontrada" (HMAC sin estado en BD)
// ----------------------------------------------------------------------------

function tokenSecret(): string {
  const secret = process.env.APP_TOKEN_SECRET;
  if (!secret) throw new Error('Falta la variable APP_TOKEN_SECRET.');
  return secret;
}

/** Firma que autoriza a marcar el reporte como ENCONTRADA (via email). */
export function tokenConfirmarEncontrada(perritoId: string): string {
  return createHmac('sha256', tokenSecret()).update(`encontrada:${perritoId}`).digest('hex');
}

/** Verifica de forma constante-en-tiempo una firma recibida. */
export function verificarTokenEncontrada(perritoId: string, token: string): boolean {
  try {
    const esperado = Buffer.from(tokenConfirmarEncontrada(perritoId), 'hex');
    const recibido = Buffer.from(token, 'hex');
    return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Envío vía API del proveedor configurado (Brevo por defecto | Resend)
// ----------------------------------------------------------------------------

interface EnvioResultado {
  ok: boolean;
  mensaje: string;
}

function mensajeErrorApi(proveedor: string, status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; code?: string };
    return parsed.message || `${proveedor} respondió ${status}`;
  } catch {
    return `${proveedor} respondió ${status}: ${body.slice(0, 120)}`;
  }
}

/** "Nombre <email>" → { name, email }; si viene solo el email, usa el nombre genérico. */
function parseSender(raw: string): { name: string; email: string } {
  const m = /^(.*?)\s*<([^>]+)>$/.exec(raw.trim());
  if (m) return { name: m[1].trim() || 'Patitas SOS', email: m[2].trim() };
  return { name: 'Patitas SOS', email: raw.trim() };
}

// --- Brevo (https://api.brevo.com/v3/smtp/email) ---

async function enviarConBrevo(to: string, subject: string, html: string): Promise<EnvioResultado> {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return { ok: false, mensaje: 'Falta la variable BREVO_API_KEY en el servidor.' };
  }
  const fromRaw = process.env.BREVO_FROM;
  if (!fromRaw) {
    return { ok: false, mensaje: 'Falta la variable BREVO_FROM (ej: Patitas SOS <tu-correo@verificado>).' };
  }
  const sender = parseSender(fromRaw);

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const mensaje = mensajeErrorApi('Brevo', res.status, body);
      console.error('Brevo respondió', res.status, body.slice(0, 300));
      return { ok: false, mensaje };
    }
    return { ok: true, mensaje: `Correo enviado a ${to} (Brevo)` };
  } catch (error) {
    console.error('Error de red con Brevo:', error);
    return { ok: false, mensaje: 'Error de red al contactar a Brevo.' };
  }
}

// --- Resend (https://api.resend.com/emails) ---

async function enviarConResend(to: string, subject: string, html: string): Promise<EnvioResultado> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, mensaje: 'Falta la variable RESEND_API_KEY en el servidor.' };
  }
  const from = parseSender(process.env.EMAIL_FROM ?? 'Patitas SOS <onboarding@resend.dev>');
  const fromRaw = `${from.name} <${from.email}>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromRaw, to, subject, html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const mensaje = mensajeErrorApi('Resend', res.status, body);
      console.error('Resend respondió', res.status, body.slice(0, 300));
      return { ok: false, mensaje };
    }
    return { ok: true, mensaje: `Correo enviado a ${to} (Resend)` };
  } catch (error) {
    console.error('Error de red con Resend:', error);
    return { ok: false, mensaje: 'Error de red al contactar a Resend.' };
  }
}

/** Despacha al proveedor configurado con MAIL_PROVIDER (default: brevo). */
async function enviarEmail(
  to: string,
  subject: string,
  html: string,
): Promise<EnvioResultado> {
  const proveedor = process.env.MAIL_PROVIDER?.trim().toLowerCase() || 'brevo';
  if (proveedor === 'resend') return enviarConResend(to, subject, html);
  return enviarConBrevo(to, subject, html);
}

// ----------------------------------------------------------------------------
// Plantillas
// ----------------------------------------------------------------------------

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function tarjetaPerrito(perrito: Perrito): string {
  const nombre =
    perrito.nombre_temporal ||
    textosEspecie(perrito.especie)[perrito.rol_publicacion === 'PERDIDO' ? 'perdido' : 'rescatado'];
  const zona = perrito.barrio_zona ? `, ${perrito.barrio_zona}` : '';
  // La foto se muestra con su URL pública (el bucket es público).
  const src = perrito.foto_url;
  return `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:14px 0">
      <tr>
        <td style="width:104px;vertical-align:top">
          <img src="${src}" alt="${escapar(nombre)}"
               style="width:96px;height:96px;object-fit:cover;border-radius:16px;border:1px solid #e5e5e5" />
        </td>
        <td style="vertical-align:top;padding-left:14px">
          <div style="font-weight:800;font-size:16px;color:#171717">${escapar(nombre)}</div>
          <div style="color:#525252;font-size:13px;margin-top:2px">📍 ${escapar(perrito.departamento)} · ${escapar(perrito.ciudad)}${escapar(zona)}</div>
          <div style="color:#737373;font-size:13px;margin-top:4px;line-height:1.4">${escapar(perrito.descripcion)}</div>
        </td>
      </tr>
    </table>`;
}

function botonesContacto(telefono: string): string {
  const wa = `https://wa.me/${telefono.replace(/\D/g, '')}`;
  return `
    <a href="${wa}" style="${BUTTON_WHATSAPP}">💬 Escribir por WhatsApp</a>
    <a href="tel:${telefono.replace(/\D/g, '')}"
       style="display:inline-block;border:2px solid #d4d4d4;color:#171717;text-decoration:none;font-weight:bold;padding:10px 22px;border-radius:999px;margin:4px">📞 Llamar ahora</a>`;
}

function layout(headerTitulo: string, headerTexto: string, cuerpo: string): string {
  return `
    <div style="margin:0;padding:24px 0;background:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
      <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:20px;overflow:hidden;border:1px solid #e5e5e5">
        <div style="${MAIL_HEADER_STYLE}">
          <div style="font-size:40px">🐾</div>
          <div style="font-size:22px;font-weight:900;letter-spacing:.5px">${headerTitulo}</div>
          <div style="opacity:.92;font-size:14px;margin-top:6px">${headerTexto}</div>
        </div>
        <div style="padding:24px 28px;color:#262626;font-size:15px;line-height:1.55">${cuerpo}</div>
        <div style="padding:16px 28px;border-top:1px solid #f0f0f0;text-align:center;color:#a3a3a3;font-size:12px">
          🐾 Patitas SOS — Conectamos mascotas perdidas con sus familias en Colombia
        </div>
      </div>
    </div>`;
}

// ----------------------------------------------------------------------------
// Notificación de match (dos correos: dueño + rescatista)
// ----------------------------------------------------------------------------

export interface MatchParaNotificar {
  perdido: Perrito;
  encontrado: Perrito;
  porcentajeSimilitud: number;
}

/**
 * Avisa a AMBAS partes cuando la IA encuentra una coincidencia:
 *  - Al dueño: alguien posiblemente encontró a su mascota (con enlace para
 *    verla y para marcarla como encontrada).
 *  - Al rescatista: un posible dueño apareció.
 * El resultado nunca debe bloquear la publicación: devuelve detalles del
 * envío por si la UI quiere mostrarlos.
 */
export async function notificarMatch({ perdido, encontrado, porcentajeSimilitud }: MatchParaNotificar): Promise<NotificacionEstado> {
  const emailDueño = perdido.usuario?.email ?? null;
  const emailRescatista = encontrado.usuario?.email ?? null;

  if (!emailDueño || !emailRescatista) {
    return {
      ok: false,
      enviados: 0,
      total: 2,
      detalle: 'Faltan los correos de una de las partes para notificar.',
    };
  }

  const textosPerdido = textosEspecie(perdido.especie);
  const textosEncontrado = textosEspecie(encontrado.especie);
  const nombrePerdido = perdido.nombre_temporal || `mi ${textosPerdido.mascota}`;
  const nombreEncontrado = encontrado.nombre_temporal || `un ${textosEncontrado.mascota} rescatado`;
  const linkEncontrado = appUrl(`/perrito/${encontrado.id}`);
  const token = tokenConfirmarEncontrada(perdido.id);
  const linkMarcar = appUrl(`/perrito/${perdido.id}?token=${token}`);
  const contactosRescatista = botonesContacto(encontrado.usuario?.telefono ?? '');
  const contactosDueño = botonesContacto(perdido.usuario?.telefono ?? '');

  // --- Correo al dueño ---
  const htmlDueño = layout(
    '¡Alguien posiblemente encontró a tu mascota!',
    `La IA encontró un ${
      porcentajeSimilitud.toFixed(1)
    }% de similitud facial con un reporte de ${textosEncontrado.mascota} encontrado.`,
    `
    <p>¡Hola <b>${escapar(perdido.usuario?.nombre ?? '')}</b>!</p>
    <p>Publicamos el reporte de <b>${escapar(nombrePerdido)}</b> y nuestra IA encontró
       un <b>${porcentajeSimilitud.toFixed(1)}%</b> de similitud con un ${textosEncontrado.mascota} que alguien
       reportó como encontrado. ¡Puede ser tu mascota! 🥹</p>
    <div style="text-align:center;margin:18px 0">
      <a href="${linkEncontrado}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:900;padding:14px 26px;border-radius:999px">🐾 Ver la mascota encontrada</a>
    </div>
    ${tarjetaPerrito(encontrado)}
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:14px 16px;margin-top:14px">
      <div style="font-weight:800;font-size:13px;color:#b45309;text-transform:uppercase;letter-spacing:.5px">
        Datos de quien la encontró
      </div>
      <div style="font-weight:700;color:#171717;margin-top:6px">${escapar(encontrado.usuario?.nombre ?? '')}</div>
      <div style="color:#525252;font-size:14px">📞 ${escapar(encontrado.usuario?.telefono ?? '')}</div>
      <div style="color:#525252;font-size:14px">✉️ ${escapar(encontrado.usuario?.email ?? '')}</div>
      <div style="margin-top:10px">${contactosRescatista}</div>
    </div>
    <div style="text-align:center;margin:22px 0 6px">
      <a href="${linkMarcar}" style="display:inline-block;background:#f59e0b;color:#fff;text-decoration:none;font-weight:900;padding:14px 26px;border-radius:999px">✅ Sí, ¡es mi mascota! Marcarla como encontrada</a>
      <div style="color:#a3a3a3;font-size:12px;margin-top:8px">Tu reporte queda activo hasta que confirmes tú.</div>
    </div>
  `,
  );

  // --- Correo al rescatista ---
  const htmlRescatista = layout(
    '¡Un posible dueño apareció! 🎉',
    `La IA encontró un ${
      porcentajeSimilitud.toFixed(1)
    }% de similitud facial con un reporte de ${textosPerdido.mascota} perdido.`,
    `
    <p>¡Hola <b>${escapar(encontrado.usuario?.nombre ?? '')}</b>!</p>
    <p>El ${textosEncontrado.mascota} que reportaste como encontrado (<b>${escapar(nombreEncontrado)}</b>) tiene
       un <b>${porcentajeSimilitud.toFixed(1)}%</b> de similitud con una mascota perdida
       que alguien está buscando. ¡Puede que hayas encontrado a su familia! ${textosEncontrado.emoji}💛</p>
    <div style="text-align:center;margin:18px 0">
      <a href="${appUrl(`/perrito/${perdido.id}`)}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:900;padding:14px 26px;border-radius:999px">🐾 Ver la mascota perdida</a>
    </div>
    ${tarjetaPerrito(perdido)}
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:14px;padding:14px 16px;margin-top:14px">
      <div style="font-weight:800;font-size:13px;color:#b45309;text-transform:uppercase;letter-spacing:.5px">
        Datos de la persona que la busca
      </div>
      <div style="font-weight:700;color:#171717;margin-top:6px">${escapar(perdido.usuario?.nombre ?? '')}</div>
      <div style="color:#525252;font-size:14px">📞 ${escapar(perdido.usuario?.telefono ?? '')}</div>
      <div style="color:#525252;font-size:14px">✉️ ${escapar(perdido.usuario?.email ?? '')}</div>
      <div style="margin-top:10px">${contactosDueño}</div>
    </div>
    <p style="font-size:13px;color:#737373;margin-top:18px">Si resulta ser la misma mascota, el dueño la
       marcará como encontrada y ambos reportes pasarán a la lista de encontradas. 💚</p>
  `,
  );

  const [dueñoOk, rescatistaOk] = await Promise.all([
    enviarEmail(
      emailDueño,
      `🐾 ¡Alguien posiblemente encontró a ${escapar(nombrePerdido)}!`,
      htmlDueño,
    ),
    enviarEmail(
      emailRescatista,
      `🐾 ¡Un posible dueño apareció para ${escapar(nombreEncontrado)}!`,
      htmlRescatista,
    ),
  ]);

  const fallos = [dueñoOk, rescatistaOk].filter((r) => !r.ok).map((r) => r.mensaje);
  const enviados = dueñoOk.ok && rescatistaOk.ok ? 2 : dueñoOk.ok || rescatistaOk.ok ? 1 : 0;

  return {
    ok: enviados === 2,
    enviados,
    total: 2,
    detalle:
      enviados === 2
        ? 'Correos de aviso enviados a ambas partes.'
        : enviados === 1
          ? `Solo se envió un correo: ${fallos.join(' | ')}`
          : `No se pudo enviar: ${fallos.join(' | ')}`,
  };
}