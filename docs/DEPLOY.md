# 🚀 Patitas SOS — Guía de despliegue (Vercel + Supabase)

> Guía completa, paso a paso, para llevar el proyecto a producción.
> Versión local/Docker: ver sección 5. Variables: ver sección 2.

---

## 0. Arquitectura: ¿qué se despliega y qué se configura?

| Componente | Qué es | ¿Se despliega? | ¿Se configura? |
|---|---|---|---|
| **Este repositorio** | Frontend + Backend (Next.js con API Routes: no hay servidor aparte) | ✅ **Sí — en Vercel** | — |
| **Supabase** | PostgreSQL + Storage + cron (pg_cron) — servicio cloud | ❌ No (es SaaS) | ✅ Aplicar migraciones SQL + bucket + cron |
| **Gemini (Google)** | IA que compara las fotos de las mascotas | ❌ No (es API externa) | ✅ Solo pegar la API key |
| **Brevo** | Correos de notificación de coincidencias | ❌ No (es API externa) | ✅ Solo pegar la API key |

**Resumen**: solo hay **un despliegue (Vercel)**. La "base de datos" es Supabase
Cloud: no se instala nada, solo se ejecutan unos scripts SQL y se crea un bucket.

---

## 1. Pre-requisitos (cuentas)

| Cuenta | Para qué | Dónde crearla |
|---|---|---|
| GitHub | Subir el repo para que Vercel lo importe | https://github.com |
| Vercel (el de la institución) | Deploy final | https://vercel.com (o el team de la U) |
| Supabase (el de la institución) | Base de datos + Storage + cron | https://supabase.com → New project |
| Google AI Studio | API key de Gemini | https://aistudio.google.com/apikey |
| Brevo | Correos de coincidencias (300/día gratis, para siempre) | https://brevo.com |

---

## 2. Variables de entorno (dónde obtener cada una)

Todas se pegan en **Vercel → Project → Settings → Environment Variables** (y en
`.env.local` para desarrollo local). La plantilla comentada vive en
`.env.local.example`.

