# 🐾 Patitas SOS

**Plataforma colombiana** que conecta a las personas que perdieron a sus mascotas con quienes las
encontraron o rescataron. Usa **Gemini Flash (IA de Google)** para comparar las fotos de las mascotas
al momento de publicar y en una **revisión diaria automática**, **avisa por correo (Brevo)** a ambas
partes cuando hay una coincidencia y el dueño decide cuándo marcar la mascota como **encontrada**.
Tus datos de contacto son **privados**: solo se intercambian entre las dos partes de una
coincidencia cuando **tú lo autorizas expresamente** (consentimiento registrado, ver
[🔓 Consentimiento para compartir contacto](#-consentimiento-para-compartir-contacto)).

Aplicación **monolítica** (Frontend + API Routes en un solo proyecto Next.js), diseñada
mobile-first porque la gente estará en la calle buscando desde su teléfono, y lista para
desplegar en minutos con Docker.

---

## 🏗️ Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend + Backend | **Next.js 15** (App Router) + TypeScript |
| Estilos | **Tailwind CSS 4** (mobile-first) |
| Base de datos | **Supabase** (PostgreSQL) |
| Autenticación | **Login propio** — email + contraseña (hash scrypt, cookie httpOnly, sin rate limiting) |
| Almacenamiento | **Supabase Storage** (bucket público `fotos-perritos`) |
| IA (reconocimiento de mascotas) | **Gemini** (Google GenAI SDK, **Interactions API** — `gemini-3.5-flash`, configurable por env; compara fotos en vez de "caras") |
| Notificaciones por correo | **Brevo** (API HTTP — 300 correos/día gratis, sin dominio; alternativa: Resend) |
| Despliegue | **Docker** (multi-stage + docker-compose) |

---

## 📁 Estructura del proyecto

```
├── Dockerfile                     # Multi-stage: compila y genera salida standalone
├── docker-compose.yml             # Expone la app en :3000 e inyecta las variables
├── .dockerignore                  # Excluye .env.local y node_modules de la imagen
├── package.json                   # Next.js 15, React 19, @supabase/supabase-js, @google/genai
├── next.config.mjs                # Configuración de Next.js
├── tsconfig.json                  # TypeScript
├── postcss.config.mjs             # Tailwind CSS 4
├── .env.local.example             # Plantilla de variables (nunca se sube .env.local)
├── scripts/
│   └── limpiar.mjs                 # 🧹 Reset total: borra datos + fotos (npm run limpiar)
├── public/
│   └── robots.txt
├── supabase/
│   ├── schema.sql                 # Script SQL completo → para bases NUEVAS
│   └── migrations/
│       ├── 002_mejoras-colombia.sql    # Migra bases viejas: ENCONTRADA, departamento, notificados
│       ├── 003_limpieza-total.sql      # RESET total: borra todo y recrea el esquema
│       ├── 004_login-propio.sql        # Login propio: columna usuarios.password_hash
│       ├── 005_gemini-ia.sql           # IA Gemini: tabla comparaciones + razon + cron diario
│       ├── 006_especie.sql             # Campo especie (perro/gato) en perritos — para bases EXISTENTES
│       ├── 007_consentimiento.sql      # 🔓 Consentimiento: banderas de autorización en matches_ia
│       ├── 008_chat.sql                # 💬 Chat: tablas conversaciones + mensajes
    │       ├── 009_avistamientos.sql       # 👀 Avisos de testigos: avistamientos + mensajes_aviso
    │       └── 010_avisos-con-cuenta.sql   # 👀 Cuenta obligatoria: usuario_id + leida_avisador
    └── src/
    ├── app/
    │   ├── layout.tsx             # Layout raíz (metadatos, AuthProvider)
    │   ├── globals.css            # Estilos globales (Tailwind)
    │   ├── page.tsx               # Home / Feed (categorías + scroll infinito + filtros)
    │   ├── iniciar-sesion/
    │   │   └── page.tsx           # 🔐 Login propio: email + contraseña
    │   ├── registrarse/
    │   │   └── page.tsx           # 📝 Registro gratis (teléfono + email + contraseña)
    │   ├── mis-publicaciones/
    │   │   └── page.tsx           # 📋 Mis reportes + coincidencias de la IA (solo sesión)
    │   ├── mis-avisos/
    │   │   └── page.tsx           # 👀 Hilos "Vi esta mascota" que inicié (solo sesión)
    │   ├── notificaciones/
    │   │   └── page.tsx           # 🔔 Avisos web de matches (leída/no leída)
    │   ├── compartir-contacto/
    │   │   ├── page.tsx           # 🔓 Consentimiento: verifica sesión/token y muestra resumen
    │   │   └── FormularioPermiso.tsx  # Checkbox de aceptación + botón de autorizar (cliente)
    │   ├── politica-de-privacidad/
    │   │   └── page.tsx           # 🧾 Política de Privacidad pública
    │   ├── chat/
    │   │   ├── page.tsx           # 💬 Bandeja de conversaciones (badge de no leídas)
    │   │   ├── abrir/page.tsx     # 💬 Crea la conversación de un match (valida regla)
    │   │   └── [id]/page.tsx      # Hilo con burbujas + realtime (ping → recarga por API)
    │   ├── aviso/
    │   │   └── [id]/page.tsx      # 👀 Mini-chat del aviso: testigo o dueño (siempre con sesión)
    │   ├── publicar/
    │   │   └── page.tsx           # Formulario de registro (Dueño / Rescatista)
    │   ├── perrito/
    │   │   └── [id]/page.tsx      # Detalle (server component) + "marcar como encontrada"
    │   └── api/
    │       ├── publicar-perrito/route.ts          # POST: exige sesión, flujo completo + matching IA
    │       ├── revisar-coincidencias/route.ts     # POST: revisión diaria automática (cron protegido)
    │       ├── login/route.ts                     # POST: email + contraseña → cookie de sesión
    │       ├── registro/route.ts                  # POST: crear cuenta / reclamar cuenta existente
    │       ├── logout/route.ts                    # POST: borra la cookie de sesión
    │       ├── yo/route.ts                        # GET: sesión actual (para restaurarla al cargar)
    │       ├── mis-publicaciones/route.ts         # GET: mis reportes con sus matches (cookie)
    │       ├── notificaciones/route.ts            # GET/POST: notificaciones web (cookie)
    │       ├── consentimientos/route.ts            # POST: registrar autorización de compartir contacto
    │       ├── mensajes/route.ts                  # GET: bandeja + noLeidasTotal; POST: enviar mensaje
    │       ├── mensajes/abrir/route.ts            # POST: crear/reusar conversación (valida regla)
    │       ├── mensajes/[id]/route.ts             # GET: hilo (es_mio); POST: marcar leídas
    │       ├── avistamientos/route.ts             # POST: crear aviso "Vi esta mascota" (exige sesión, anti-spam)
    │       ├── avistamientos/[id]/route.ts        # GET: hilo del aviso; POST: mensaje (1er mensaje del dueño = preset)
    │       ├── mis-avisos/route.ts                # GET: hilos "Vi esta mascota" que INICIÉ (solo sesión)
    │       ├── perritos/route.ts                  # GET: feed paginado y filtrado
    │       ├── perritos/[id]/route.ts             # GET: detalle de un reporte
    │       ├── perritos/[id]/avisos/route.ts      # POST: activar/desactivar avisos (botón 🔕 del dueño)
    │       └── perritos/[id]/marcar-encontrada/   # POST: validar identidad (sesión/token del correo)
    ├── components/
    │   ├── AuthProvider.tsx       # 🔐 Sesión propia en el navegador (useAuth, cookie httpOnly)
    │   ├── Header.tsx             # Encabezado sticky con sesión + campana 🔔, chat 💬 y "Mis avisos" 👀 con badges
    │   ├── PetCard.tsx            # Tarjeta del feed (imagen, categoría, WhatsApp)
    │   ├── FilterBar.tsx          # Filtros por categoría, departamento → municipio y barrio
    │   ├── PublicarForm.tsx       # Formulario con pestañas + compresión de foto en canvas
    │   ├── MatchModal.tsx         # Modal gigante que "congela" la pantalla al detectar match
    │   ├── AvisoAvisar.tsx        # 👀 "¿Viste esta mascota?" (exige cuenta; mensajes predefinidos)
    │   └── PerritoDetalle.tsx     # Detalle: contacto, WhatsApp, match privado, marcar encontrada
    └── lib/
        ├── auth.ts               # 🔐 Hash scrypt + token de sesión HMAC (cookie httpOnly)
        ├── supabase-server.ts     # Cliente service role key — SOLO API Routes / Server Components
        ├── supabase-client.ts     # Cliente anon key del navegador — SOLO realtime (broadcast)
        ├── chat.ts                # 💬 Regla de habilitación, participantes, conversación y ping realtime
        ├── avisos.ts              # 👀 Presets del testigo y del 1er mensaje del dueño + límites anti-spam
        ├── gemini.ts              # Gemini Flash: compara 2 fotos de mascotas → {es_mismo, similitud, razon}
        ├── matcher.ts             # Motor de coincidencias: candidatos + umbral + matches_ia + avisos
        ├── mail.ts                # Correos Brevo/Resend (API HTTP) + firmas HMAC ("encontrada", consentimiento)
        ├── permisos.ts            # Lados del match, banderas de autorización y correspondencia de correos
        ├── colombia.ts            # 33 departamentos y 1122 municipios (datos DANE, sin red)
        ├── validators.ts          # Validación del formulario y normalización +57 del teléfono
        ├── constants.ts           # Límites de negocio (200 KB, umbral 80 %, candidatos, cron…)
        ├── format.ts              # Formato: tiempo relativo, enlaces de WhatsApp
        ├── image-utils.ts         # Compresión con <canvas> hasta ≤ 200 KB
        └── types.ts               # Tipos compartidos (Perrito, Usuario, Match, Notificacion…)
```

---

## 🔐 Variables de entorno

Copia `.env.local.example` → `.env.local` y completa los valores:

| Variable | Uso | Obligatoria |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase (se incrusta en el frontend) | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave pública del navegador (Settings → API). **Solo** para el chat en tiempo real (canales de broadcast; ningún dato viaja por ahí). Sin ella el chat funciona sin el "ping" instantáneo | ⚠️ chat |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave maestra. **Solo se usa en las API Routes** (nunca en el navegador) | ✅ |
| `GEMINI_API_KEY` | API key de Google AI Studio (https://aistudio.google.com/apikey) — IA de coincidencias | ✅ IA |
| `GEMINI_MODEL` | Modelo Gemini (default `gemini-3.5-flash`, mejor calidad/precio de los 3.x con visión; `gemini-3.1-flash-lite` es el más barato — ver [💰 Costos](#-costos-y-factura-mensual-2026)) | ⚠️ IA |
| `MAIL_PROVIDER` | Proveedor de correo: `brevo` (default) o `resend` | ⚠️ correos |
| `BREVO_API_KEY` | API key de Brevo (SMTP & API → API Keys; 300 correos/día gratis, sin tarjeta) | ⚠️ correos |
| `BREVO_FROM` | Remitente verificado en Brevo (SMTP & API → Senders), ej: `Patitas SOS <tucorreo@gmail.com>` | ⚠️ correos |
| `RESEND_API_KEY` | Solo si `MAIL_PROVIDER=resend` (alternativa que requiere dominio) | ⚠️ correos |
| `EMAIL_FROM` | Solo si `MAIL_PROVIDER=resend` (ej: `Patitas SOS <no-reply@tudominio.co>`) | ⚠️ correos |
| `APP_URL` | URL pública de la app para los enlaces de los correos | ⚠️ correos |
| `APP_TOKEN_SECRET` | Secreto para firmar las **sesiones** y el enlace "marcar como encontrada" (`openssl rand -hex 32`) | ⚠️ sesión + correos |
| `CRON_SECRET` | Secreto que protege `POST /api/revisar-coincidencias` (revisión diaria; pégalo también en pg_cron, migración 005) | ⚠️ cron |

> ⚠️ **IA**: sin `GEMINI_API_KEY` los reportes se publican igual, pero la IA no busca coincidencias
> (ni en el instante ni en la revisión diaria). **Correos**: sin `MAIL_PROVIDER=brevo` + `BREVO_API_KEY` +
> `BREVO_FROM`, `APP_URL` y `APP_TOKEN_SECRET` la plataforma funciona completa **excepto** las
> notificaciones por correo (ver [📬 Notificaciones por correo (Brevo)](#-notificaciones-por-correo-brevo)).

---

## 🗄️ 1. Configurar Supabase

### Base nueva

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor**, pega el contenido de `supabase/schema.sql` y ejecútalo.
   Crea las tablas `usuarios`, `perritos`, `matches_ia` y `notificaciones`, los ENUMs,
   índices y las políticas RLS.
3. Crea el bucket público: **Storage → New bucket → name: `fotos-perritos` → marcar "Public bucket" → Create**.
4. Copia la URL y la **service role key** desde **Settings → API** a tu `.env.local`.
5. **Login (opcional)**: el inicio de sesión es propio (email + contraseña) y no
   necesita Supabase Auth. Si la base es vieja, ejecuta también
   `supabase/migrations/004_login-propio.sql` para añadir la columna `password_hash`.

### Base ya existente (esquema anterior)

Ejecuta en el **SQL Editor** el script `supabase/migrations/002_mejoras-colombia.sql`,
que agrega:

- El estado `ENCONTRADA` al ENUM de `perritos` (los `RECONCILIADO` viejos pasan a `ENCONTRADA`).
- La columna `perritos.departamento` (filtros por departamento + municipio).
- `matches_ia.notificados` (evita reenviar correos del mismo par).
- Índices y la política RLS actualizada (lee `ACTIVO` y `ENCONTRADA`).

Si la base ya existe, ejecuta también `supabase/migrations/005_gemini-ia.sql`:
crea la tabla `comparaciones` (historial de pares analizados por la IA), agrega
`matches_ia.razon` (la explicación de Gemini) e incluye la programación del
**cron diario** de revisión. Enlas bases nuevas, `schema.sql` ya incluye todo.

Si además quieres el campo **tipo de mascota** (`perro`/`gato`, para textos y
emojis correctos en tarjetas, correos y avisos), ejecuta también
`supabase/migrations/006_especie.sql` (añade la columna con default `perro`).

Si quieres el **consentimiento de compartir contacto** (banderas
`dueno_autorizo`/`encontrador_autorizo`, `autorizaciones_json` versión de la
política y `contacto_*_enviado` en `matches_ia`), ejecuta también
`supabase/migrations/007_consentimiento.sql`. En bases nuevas, `schema.sql` ya
incluye todo.

> ⚠️ `perritos.departamento` queda vacío (`''`) en los reportes viejos; se completa
> re-publicando el reporte o por SQL manual.

> Las escrituras se hacen siempre desde el servidor con la `service role key` (salta la RLS).
> La RLS solo blinda el acceso directo y permite leer el feed de reportes ACTIVOS y ENCONTRADA.

### Empezar desde cero (limpieza total)

**La forma más fácil (recomendada)**: un solo comando local borra **todo** — filas
de las **10 tablas** (`mensajes_aviso`, `avistamientos`, `mensajes`,
`conversaciones`, `consentimientos`, `comparaciones`, `matches_ia`,
`notificaciones`, `perritos`, `usuarios`) **y** todos los archivos del bucket
`fotos-perritos`:

```bash
npm run limpiar
```

(Usa `SUPABASE_SERVICE_ROLE_KEY` y `NEXT_PUBLIC_SUPABASE_URL` de tu `.env.local`;
no imprime ningún secreto y verifica al final que todo quedó en 0.)

Alternativa vía SQL para **borrar todos los datos y volver a probar desde cero** (reportes, matches
y esquema viejo), ejecuta en el SQL Editor:

```
supabase/migrations/003_limpieza-total.sql
```

El script es **autocontenido** para la base: elimina tablas/enums/políticas y
recrea el esquema base. Al final muestra la verificación (0 filas en las tablas +
el enum con 3 valores).

> ⚠️ **Tras el 003 (reset por SQL)**: re-ejecuta las migraciones al día, en este
> orden y todas son idempotentes: `004_login-propio.sql` (password_hash) →
> `005_gemini-ia.sql` (comparaciones + razon + cron) → `006_especie.sql` →
> `007_consentimiento.sql` → `008_chat.sql` → `009_avistamientos.sql`.
> (`npm run limpiar` no requiere nada
> de eso: las tablas ya existen en la base).

> ℹ️ **Las fotos del bucket NO se borran desde SQL**: Supabase bloquea el borrado
> directo de `storage.objects` y el `ALTER` de su tabla desde el SQL Editor
> (errores 42501). El bucket `fotos-perritos` se vacía con la **Storage API**
> (borrar y recrear deja la misma configuración: público, 5 MB, jpeg/png/webp):
>
> ```bash
> curl -X DELETE -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
>   https://TU_PROYECTO.supabase.co/storage/v1/bucket/fotos-perritos
> curl -X POST -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
>   -H "Content-Type: application/json" \
>   -d '{"id":"fotos-perritos","name":"fotos-perritos","public":true}' \
>   https://TU_PROYECTO.supabase.co/storage/v1/bucket
> ```
>
> Si el bucket tiene objetos, bórralos primero con
> `DELETE /storage/v1/object/fotos-perritos/<ruta>` (uno por uno).

> ℹ️ **El historial de comparaciones de la IA** (tabla `comparaciones`) no se borra desde el bucket:
> limpia solo las filas de reportes eliminados cuando quieras empezar de cero.

---

## 🤖 2. Configurar la IA (Gemini)

1. Crear la **API key** (gratis, sin tarjeta): https://aistudio.google.com/apikey →
   **Create API key** → copia la key (formato `AIza...` o `AQ...`).
2. Anota en `.env.local`:
   ```bash
   GEMINI_API_KEY=AIza...
   GEMINI_MODEL=gemini-3.5-flash   # default; ver nota sobre modelos abajo
   ```
   > ⚠️ **Sobre los modelos (2026)**: con llaves/cuentas nuevas, los `gemini-2.x` ya
   > **no están disponibles** (`no longer available to new users`) y los `3.x` solo se
   > sirven por la **Interactions API** — la app ya usa esa API (no `generateContent`).
   > `gemini-3.5-flash` es el default (mejor equilibrio calidad/precio) y
   > `gemini-3.1-flash-lite` el más barato con visión; si alguno fallara con tu
   > cuenta, prueba el más reciente en https://aistudio.google.com/apikey.

3. **Búsqueda por lotes (cómo funciona la IA)**: al publicar un reporte, la app:
   - Toma hasta **12 candidatos** del rol opuesto (`GEMINI_MAX_CANDIDATOS`),
     priorizando misma ciudad → departamento → resto del país, más recientes
     (excluye al propio reporte y los del mismo usuario).
   - Compara en **lotes de 4 en paralelo** (`GEMINI_LOTE_PARALELO`) para respetar el
     límite de peticiones por minuto del free tier, con **1 reintento** por fallo.
   - Guarda cada par en la tabla `comparaciones` (**dedupe**: un par solo se compara
     una vez, aunque el cron lo re-cruce al día siguiente).
   - Pide a Gemini un dictamen JSON `{es_mismo, similitud, razon}` con **esquema
     forzado** (`response_format`). Hay match solo si `es_mismo` **y** similitud
     **≥ 80** (`GEMINI_MATCH_THRESHOLD`).
   - Si una comparación falla (foto bloqueada por la política de Google, error de
     red…) **no se rompe nada**: ese candidato se omite y el reporte queda guardado.
   - Tope de consumo: **200 llamadas por ejecución** (`GEMINI_LIMITE_DIARIO`).
4. **Revisión diaria** (opcional pero recomendada): programa el cron de la migración 005
   (pg_cron → `POST /api/revisar-coincidencias` con header `x-cron-secret: CRON_SECRET`).
   Cada día re-cruza los reportes ACTIVOS de los últimos **7 días**
   (`GEMINI_DIAS_REVISION`, hasta 40 reportes por ejecución) contra los candidatos que
   aún no se compararon: **ningún match se pierde** aunque haya cientos de publicaciones.
5. La publicación **nunca falla por la IA**: si Gemini no responde, el reporte queda
   guardado igual y la revisión diaria lo intenta después.

> 💰 El free tier de Google permite usar los modelos Flash con un límite diario sin
> tarjeta; el de 12 comparaciones por publicación alcanza para decenas de publicaciones
> al día (todo el ajuste fino está en `src/lib/constants.ts`). Precios por modelo,
> factura mensual simulada en USD/COP y escenarios de crecimiento en
> [`docs/costos.md`](docs/costos.md).

---

## 🚀 3. Desarrollo local

```bash
npm install
npm run dev        # → http://localhost:3000
```

---

## 🐳 4. Producción con Docker

```bash
docker compose --env-file .env.local up --build -d
```

La app queda expuesta en **http://localhost:3000**.

> El `Dockerfile` es multi-stage: instala dependencias, compila con las variables
> `NEXT_PUBLIC_*` (build args) y genera una imagen mínima con la salida **standalone**
> de Next.js. Las variables secretas (`SUPABASE_SERVICE_ROLE_KEY`, AWS…) se inyectan
> en tiempo de ejecución desde el entorno del contenedor.

---

## 📬 5. Notificaciones por correo (Brevo)

Los correos de coincidencia se envían con **Brevo** (API HTTP directa, 300 correos/día
gratis para siempre, sin tarjeta, **sin dominio propio**: solo se verifica el remitente por clic).

1. Crea una cuenta gratis en **brevo.com** (confirmas el email, sin tarjeta).
2. **API key**: avatar → **SMTP & API** → pestaña **API Keys** → *Generate a new API key*
   → copia el `xkeysib-...` (solo se muestra una vez).
3. **Remitente verificado**: **SMTP & API** → pestaña **Senders** → *Add a sender* →
   tu nombre y tu email personal → **clic en el enlace de confirmación** que llega → "Valid".
4. Variables en `.env.local` (o en el entorno del servidor):

   ```bash
   MAIL_PROVIDER=brevo
   BREVO_API_KEY=xkeysib-...
   BREVO_FROM=Patitas SOS <tu-correo-verificado@gmail.com>   # exactamente el sender verificado
   APP_URL=http://localhost:3000              # URL pública para los enlaces de los correos
   APP_TOKEN_SECRET=<openssl rand -hex 32>
   ```

5. Reinicia el dev server tras cambiar `.env.local`. Revisa **Spam/Promociones** en Gmail
   con un remitente nuevo (los correos pasados a 300/día comparten IP con otros remitentes;
   si la entregabilidad se vuelve un problema, ver `docs/costos.md`).

> ✉️ **Alternativa**: Resend — `MAIL_PROVIDER=resend` + `RESEND_API_KEY` + `EMAIL_FROM`
> (gratis 100/día pero **requiere dominio propio** verificado con DNS).
>
> 💡 Si un match no notifica, la publicación **no se bloquea** (diseño): el estado del envío se
> devuelve en `matchInfo.notificacion` de la respuesta del API y se muestra en el modal de
> coincidencia (`notificados=true` en `matches_ia` solo cuando el proveedor aceptó ambos correos).
>
> 🔔 **Los correos son un extra**: cada coincidencia también crea **notificaciones web** (tabla
> `notificaciones`), visibles en el header y en `/notificaciones`. Es la **bandeja de reemplazo
> del email**: si no abres Gmail o no estás pendiente, ahí lo ves todo igual.
>
> 💰 **Costos**: free tiers, tarifas por uso y una simulación de factura en USD/COP en
> [`docs/costos.md`](docs/costos.md).

---

## 🔓 Consentimiento para compartir contacto

Los datos de contacto (nombre, teléfono, correo, barrio) **nunca se intercambian de
forma automática** entre las partes de un match: solo el titular puede autorizarlo.

1. Al crearse un match, cada parte recibe un correo con el botón
   **"Compartir mi información de contacto"** (enlace firmado con HMAC +
   `APP_TOKEN_SECRET`, válido 72 h) — y en la plataforma, *Mis publicaciones*
   muestra el botón **"Compartir mi contacto"** por cada match (requiere sesión del
   publicador).
2. `/compartir-contacto?match&rol&t` muestra el **resumen de la coincidencia** (foto,
   % y descripción de la contraparte), qué datos se van a compartir y la casilla de
   **aceptación de la Política de Privacidad** (obligatoria, no hay botón sin marcar).
3. `POST /api/consentimientos` valida de nuevo la identidad (sesión del publicador o
   firma del token) —no se puede autorizar por la contraparte—, registra la
   autorización con fecha/hora y envía el **correo con los datos al titular de la
   contraparte**.
4. La otra parte verá tus datos en ese correo y en *Mis publicaciones* /
   *Notificaciones* (columna "📞 Contacto" solo visible para quien tiene
   autorización válida de su lado). Nadie más los ve.
5. La política completa está en `/politica-de-privacidad` (con las secciones legales
   y los derechos del titular) y su versión se guarda en cada autorización.

Ejemplo: el **dueño** autoriza → se envía el correo con sus datos al **rescatista** y
`dueno_autorizo = true`. Cuando el rescatista (dueño de sus propios datos) autorice,
quedará `encontrador_autorizo = true` y el dueño recibirá el correo con los datos del
rescatista. Cada lado decide por separado.

---

## 💬 Chat privado entre las partes de un match

Cada coincidencia puede tener **una conversación privada** (`conversaciones.match_id`
único → `mensajes`) para coordinar el reencuentro **sin** exponer números ni correos
en el feed.

- **Regla de habilitación** (¡se valida en el SERVIDOR!): el chat se desbloquea para ti
  cuando la **contraparte autorizó compartir su contacto** (tú ya recibiste sus datos).
  Los botones "🔓 Compartir mi contacto" se convierten en **"💬 Chatear"**. Una vez
  abierta la conversación, ambos participantes responden.
- **Privacidad en la UI**: la tarjeta de contraparte del chat solo muestra datos
  públicos (foto, nombre temporal, rol, estado, %); NUNCA teléfono/correo/barrio.
- **Tiempo real sin exponer datos**: Supabase Realtime se usa solo con **broadcast**
  (canal `chat-<match_id>`): al enviar, el servidor emite un "ping" y el receptor
  recarga el hilo por la API con su sesión. No hay políticas RLS de datos ni llaves
  de lectura en el navegador (solo `NEXT_PUBLIC_SUPABASE_ANON_KEY` para suscribirse
  al canal; sin ella el chat funciona igual, sin el ping).
- **Pantallas**: `/chat` (bandeja con badge de no leídas en el header 💬),
  `/chat/abrir?match=` (crea la conversación validando la regla) y
  `/chat/[conversacionId]` (hilo con burbujas, envío optimista y autoscroll).
- **API** (todas requieren sesión): `GET /api/mensajes` (bandeja + `noLeidasTotal`),
  `POST /api/mensajes/abrir`, `POST /api/mensajes` (enviar), `GET /api/mensajes/[id]`
  (hilo, marca `es_mio`), `POST /api/mensajes/[id]` (marcar leídas).
- **DB**: `supabase/migrations/008_chat.sql` (bases existentes) / `schema.sql` (nuevas).

**Flujo completo**: match → tú autorizas o la contraparte autoriza → si la otra
persona ya autorizó, te aparece "💬 Chatear" en *Mis publicaciones*, *Notificaciones*
y en el éxito de `/compartir-contacto` → abres la conversación y escriben.

---

## 👀 Avisos de testigos ("Vi esta mascota")

Cualquier persona **con cuenta** que ve una publicación y vio a la mascota (pero
no pudo cogerla) puede avisarle **al dueño** desde la página pública del reporte,
**sin exponer datos de nadie**:

- **Cuenta obligatoria (idéntica en ambos lados)**: sin sesión, la app invita a
  iniciar sesión antes de avisar. Así el aviso SIEMPRE queda ligado a tu cuenta:
  si la persona responde, la conversación te espera en **"Mis avisos"** (👀 en el
  header) aunque hayas cerrado sesión. No hay enlaces privados con token.
- **Mensajes predefinidos** (anti-spam): 5 botones fijos para el aviso inicial; el
  dueño **nunca** recibe texto libre para crear un hilo. La **primera respuesta
  del dueño** también es un predefinido (chips: "¡Hola! Creo que sí puede ser mi
  mascota…") para que el testigo no reciba presión por datos de contacto de golpe;
  después, ambos escriben texto libre.
- **El dueño controla todo**: ve los avisos en *Mis publicaciones* (con badge de no
  leídas, también suman al 🔔 del header) y puede **🔕 desactivar los mensajes** —
  botón **solo visible para el dueño** (en el propio hilo y en *Mis publicaciones*):
  se bloquean avisos nuevos y el testigo ya no puede escribir; el dueño sí puede
  leer/responder. Los hilos nunca se borran.
- **Leídas bidireccionales**: el testigo ve en "Mis avisos" (y en su badge 👀) los
  mensajes del dueño sin leer; el dueño ve los suyos en *Mis publicaciones* y el 🔔.
- **Anti-spam extra**: un aviso por (publicación + cuenta) y máx. 5 avisos nuevos
  por publicación al día. Sin correos (nada se satura).
- **Sin contacto a la vista**: la página del hilo solo muestra datos públicos del
  reporte y los mensajes; el acceso es exclusivo del testigo y del dueño (sesión).
- **DB**: `supabase/migrations/009_avistamientos.sql` + `010_avisos-con-cuenta.sql`
  (bases existentes) / `schema.sql` (nuevas): columna `perritos.avisos_habilitados`,
  tablas `avistamientos` (con `usuario_id`) y `mensajes_aviso` (con `leida` para el
  dueño y `leida_avisador` para el testigo).

---

## 🚀 6. Checklist para pasar a producción

La app **no requiere cambios de código** para producción: todo es configuración
(las API Routes ya leen todo del entorno). Sigue esta lista en orden:

| # | Paso | Dónde | Detalle |
|---|---|---|---|
| 1 | Crear la API key de Gemini | https://aistudio.google.com/apikey | Botón *Create API key* (gratis, sin tarjeta) |
| 2 | Crear la cuenta y API key de Brevo | brevo.com | SMTP & API → API Keys → `xkeysib-...` (300 correos/día gratis) |
| 3 | Verificar el remitente de Brevo | brevo.com → SMTP & API → Senders | *Add a sender* con tu email y haz clic en el enlace de confirmación |
| 4 | `GEMINI_API_KEY`, `MAIL_PROVIDER=brevo`, `BREVO_API_KEY`, `BREVO_FROM` | Variable de entorno del server | Sin esto la app publica pero sin IA y sin correos |
| 5 | `APP_URL=https://tu-app.vercel.app` (o tu dominio) | Variable de entorno del server | ⚠️ Sin esto, los botones de los correos ("Ver la mascota", "Marcar como encontrada") apuntan a `localhost` |
| 6 | `APP_TOKEN_SECRET`, `CRON_SECRET` | Variable de entorno del server | Secretos nuevos: `openssl rand -hex 32` (no reutilices los de desarrollo) |
| 6b | Ejecutar la migración `008_chat.sql` | Supabase → SQL Editor | Crea `conversaciones` y `mensajes` (también la 007 si no la tenés aún) |
| 6c | Ejecutar la migración `009_avistamientos.sql` | Supabase → SQL Editor | Crea `avistamientos` + `mensajes_aviso` y la columna `avisos_habilitados` (👀 avisos de testigos) |
| 6d | Ejecutar la migración `010_avisos-con-cuenta.sql` | Supabase → SQL Editor | Avisos con cuenta obligatoria: `avistamientos.usuario_id` + `mensajes_aviso.leida_avisador` (leídas bidireccionales) |
| 6c | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Variable de entorno del server (y build de Vercel) | Llave pública de Supabase (Settings → API) para el ping en tiempo real del chat; sin ella el chat funciona sin el refresco instantáneo |
| 7 | Programar el cron diario | Ver [⏰ Revisión diaria en producción (cron)](#-revisión-diaria-en-producción-cron) | pg_cron dispara `POST /api/revisar-coincidencias` con header `x-cron-secret` |
| 8 | Desplegar la app | **Vercel** (recomendado, ver [🚀 6b.](#-6b-desplegar-en-vercel-paso-a-paso)) o Docker | Vercel: importa el repo y pega las variables; también funciona con Render/VPS |
| 9 | Prueba de humo | Navegador | Publicar un PERDIDO y un BUSCA_DUEÑO con 2 correos distintos: deben llegar **ambos** correos y el modal debe decir "Correos de aviso enviados a ambas partes". Verificar que el rescatista NO puede marcar como encontrada (solo el dueño) |

> 🔐 **Seguridad**: las variables secretas (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`,
> `BREVO_API_KEY`, `APP_TOKEN_SECRET`, `CRON_SECRET`) van **solo en el servidor**; en el
> navegador únicamente se exponen las `NEXT_PUBLIC_*` (URL y anon key).

---

## 🚀 6b. Desplegar en Vercel (paso a paso)

**Respuesta corta: sí, es un solo despliegue.** La app es **monolítica** (Next.js):
un único proyecto de Vercel sirve el **frontend y el backend a la vez** (tu "backend"
son las API Routes de `src/app/api/*`, que corren igual dentro de Vercel como funciones
serverless). **La base de datos no se despliega**: sigue viviendo en Supabase (es un
servicio externo gestionado); Vercel solo se conecta a ella con las variables. Hay un
cron diario aparte que se programa en Supabase (sección 7).

1. **Sube el repo a GitHub** (verde → local).
2. **vercel.com** → *Add New Project* → importa el repositorio (conecta GitHub).
3. Vercel detecta solo el framework **Next.js**; no cambies nada del build.
   En *Environment Variables* pega **todas** las de tu `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`,
   `GEMINI_MODEL`, `MAIL_PROVIDER`, `BREVO_API_KEY`, `BREVO_FROM`, `APP_URL`,
   `APP_TOKEN_SECRET`, `CRON_SECRET`.
4. **Deploy** → queda en `https://<proyecto>.vercel.app`. Cambia `APP_URL` en
   Vercel (*Settings → Environment Variables*) por esa URL y vuelve a desplegar.
5. **Dominio propio** (opcional): *Settings → Domains* → añade `patitas.co` (si el
   DNS está en Vercel se configura automáticamente; si no, apunta un registro por
   la GUI). Actualiza `APP_URL` con el dominio final.
6. **Cron diario**: sigue funcionando tal cual — el job de Supabase (sección 7)
   llama a `POST https://tu-app.vercel.app/api/revisar-coincidencias` con el header
   `x-cron-secret`. (Los Cron de Vercel requieren `vercel.json` y no permiten
   headers personalizados en Hobby, por eso la app usa el de Supabase.)
7. **Prueba de humo**: publica un PERDIDO y un BUSCA_DUEÑO con dos correos distintos
   y verifica que llegan ambos avisos y que los enlaces apuntan a tu dominio.

> ⚠️ El plan **Hobby de Vercel es gratuito** (funciones serverless, sin límites
> bloqueantes para este uso). Las `NEXT_PUBLIC_*` se incrustan en el build: si
> cambias de proyecto/URL, vuelve a desplegar.
>
> 🐳 **Alternativa**: Docker (`docker compose --env-file .env.local up --build -d`),
> un VPS o Render Web Service desde el Dockerfile multi-stage incluido.

---

La revisión diaria re-cruza cada día los reportes ACTIVOS recientes contra candidatos
**aún no comparados** (dedupe por la tabla `comparaciones`), para que ningún match se
pierda aunque haya cientos de publicaciones. **No la programa la app**: la dispara
**Supabase** (pg_cron + pg_net) llamando a tu app desplegada:

```
POST https://TU-APP/api/revisar-coincidencias
Header: x-cron-secret: <TU-CRON-SECRET>
```

> 🔑 **Antes de programarla**: la URL debe ser **HTTPS pública** (ej. `https://tu-app.com`)
> y `x-cron-secret` debe ser **exactamente igual** al `CRON_SECRET` de las variables del
> servidor (si no coincide, la ruta responde `401`; si falta la variable, `503`).

Elige **UNA** de las dos formas:

### Opción A — Panel de Supabase (recomendada, sin SQL)

1. En tu proyecto de Supabase: **Settings → Integrations**.
2. Habilita los integradores **Cron** y **HTTP Request** (pg_cron y pg_net ya vienen
   instalados en todos los proyectos).
3. Crea el job de *Cron*:
   - **Schedule**: todos los días a la hora que quieras (ej. `0 7 * * *` = 7:00 a.m.
     según la hora del servidor, normalmente UTC).
   - **HTTP Request details**:
     ```
     Method:  POST
     URL:     https://TU-APP/api/revisar-coincidencias
     Headers: content-type: application/json
              x-cron-secret: TU-CRON-SECRET
     ```
4. Guarda el job. Ya queda programado: ejecutará la revisión todos los días sin tocar nada más.

### Opción B — SQL Editor (script de la migración 005)

1. Abre `supabase/migrations/005_gemini-ia.sql`.
2. Descomenta el bloque de extensiones (`pg_cron`, `pg_net`) y el `select cron.schedule(...)`.
3. Reemplaza `TU-APP_URL` por la URL pública de tu app y `TU-CRON-SECRET` por tu secreto.
4. Pega el script completo en **Supabase → SQL Editor → Run** (es idempotente).

### Verificar que funciona

- **Panel**: *Settings → Integrations → Jobs → Run History* muestra cada ejecución con
  su respuesta y su estado.
- **Respuesta correcta** del job (la devuelve la ruta):
  ```json
  { "ok": true, "reportesDisponibles": 3, "reportesProcesados": 3,
    "llamadasGemini": 12, "coincidencias": 1,
    "maxCandidatos": 12, "limiteDiario": 200 }
  ```
- **401** → el `x-cron-secret` no coincide con `CRON_SECRET` del servidor.
  **503** → falta `CRON_SECRET` en el servidor.
- **En local no se programa nada**: la revisión se prueba a mano:
  ```bash
  curl -X POST http://localhost:3000/api/revisar-coincidencias \
    -H "x-cron-secret: TU-CRON-SECRET"
  ```

---

## 💰 8. Costos y factura mensual (2026)

Todo corre en free tiers (Gemini, Brevo, Supabase, Vercel Hobby). Precios oficiales del
modelo por defecto (`gemini-3.5-flash`): **US$1,50 / millón de tokens de entrada y
US$9,00 / millón de salida** (`gemini-3.1-flash-lite`, el más barato: US$0,25 / US$1,50).

**Costo por comparación** (2 fotos ≈ 1.100 tokens de entrada + ~80 de salida):
≈ **US$0,0024** con 3.5 Flash (≈ COP 10) y ≈ **US$0,0004** con Flash Lite.

**Factura simulada (MVP: 30 publicaciones/mes → 360 comparaciones):**

| Concepto | Cálculo | Mensual |
|---|---|---|
| Gemini (pagado, 3.5 Flash) | 360 × US$0,0024 | **~US$0,86** (COP ≈ 3.600) |
| Gemini (free tier) | 12/día << límite diario | **$0** |
| Brevo (free) | 2 correos/match × ≤300/día | **$0** |
| Supabase (free tier) | fotos ≤ 200 KB | **$0** |
| Vercel (Hobby) | hosting frontend + API | **$0** |
| **Total** | — | **$0/mes** (o ~US$0,86 si se paga) |

Escenarios de crecimiento, tablas por modelo y cómo se controlan los costos en
[`docs/costos.md`](docs/costos.md).

---

## ⚙️ Lógica de negocio

### Estados y categorías del feed

```
PERDIDO   (ACTIVO)    → "🐾 Se buscan"        (el dueño busca a su mascota)
BUSCA_DUEÑO (ACTIVO)  → "🏠 Buscan su dueño"  (alguien rescató una mascota)
cualquier rol + ENCONTRADA → "✅ Encontradas" (el dueño confirmó el reencuentro)
```

- La IA **nunca** elimina ni reconcilia reportes de forma automática: solo registra el par
  en `matches_ia` y notifica por correo.
- El paso de `ACTIVO` → `ENCONTRADA` **solo** lo hace el dueño (o el publicador verificado)
  desde la página del reporte (`/perrito/[id]`) o desde el enlace firmado del correo.

### `POST /api/publicar-perrito` — flujo unificado

Flujo unificado para Dueño (`PERDIDO`) y Rescatista (`BUSCA_DUEÑO`):

1. **Exige sesión**: cookie httpOnly (`patitas_sesion`, firmada con `APP_TOKEN_SECRET`).
   Sin sesión responde `401` y el reporte NO se publica. El email NO viene del formulario:
   se toma de la sesión (el formulario solo pide nombre y teléfono).
2. **Recibe** el formulario + foto (`multipart/form-data`). El teléfono es siempre
   colombiano: el `+57` va fijo en el formulario y se normaliza a `+57XXXXXXXXXX` en el servidor.
3. **Comprime** la foto en el cliente (canvas) hasta ≤ **200 KB**; el servidor valida el tamaño.
4. **Sube** la imagen al bucket público `fotos-perritos` y obtiene su URL.
5. **Guarda** el reporte en `perritos` (con `foto_url`, `departamento` y municipio de la
   lista DANE de Colombia). El `usuarios` queda ligado a la sesión. **La publicación nunca
   depende de la IA**: cualquier foto (perros, gatos, calidad regular) se acepta.
6. **Gemini Flash** compara la foto contra hasta **12 reportes ACTIVOS de rol opuesto**
   (misma ciudad → departamento → resto del país, más recientes) pidiendo un dictamen
   JSON `{es_mismo, similitud, razon}`. Cada par se guarda en `comparaciones` (dedupe).
7. Si hay un **match válido** (`es_mismo` y similitud **≥ 80 %**):
   - Registra el par en `matches_ia` **sin cambiar ningún estado** y crea
     **notificaciones web** para ambas partes (tabla `notificaciones`; 🔔 bandeja de
     reemplazo del correo, header con contador + `/notificaciones`).
   - Envía **correos (Brevo) a ambas partes**: al dueño ("alguien posiblemente
     encontró a tu mascota") y al rescatista ("un posible dueño apareció"), cada uno
     con enlace para ver la publicación de la contraparte, botón para marcarla como
     encontrada (solo el del dueño) y botón **"Compartir mi información de contacto"**
     (enlace firmado → `/compartir-contacto`). **Ningún correo incluye aún datos de
     contacto de nadie**: se intercambian solo cuando la parte dueña de los datos
     autoriza (consentimiento, ver abajo).
   - Responde `{ "match": true, "matchInfo": { perrito, usuario, porcentaje_similitud } }`
     (datos de contacto SOLO si la contraparte ya había autorizado antes).
8. **Además**: la revisión diaria (`POST /api/revisar-coincidencias`) re-cruza cada día
   los reportes ACTIVOS recientes contra los candidatos aún no comparados (tope de ~200
   llamadas/día), para que ningún match se pierda aunque haya cientos de publicaciones.

### Marcar como encontrada

- `POST /api/perritos/[id]/marcar-encontrada` verifica que quien lo pide es el
  **DUEÑO** (publicador del reporte PERDIDO) mediante una de estas vías:
  1. **sesión** — cookie httpOnly con el mismo correo del publicador (entras, abres tu
     reporte y confirmas).
  2. **`token`** — firma HMAC (SHA-256, `APP_TOKEN_SECRET`) que llega en el correo
     de notificación del dueño (`…/perrito/[id]?token=…`).
  ⚠️ **NO** se acepta verificación por teléfono/email: el teléfono es público en el
  reporte y cualquiera podría marcarla. Un visitante sin sesión del dueño no ve la
  sección "Marcar como encontrada" (`PerritoDetalle` la oculta).
- Al confirmar, el reporte y **todos sus pares de `matches_ia`** (la misma mascota)
  pasan a `ENCONTRADA` y aparecen en la lista *Encontradas* del home.

### Otras API Routes

- `GET /api/perritos?departamento=&ciudad=&barrio=&rol=&estado=&page=&pageSize=`
  — feed paginado con filtros (estado `ACTIVO|ENCONTRADA`; sin `estado` devuelve
  `ACTIVO` + `ENCONTRADA`).
- `GET /api/perritos/[id]` — detalle de un reporte con el contacto de su publicador
  (la web usa un server component para esto; el endpoint queda disponible como API pública).
- `GET /api/mis-publicaciones` (cookie) — los reportes del usuario logueado, cada uno
  con sus matches (`contraparte_id` + `porcentaje_similitud`).
- `GET/POST /api/notificaciones` (cookie) — lista las notificaciones web (con la
  publicación de la contraparte) y el conteo de no leídas; `POST { id }` marca una
  como leída, `POST {}` marca todas.
- `POST /api/consentimientos` — registra la **autorización de compartir contacto**
  `{ matchId, rol, token?, aceptado }` (ver [🔓 Consentimiento](#-consentimiento-para-compartir-contacto)):
  como respuesta pone la bandera `dueno_autorizo`/`encontrador_autorizo` del match y
  **envía el correo con los datos** al correo de la contraparte (teléfono/enviado
  también en la respuesta). Campos nuevos en `matches_ia`: `dueno_autorizo`,
  `encontrador_autorizo`, `contacto_dueno_enviado`, `contacto_encontrador_enviado`,
  `autorizaciones_json` (fecha/hora/versión de la política) y `contacto_enviado_at`.
- `POST /api/login` — email + contraseña; valida contra `usuarios.password_hash`
  (scrypt) y entrega la cookie de sesión. **Sin rate limiting.**
- `POST /api/registro` — crea la cuenta (o asigna contraseña si el correo ya existía)
  e inicia sesión. `GET /api/yo` restaura la sesión al cargar; `POST /api/logout` la cierra.

### 🔐 Inicio de sesión (login propio)

- **`/registrarse`** — cualquiera crea su cuenta: nombre, teléfono, email y
  contraseña (mínimo 6 caracteres, hash **scrypt**). Si el correo ya existía (p. ej.
  quien publicó con el login anterior por código), el registro **reclama** esa cuenta
  y le asigna su contraseña: nunca duplica.
- **`/iniciar-sesion`** — email + contraseña, las veces que quieras: **no hay
  rate limiting ni correos OTP**. La sesión vive en una cookie `HttpOnly` +
  `SameSite=Lax` firmada con `APP_TOKEN_SECRET` (30 días).
- Sin sesión **no se puede publicar** (la API responde 401 y `/publicar` invita a
  iniciar sesión). Ver el feed y el detalle sí es público.
- El header muestra el correo, *Mis publicaciones*, la campana 🔔 con el conteo de
  no leídas y *Salir*.

---

## 🎨 Interfaz

- **`/` — Home / Feed**: 4 categorías — *Todos*, *🐾 Se buscan* (PERDIDO activos),
  *🏠 Buscan su dueño* (BUSCA_DUEÑO activos) y *✅ Encontradas* — con scroll
  infinito, filtros por **departamento → municipio** (Colombia, lista DANE de 1122
  municipios) y dirección/barrio. Las tarjetas enlazan a la página de detalle y tienen
  botón de WhatsApp.
- **`/iniciar-sesion` — Login**: email + contraseña (login propio, sin OTP ni
  rate limiting). Si ya hay sesión redirige a *Mis publicaciones*.
- **`/registrarse` — Registro**: cuenta gratis (nombre, teléfono, email, contraseña).
- **`/mis-publicaciones` — Mis reportes** (requiere sesión): tus publicaciones con su
  estado y, si la IA encontró una coincidencia, el enlace directo a la publicación de
  la contraparte con el % de similaridad.
- **`/notificaciones` — Avisos web** (requiere sesión): las coincidencias de la IA con
  estado leída/no leída; cada aviso enlaza a la publicación de la contraparte y, si esa
  persona ya autorizó, muestra su columna "📞 Contacto". No dependen del correo.
- **`/compartir-contacto` — Consentimiento** (sesión o token firmado del correo):
  resumen de la coincidencia, lista de lo que se compartirá y casilla obligatoria de
  aceptación de la Política de Privacidad. Al confirmar, la contraparte recibe el
  correo con tus datos.
- **`/politica-de-privacidad`**: política pública con qué datos se recogen, para qué
  se usan, cuándo (y solo si autorizas) se comparten, derechos del titular y contacto.
- **`/chat` — Bandeja de chat** (requiere sesión): conversaciones con las personas que
  ya autorizaron compartir su contacto (foto, nombre, último mensaje, badge de no
  leídas). **`/chat/abrir?match=`** crea la conversación de una coincidencia (valida la
  regla en el servidor) y **`/chat/[id]`** es el hilo: burbujas, envío con Enter,
  autoscroll y mensajes en tiempo real vía "ping" de Supabase Realtime (los datos
  siempre salen de la API con sesión). El header muestra el icono 💬 con contador.
- **`/perrito/[id]` — Detalle**: foto grande, descripción, zona, datos de contacto,
  botones WhatsApp / llamar, y el botón **"Marcar como encontrada"** (verificado por
  token del correo, teléfono, email o sesión iniciada; pasa el reporte y sus pares a
  *Encontradas*). Si el visitante logueado es parte de un match, ve además la
  referencia a la publicación de la contraparte (privada para los demás).
- **`/publicar` — Formulario** (requiere sesión): pestañas *"Perdí a mi mascota"* /
  *"Encontré una mascota"*, teléfono con **+57 fijo**, email bloqueado con el de la
  sesión, departamento/municipio en selects y botón grande para activar la cámara o
  subir la foto. Al detectar un match, la pantalla se **congela** y aparece el **modal
  de éxito gigante** con la foto del otro reporte, los datos de la contraparte y
  botones de llamada / WhatsApp; el reporte propio sigue publicado.

---

## 🧠 Decisiones técnicas

- **Compresión en el cliente**: se reduce calidad y dimensiones con `<canvas>` hasta
  ≤ 200 KB antes de subir (ahorra almacenamiento gratuito de Supabase y acelera a Gemini).
- **IA de mascotas, no de "caras humanas"**: Gemini Flash compara la apariencia del animal
  (especie, raza, color, manchas, tamaño); funciona con perros y gatos a diferencia del
  reconocimiento facial clásico, y nunca rechaza una foto.
- **Candidatos por cercanía**: se prioriza misma ciudad → departamento → resto del país;
  cada par comparado se guarda en `comparaciones` para no repetir llamadas a Gemini.
- **Revisión diaria**: aunque en el instante solo se comparen 12 candidatos, el cron de
  la migración 005 re-cruza todo lo pendiente dentro de 24 h (nada se pierde con cientos
  de publicaciones).
- **Auto-coincidencia**: al buscar, se excluye el reporte recién creado y los reportes del
  mismo usuario para no matchear con uno mismo.
- **Nada se reconcilia solo**: la IA solo registra el par en `matches_ia` y notifica
  por correo; el dueño decide cuándo marcar el reporte como `ENCONTRADA`.
- **Verificación del dueño**: SOLO con la sesión iniciada del publicador o con la
  firma HMAC del correo (`APP_TOKEN_SECRET`). El teléfono NO sirve como verificación
  (es público en el reporte). Ver "Marcar como encontrada" arriba.
- **Lista DANE embebida**: los 33 departamentos y 1122 municipios viven en
  `src/lib/colombia.ts` (datos oficiales de datos.gov.co), sin llamadas de red.
- **Privacidad**: los datos de contacto **solo** se intercambian con la autorización
  expresa de su titular (consentimiento registrado en `matches_ia`); la referencia al
  match en el detalle solo la ven las partes logueadas y los enlaces del correo se
  firman con HMAC (72 h de validez) para que nadie más pueda actuar por ti.
- **Chat privado con realtime sin exponer datos**: el chat solo se habilita cuando la
  contraparte autorizó su contacto (regla validada en el servidor); los mensajes viajan
  por las API con sesión y Supabase Realtime se usa únicamente como "ping" de
  notificación (broadcast por canal `chat-<match_id>`, sin RLS de datos ni llaves de
  lectura en el navegador).

## 🛠️ Solución de problemas

| Problema | Causa / Solución |
|---|---|
| `La foto supera los 200 KB` | El navegador no comprimió; usa el formulario de la web |
| `Faltan variables de entorno` | Completa `.env.local` y reinicia `npm run dev` (`GEMINI_API_KEY`, `BREVO_API_KEY`…) |
| Error 403 de Storage | El bucket no es público o falta la política RLS de lectura |
| `Missing API key` / `API key not valid` de Gemini | La `GEMINI_API_KEY` está vacía o mal copiada (revisa https://aistudio.google.com/apikey) |
| `model not found` / `project denied` con Gemini | La clave no tiene acceso al modelo configurado (llaves 2026: los `gemini-2.x` ya no se dan a usuarios nuevos) → usa `GEMINI_MODEL=gemini-3.5-flash` (o un 3.x listado en https://aistudio.google.com/apikey) |
| Sin matches al publicar | El umbral es 80 % + `es_mismo`; sube fotos de frente, con luz y que se vea el pelaje/manchas. Revisa `comparaciones` para ver el dictamen de Gemini |
| No llegan los correos de coincidencia | Brevo los aceptó pero **no los ves en Recibidos → revisa Spam/Promociones** (normal con remitente nuevo). Si Brevo no los aceptó: `BREVO_API_KEY`/`BREVO_FROM` mal puestos o remitente sin verificar por clic |
| El enlace "Compartir mi contacto" del correo no sirve (o muestra "Enlace no válido") | El token tiene una vigencia de 72 h y es por match+lado: pide el enlace nuevo desde *Mis publicaciones* (sesión) o desde el correo más reciente. Si la coincidencia fue eliminada, no hay nada que autorizar |
| El chat no se habilita ("💬 Chatear" no aparece) | La contraparte aún no autorizó compartir SU contacto: el botón recién cambia cuando `dueno_autorizo`/`encontrador_autorizo` (según el lado) es true. Comparte el tuyo para desbloquear el intercambio |
| El chat funciona pero no llega en vivo el mensaje | Falta `NEXT_PUBLIC_SUPABASE_ANON_KEY` (o el usuario está en otra pestaña con sesión vencida): el ping de realtime no llega, pero el hilo se recarga al entrar/envíar; el badge del header se actualiza cada 30 s |
| No se ve la foto en el correo | Gmail bloquea imágenes remotas por defecto → clic en "Mostrar imágenes" |
| Solo el dueño puede marcar como encontrada | El botón solo aparece con la sesión del dueño o con el enlace `?token=` del correo; el teléfono/correo ya NO verifican (eran inseguros: el teléfono es público) |
| "Correo o contraseña incorrectos" | El usuario no se ha registrado aún: en `/registrarse` con el MISMO correo se crea la cuenta (o se le asigna contraseña si ya tenía publicaciones) |
| 401 al publicar | La sesión expiró: vuelve a `/iniciar-sesion` |
| 401/503 en `/api/revisar-coincidencias` | El header `x-cron-secret` no coincide con `CRON_SECRET` (o falta la variable) |
| Los enlaces del correo apuntan a localhost | Define `APP_URL` con la URL pública real |