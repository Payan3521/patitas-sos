# ✅ TODO — Patitas SOS

## Estado general
El proyecto está **funcional y completo** (v1.0.0): feed, publicación con IA
instantánea (hasta 300 candidatos), matches, consentimiento de contacto, chat,
avisos de testigos, notificaciones, login propio, cron diario, `npm run limpiar`
y **smoke de certificación automatizado** (`npm run smoke`).
Verificación `tsc` + build Docker + smokes en verde. **Certificado el 2026-08-17.**

## Hecho — Certificación del modo instantáneo (2026-08-17)
`node scripts/smoke-comparar-todos.mjs --candidatos=5` sobre BD limpia, app
Docker (build actual) y cuota free renovada. **TODO EN VERDE**:
- Publicación PERDIDO por HTTP real: **3,91 s** (máx 6 s) ✔
- Match por polling a `matches-para`: **6 s** ✔
- Match = candidato objetivo al **final del ranking** con **100 %** (≥ 80) ✔
- Escaneo completo 5/5 comparaciones ✔ · filtro de especie (2 gatos): 0 ✔
- Limpieza automática de datos y fotos ✔
- Commit `3ac5630` (script `smoke-comparar-todos.mjs` + 21 fotos de prueba +
  alias `npm run smoke` + este TODO actualizado).

**Hallazgo: el free tier limita a ~5 llamadas/min (RPM)** — con
`--candidatos=10` el lote paralelo (16) se atora: solo 4/10 comparaciones y
con 20 van 0/20 (429 en cadena). El escaneo grande (20-300 candidatos) solo
es viable con la key pagada → ver pendiente 3. El smoke con 5 candidatos sí
ejercita el flujo completo y los reintentos.

## Pendientes (en orden)

1. **Diseño del frontend (`design/`)**
   - Terminar las 12 pantallas HTML/CSS de **SOS PETS** (EAM, Armenia):
     hero + buscador, filtros con desplegables hover, cobertura nacional
     (32 departamentos), compartir (WhatsApp/correo/enlace), footer, etc.
   - **Adaptar el diseño al proyecto real**: transponer las pantallas
     aprobadas a las páginas Next.js (`src/app/*`) y componentes
     (`src/components/*`), conectándolas a las API existentes.
   - Marca renombrada a **SOS PETS** en todo el frontend.

2. **Credenciales y cuentas finales (lo toma el usuario)**
   - API key de **Gemini con billing** → nueva `GEMINI_API_KEY`.
   - Proyecto **Supabase** final: aplicar `schema.sql` + migraciones 002→010
     (idempotentes) + bucket `fotos-perritos` + cron diario.
   - Remitente verificado en **Brevo** (`BREVO_API_KEY`, `BREVO_FROM`).
   - Variables de entorno en el **Vercel** final (ver `docs/DEPLOY.md`).

3. **Smoke de velocidad con la key pagada**
   - `node scripts/smoke-comparar-todos.mjs --candidatos=40` (y opcional
     100): publicación < 6 s, match al final del ranking, escaneo completo
     y filtro de especie. Verifica que el lote paralelo (16) ya no se atora.

4. **Desplegar**
   - Subir a producción (Vercel de la U o Docker), cambiar `APP_URL` a la
     URL final y verificar con la prueba de humo del checklist (publicar un
     PERDIDO y un BUSCA_DUEÑO: llegan ambos correos, enlaces al dominio,
     solo el dueño puede marcar como encontrada).

## Opcionales / mejoras futuras
- **Rate limiting en login** (hoy documentado: sin límite de intentos).
- Reconsiderar `GEMINI_LOTE_PARALELO` (hoy 16) si la cuenta paga tiene RPM bajo.
- Entregabilidad Brevo si se superan 300 correos/día (ver `docs/costos.md`).