| Variable | Obligatoria | Pública/Secreta | Cómo obtenerla |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Pública (viaja al navegador) | Supabase → 🛠️ **Project Settings → API → Project URL** (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Pública | ídem → **anon / public key**. Solo se usa para el *realtime* del chat (broadcast); los datos siempre viajan por API con sesión |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | 🔒 **Secreta (¡solo servidor!)** | ídem → **service_role key**. Si se filtra, cualquiera escribiría en la BD |
| `GEMINI_API_KEY` | ✅ | 🔒 Secreta | https://aistudio.google.com/apikey → **Create API key**. ⚠️ Para el modo "match de una" (Compara todos los candidatos) se recomienda un proyecto **con billing**: el free tier limita a ~5 llamadas/min (el escaneo completo de 100 candidatos tardaría ~20 min en vez de segundos) |
| `GEMINI_MODEL` | ❌ (default `gemini-3.5-flash`) | Secreta | Opcional: `gemini-3.1-flash-lite` es el más barato (ver `docs/costos.md`) |
| `MAIL_PROVIDER` | ✅ (default `brevo`) | Secreta | `brevo` o `resend` |
| `BREVO_API_KEY` | Si usas Brevo | 🔒 Secreta | Brevo → **SMTP & API → API Keys → Generate a new API key** (`xkeysib-…`) |
| `BREVO_FROM` | Si usas Brevo | Secreta | Brevo → **SMTP & API → Senders → Add a sender** y verifica el correo por clic; el valor debe coincidir **exactamente** (ej: `Patitas SOS <contacto@universidad.edu.co>`) |
| `RESEND_API_KEY` / `EMAIL_FROM` | Si usas Resend | 🔒 Secreta | https://resend.com → API Keys (requiere dominio verificado) |
| `APP_URL` | ✅ | Pública | La URL final del deploy: `https://<proyecto>.vercel.app` (o dominio propio). Se usa en los enlaces de los correos |
| `APP_TOKEN_SECRET` | ✅ | 🔒 Secreta | Generar: `openssl rand -hex 32`. Firma sesiones (login propio) y los enlaces "marcar como encontrada"/"compartir contacto" |
| `CRON_SECRET` | ✅ | 🔒 Secreta | Generar: `openssl rand -hex 32`. Protege `POST /api/revisar-coincidencias`; debe coincidir con el que se programa en pg_cron (paso 3) |

> 🔑 **Regla de oro**: todo lo que empiece con `NEXT_PUBLIC_` es visible en el
> navegador; cualquier secreto va SOLO en variables de servidor. Nunca subas
> `.env.local` al repositorio (`.gitignore` ya lo excluye).

---

## 3. Configurar Supabase (BD + Storage + cron)

> No se despliega nada: son pasos de configuración en el dashboard. IDEMPOTENTES:
> se pueden re-ejecutar sin romper nada.

### 3.1 Aplicar el esquema

- **Base NUEVA** (recomendado para el proyecto institucional):
  1. Supabase → **SQL Editor** → pega `supabase/schema.sql` completo → **Run**.
  2. Aplica en orden las migraciones **002 → 010** (todas idempotentes):
     ```
     002_mejoras-colombia.sql → 003_limpieza-total.sql → 004_login-propio.sql
     → 005_gemini-ia.sql → 006_especie.sql → 007_consentimiento.sql
     → 008_chat.sql → 009_avistamientos.sql → 010_avisos-con-cuenta.sql
     ```
     > ⚠️ `003` es un **RESET total** (borra todo): ejecútala solo si quieres
     > empezar limpio o tras re-ejecutar esquemas viejos. Para una base nueva
     > basta con ejecutar el **orden completo** como arriba (002→010) o, si
     > prefieres mínimo, solo `schema.sql` + 004→010.
- **Base ya existente** (la de tu Vercel de prueba): aplica solo las migraciones
  que le falten, en orden ascendente.

### 3.2 Crear el bucket de fotos

1. Supabase → **Storage → New bucket**.
2. Name: `fotos-perritos` · **Public bucket: sí** (5 MB, solo jpeg/png/webp).
3. La política de lectura pública ya la crea `schema.sql` (y si no, añade):
   ```sql
   create policy "fotos_perritos_lectura_publica" on storage.objects
     for select using (bucket_id = 'fotos-perritos');
   ```

### 3.3 Programar la revisión diaria (cron) — opcional pero recomendada

La revisión diaria re-cruza los reportes ACTIVOS contra los pares aún no
comparados (nada se pierde aunque se superen los 300 candidatos instantáneos).

**Opción A — Panel (recomendada, sin SQL):**
1. Supabase → **Settings → Integrations** → habilita **Cron** y **HTTP Request** (pg_cron + pg_net).
2. Dashboard → **Integrations → Cron → Create a new job**:
   - Schedule: `0 7 * * *` (7:00 a. m., hora del servidor)
   - HTTP Request (POST) → URL: `https://<TU-APP_URL>/api/revisar-coincidencias`
   - Headers: `{"content-type":"application/json","x-cron-secret":"<TU-CRON-SECRET>"}`

**Opción B — SQL Editor** (descomenta el bloque de la migración 005):
```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'patitas-revision-diaria',
  '0 7 * * *',
  $$
  select net.http_post(
    url := 'https://TU-APP_URL/api/revisar-coincidencias',
    headers := '{"content-type":"application/json","x-cron-secret":"TU-CRON-SECRET"}'::jsonb
  )
  $$
);
```
> ⚠️ Reemplaza `TU-APP_URL` y `TU-CRON-SECRET` por los reales. La respuesta
> esperada del job es: `{"ok":true,"reportesProcesados":N,"llamadasGemini":N,...}`.

---

## 4. Desplegar en Vercel

1. Sube el repo a **GitHub** (mantén limpio: `.gitignore` excluye `.env.local`).
2. En Vercel → **Add New → Project** → importa el repositorio (usa el **team de la institución**).
3. Configuración del proyecto:
   - **Framework Preset**: Next.js (lo detecta solo).
   - **Root Directory**: `/` (raíz).
   - **Build Command / Install Command**: dejar por defecto (`next build` / `npm install`).
   - **Environment Variables**: pega **todas** las de la sección 2.
4. **Deploy**. En 1-2 min está en `https://<proyecto>.vercel.app`.
5. (Opcional) **Dominio propio**: Project → Settings → Domains → añade
   `patitas.miuniversidad.edu.co`, y actualiza `APP_URL` si lo cambias.
6. ⚠️ Si cambias cualquier variable después, **re-deploya** (las `NEXT_PUBLIC_*`
   se incrustan en el build).

### Migrar desde un Vercel de prueba (el tuyo) al definitivo (el de la U)

No hay nada que "migrar" en el código: es el mismo repo.
1. Importa el repo en el **team de la U** (paso 4).
2. Copia las variables en el nuevo proyecto; cambia `APP_URL`.
3. Aplica el esquema en la **BD de la U** (sección 3.1) — o reutiliza la tuya
   (las migraciones son idempotentes) y solo cambia las `NEXT_PUBLIC_SUPABASE_URL`
   / `*_KEY` si apuntas a otra BD.
4. Programa el cron apuntando a la URL de la U (sección 3.3).
5. Re-deploya y pasa el checklist.

---

## 5. Checklist post-despliegue

- [ ] `https://<proyecto>.vercel.app` carga el feed.
- [ ] **Registro + login** propios funcionan (Regístrate → Cierra sesión → Inicia sesión).
- [ ] **Publicar** un reporte con foto: responde en ~3-4 s; si hay candidatos del
      rol opuesto de la misma especie, aparece el modal 🎉 (match) en ≤ ~90 s.
- [ ] **Brevo**: publica dos reportes que coincidan y llegan los 2 correos con
      enlaces firmados.
- [ ] **Consentimiento**: desde el correo, "Compartir mi información de contacto" →
      autorizar → la contraparte ya ve el teléfono.
- [ ] **Chat privado** entre las dos partes del match (bandeja + hilo).
- [ ] **Cron**: Supabase → *Settings → Integrations → Jobs → Run History* →
      ejecución con `ok: true`; o prueba manual:
      ```bash
      curl -X POST https://<proyecto>.vercel.app/api/revisar-coincidencias \
        -H "x-cron-secret: TU-CRON-SECRET"
      ```
- [ ] `docs/costos.md` leído: el modo instantáneo cuesta ~US$0,24 por publicación
      con ~100 candidatos (modelo 3.5 Flash).

---

## 6. Alternativa: Docker / VPS / Render

Si no se usa Vercel (ej. un VPS de la universidad):
1. Instala **Node 22** y **Docker** (o usa el Dockerfile multi-stage incluido).
2. Copia `.env.local.example` → `.env.local` con los valores de la sección 2.
3. Levanta:
   ```bash
   docker compose --env-file .env.local up --build -d
   ```
   (expone la app en `:3000`; healthcheck incluido).
4. `APP_URL` debe ser la URL pública final del servidor.

---

## 7. Solución de problemas rápidos

| Síntoma | Causa probable | Fix |
|---|---|---|
| 401 al publicar | Sin sesión | Iniciar sesión primero (el formulario exige cuenta) |
| 401 en el cron | `x-cron-secret` ≠ `CRON_SECRET` | Iguala ambos valores y re-programa el job |
| 503 en el cron | Falta `CRON_SECRET` en Vercel | Agrégala y re-deploya |
| La IA no compara ("match: false" siempre) | `GEMINI_API_KEY` inválida o free tier agotado | Verifica la key; la cuota diaria free se renueva a la 02:00 a. m. (hora Colombia) |
| Los correos no llegan | Remitente no verificado o `BREVO_FROM` distinto | Verifica el sender en Brevo y que coincida exacto |
| Las fotos no cargan | Bucket no público o sin política de lectura | Revisa sección 3.2 |