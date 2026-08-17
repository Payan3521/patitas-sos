# ✅ TODO — Patitas SOS

## Estado general
El proyecto está **funcional y completo** (v1.0.0): feed, publicación con IA
instantánea (hasta 300 candidatos), matches, consentimiento de contacto, chat,
avisos de testigos, notificaciones, login propio, cron diario, `npm run limpiar`
y **smoke de certificación automatizado** (`npm run smoke`).
Verificación `tsc` + build Docker + smokes en verde.

## Hecho 2026-08-17 — Certificación del modo instantáneo (verificación nocturna)
`node scripts/smoke-comparar-todos.mjs --candidatos=5` sobre BD limpia, app
Docker (build actual) y cuota free renovada. **TODO EN VERDE**:
- Publicación PERDIDO por HTTP real: **3,91 s** (máx 6 s) ✔
- Match por polling a `matches-para`: **6 s** ✔
- Match = candidato objetivo al **final del ranking** con **100 %** (≥ 80) ✔
- Escaneo completo 5/5 comparaciones ✔ · filtro de especie (2 gatos): 0 ✔
- Limpieza automática de datos y fotos ✔

**Hallazgo: el free tier limita a ~5 llamadas/min (RPM)** — con
`--candidatos=10` el lote paralelo (16) se atora: solo 4/10 comparaciones y
con 20 van 0/20 (429 en cadena). El escaneo grande (20-300 candidatos) solo
es viable con la key pagada → pasa al apartado 2. El smoke con 5 candidatos
sí ejercita el flujo completo y los reintentos.

## Pendientes (en orden)

1. **Cuenta institucional de la universidad**
   - Crear proyecto Gemini **con billing** → nueva `GEMINI_API_KEY`.
   - Crear proyecto Supabase de la U (o reutilizar) y aplicar `schema.sql` +
     migraciones 002→010 (idempotentes) + bucket `fotos-perritos` + cron.
   - Crear/verificar remitente Brevo de la U.
   - Desplegar en el **Vercel de la U** (el repositorio es el mismo; solo copiar
     variables y cambiar `APP_URL`). Guía completa en `docs/DEPLOY.md`.

2. **Smoke de velocidad con la key pagada**
   - Re-correr el smoke con 20/40/100 candidatos (el lote paralelo de 16 ya
     no se atora): `node scripts/smoke-comparar-todos.mjs --candidatos=40`
     (publicación < 6 s, match al final del ranking, escaneo completo y
     filtro de especie).

## Opcionales / mejoras futuras
- **Rate limiting en login** (hoy documentado: sin límite de intentos).
- Reconsiderar `GEMINI_LOTE_PARALELO` (hoy 16) si la cuenta paga tiene RPM bajo.
- Entregabilidad Brevo si se superan 300 correos/día (ver `docs/costos.md`).