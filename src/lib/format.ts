// ============================================================
// 🐾 Patitas SOS — Utilidades de formato
// ============================================================

/** Convierte un teléfono en enlace de WhatsApp (https://wa.me). */
export function whatsappLink(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}`;
}

/** Formatea una fecha ISO como texto amigable en español. */
export function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return 'ahora mismo';
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} día${days > 1 ? 's' : ''}`;

  return new Date(iso).toLocaleDateString('es');
}
