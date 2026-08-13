# 🐾 Patitas SOS

**Plataforma colombiana** que conecta a las personas que perdieron a sus mascotas con quienes las
encontraron o rescataron. Usa **AWS Rekognition** para cruzar las fotos de los rostros al momento
de publicar, **avisa por correo (Resend)** a ambas partes cuando hay una coincidencia y el dueño
decide cuándo marcar la mascota como **encontrada**.

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
| Almacenamiento | **Supabase Storage** (bucket público `fotos-perritos`) |
| IA (reconocimiento facial) | **AWS Rekognition** SDK v3 (`IndexFaces` + `SearchFacesByImage`) |
| Notificaciones por correo | **Resend** (API vía HTTP, sin dependencias extra) |
| Despliegue | **Docker** (multi-stage + docker-compose) |

---

## 📁 Estructura del proyecto

```
├── Dockerfile                     # Multi-stage: compila y genera salida standalone
├── docker-compose.yml             # Expone la app en :3000 e inyecta las variables
├── .dockerignore                  # Excluye .env.local y node_modules de la imagen
├── package.json                   # Next.js 15, React 19, @supabase/supabase-js, SDK AWS v3
├── next.config.mjs                # Configuración de Next.js
├── tsconfig.json                  # TypeScript
├── postcss.config.mjs             # Tailwind CSS 4
├── .env.local.example             # Plantilla de variables (nunca se sube .env.local)
├── public/
│   └── robots.txt
├── aws/
│   └── migrations/
│       └── aws-iam-policy.json    # Política IAM mínima para Rekognition (acción por acción)
├── supabase/
│   ├── schema.sql                 # Script SQL completo → para bases NUEVAS
│   └── migrations/
│       ├── 002_mejoras-colombia.sql    # Migra bases viejas: ENCONTRADA, departamento, notificados
│       └── 003_limpieza-total.sql      # RESET total: borra todo y recrea el esquema
└── src/
    ├── app/
    │   ├── layout.tsx             # Layout raíz (metadatos, HTML base)
    │   ├── globals.css            # Estilos globales (Tailwind)
    │   ├── page.tsx               # Home / Feed (categorías + scroll infinito + filtros)
    │   ├── publicar/
    │   │   └── page.tsx           # Formulario de registro (Dueño / Rescatista)
    │   ├── perrito/
    │   │   └── [id]/page.tsx      # Detalle (server component) + "marcar como encontrada"
    │   └── api/
    │       ├── publicar-perrito/route.ts          # POST: flujo completo + matching IA
    │       ├── perritos/route.ts                  # GET: feed paginado y filtrado
    │       ├── perritos/[id]/route.ts             # GET: detalle de un reporte
    │       └── perritos/[id]/marcar-encontrada/   # POST: validar identidad y marcar ENCONTRADA
    ├── components/
    │   ├── Header.tsx             # Encabezado sticky con CTA de publicación
    │   ├── PetCard.tsx            # Tarjeta del feed (imagen, categoría, WhatsApp)
    │   ├── FilterBar.tsx          # Filtros por categoría, departamento → municipio y barrio
    │   ├── PublicarForm.tsx       # Formulario con pestañas + compresión de foto en canvas
    │   ├── MatchModal.tsx         # Modal gigante que "congela" la pantalla al detectar match
    │   └── PerritoDetalle.tsx     # Contenido del detalle (contacto, WhatsApp, marcar encontrada)
    └── lib/
        ├── supabase-client.ts     # Cliente anon key (navegador) — hoy toda la app usa el API
        ├── supabase-server.ts     # Cliente service role key — SOLO API Routes / Server Components
        ├── rekognition.ts         # AWS Rekognition SDK v3 (IndexFaces / SearchFacesByImage / DeleteFaces)
        ├── mail.ts                # Resend vía fetch + firma HMAC del enlace "marcar encontrada"
        ├── colombia.ts            # 33 departamentos y 1122 municipios (datos DANE, sin red)
        ├── validators.ts          # Validación del formulario y normalización +57 del teléfono
        ├── constants.ts           # Límites de negocio (200 KB, umbral 85 %, nombre del bucket…)
        ├── format.ts              # Formato: tiempo relativo, enlaces de WhatsApp
        ├── image-utils.ts         # Compresión con <canvas> hasta ≤ 200 KB
        └── types.ts               # Tipos compartidos (Perrito, Usuario, Match, CategoriaFeed…)
```

---

## 🔐 Variables de entorno

Copia `.env.local.example` → `.env.local` y completa los valores:

| Variable | Uso | Obligatoria |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase (se incrusta en el frontend) | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave anónima (pública) | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave maestra. **Solo se usa en las API Routes** (nunca en el navegador) | ✅ |
| `AWS_ACCESS_KEY_ID` | Credencial de AWS | ✅ |
| `AWS_SECRET_ACCESS_KEY` | Credencial secreta de AWS | ✅ |
| `AWS_REGION` | Región de la colección (ej: `us-east-1`) | ✅ |
| `AWS_REKOGNITION_COLLECTION_ID` | Nombre de la colección de Rekognition (ej: `perritos`) | ✅ |
| `RESEND_API_KEY` | API key de Resend para los correos de coincidencia | ⚠️ correos |
| `EMAIL_FROM` | Remitente verificado de los correos (ej: `Patitas SOS <no-reply@tudominio.co>`) | ⚠️ correos |
| `APP_URL` | URL pública de la app para los enlaces de los correos | ⚠️ correos |
| `APP_TOKEN_SECRET` | Secreto para firmar el enlace "marcar como encontrada" (`openssl rand -hex 32`) | ⚠️ correos |

> ⚠️ **Correos**: sin `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL` y `APP_TOKEN_SECRET` la
> plataforma funciona completa **excepto** las notificaciones por correo (ver
> [📬 Notificaciones por correo](#-notificaciones-por-correo-resend)).

---

## 🗄️ 1. Configurar Supabase

### Base nueva

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor**, pega el contenido de `supabase/schema.sql` y ejecútalo.
   Crea las tablas `usuarios`, `perritos` y `matches_ia`, los ENUMs, índices y las políticas RLS.
3. Crea el bucket público: **Storage → New bucket → name: `fotos-perritos` → marcar "Public bucket" → Create**.
4. Copia la URL y las llaves desde **Settings → API** a tu `.env.local`.

### Base ya existente (esquema anterior)

Ejecuta en el **SQL Editor** el script `supabase/migrations/002_mejoras-colombia.sql`,
que agrega:

- El estado `ENCONTRADA` al ENUM de `perritos` (los `RECONCILIADO` viejos pasan a `ENCONTRADA`).
- La columna `perritos.departamento` (filtros por departamento + municipio).
- `matches_ia.notificados` (evita reenviar correos del mismo par).
- Índices y la política RLS actualizada (lee `ACTIVO` y `ENCONTRADA`).

> ⚠️ `perritos.departamento` queda vacío (`''`) en los reportes viejos; se completa
> re-publicando el reporte o por SQL manual.

> Las escrituras se hacen siempre desde el servidor con la `service role key` (salta la RLS).
> La RLS solo blinda el acceso directo y permite leer el feed de reportes ACTIVOS y ENCONTRADA.

### Empezar desde cero (limpieza total)

Para **borrar todos los datos y volver a probar desde cero** (reportes, matches
y esquema viejo), ejecuta en el SQL Editor:

```
supabase/migrations/003_limpieza-total.sql
```

El script es **autocontenido** para la base: elimina tablas/enums/políticas y
recrea el esquema completo actual. Al final muestra la verificación (0 filas en
las 3 tablas + el enum con 3 valores).

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

La **colección de caras de AWS no se toca desde SQL**; vacíala con la CLI:

```bash
# Vaciar las caras de la colección (no borra la colección):
aws rekognition list-faces --collection-id perritos --max-results 100 --query "Faces[].FaceId" --output text \
  | xargs -r aws rekognition delete-faces --collection-id perritos --face-ids
```

---

## 🤖 2. Configurar AWS Rekognition

1. Crea un usuario IAM con acceso programático y adjunta la política
   [`aws/migrations/aws-iam-policy.json`](aws/migrations/aws-iam-policy.json)
   (acciones: `CreateCollection`, `ListCollections`, `IndexFaces`,
   `SearchFacesByImage`, `DeleteFaces`, `ListFaces`; el ARN está fijado a tu
   región y cuenta).
2. Crea la colección de caras (una sola vez) con la CLI de AWS:

   ```bash
   aws rekognition create-collection --collection-id perritos --region us-east-1
   ```

3. Anota `AWS_REKOGNITION_COLLECTION_ID=perritos` en tu `.env.local`.

> ⚠️ La política **no incluye `DeleteCollection`** (ni lo necesita): borrar la
> colección completa daría `AccessDeniedException`. Para dejar la colección vacía
> usa `ListFaces` + `DeleteFaces` (como en la sección de *limpieza total*). Si
> prefieres poder borrarla y recrearla, agrega `rekognition:DeleteCollection` a
> la política IAM.

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
> de Next.js. Las variables secretas (`SUPABASE_SERVICE_ROLE_KEY`, AWS, Resend…) se inyectan
> en tiempo de ejecución desde el entorno del contenedor.

---

## 📬 5. Notificaciones por correo (Resend)

Los correos de coincidencia se envían con la API HTTP de [Resend](https://resend.com)
(no se usa SDK, solo `fetch`).

1. Crea una cuenta en resend.com.
2. **Verifica un dominio** (Settings → Domains) y agrega el registro DNS de verificación.
3. Crea una **API Key** (Settings → API Keys) → `RESEND_API_KEY`.
4. Define `EMAIL_FROM` con un remitente de tu dominio verificado:
   `Patitas SOS <no-reply@tudominio.co>`.
5. Define `APP_URL` con la URL pública real de la app (ej: `https://patitas.tudominio.co`),
   porque los enlaces de los correos apuntan a `/perrito/[id]`.
6. Define `APP_TOKEN_SECRET` con un secreto largo: `openssl rand -hex 32`.

> **Modo pruebas (desarrollo, sin dominio)**: define `EMAIL_FROM="Patitas SOS <onboarding@resend.dev>"`
> y los correos **solo llegan al email con el que creaste tu cuenta de Resend** (entrega a
> cualquier otro destinatario falla). Para probar el flujo completo de coincidencia, usa ese
> mismo email en ambos reportes (perdido y encontrado): recibirás los 2 correos.
> Para correos reales a cualquier destinatario necesitas un dominio verificado
> (`Patitas SOS <no-reply@tudominio.co>`).
>
> 💡 Si un match no notifica, la publicación **no se bloquea** (diseño): el estado del envío se
> devuelve en `matchInfo.notificacion` de la respuesta del API y se muestra en el modal de
> coincidencia (`notificados=true` en `matches_ia` solo cuando Resend aceptó ambos correos).

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

1. **Recibe** el formulario + foto (`multipart/form-data`). El teléfono es siempre
   colombiano: el `+57` va fijo en el formulario y se normaliza a `+57XXXXXXXXXX` en el servidor.
2. **Comprime** la foto en el cliente (canvas) hasta ≤ **200 KB**; el servidor valida el tamaño.
3. **Sube** la imagen al bucket público `fotos-perritos` y obtiene su URL.
4. **`IndexFacesCommand`** registra la cara en la colección → obtiene un `FaceId`.
   Si no detecta cara, responde un error amigable pidiendo otra foto clara.
5. **Guarda** el reporte en `perritos` (con `aws_face_id`, `foto_url`, `departamento`
   y municipio de la lista DANE de Colombia).
6. **`SearchFacesByImageCommand`** con umbral **85.0%** busca coincidencias.
7. Si encuentra un **match válido** (rol opuesto + reporte ACTIVO):
   - Registra el par en `matches_ia` **sin cambiar ningún estado**.
   - Envía **correos (Resend) a ambas partes**: al dueño ("alguien posiblemente
     encontró a tu mascota", con enlace para verla y botón para marcarla como
     encontrada) y al rescatista ("un posible dueño apareció"), cada uno con los
     datos de contacto de la contraparte.
   - Responde `{ "match": true, "matchInfo": { perrito, usuario, porcentaje_similitud } }`
     con los datos de contacto de la contraparte.

### Marcar como encontrada

- `POST /api/perritos/[id]/marcar-encontrada` verifica que quien lo pide es el
  publicador del reporte mediante una de estas vías:
  1. **`token`** — firma HMAC (SHA-256, `APP_TOKEN_SECRET`) que llega en el correo
     de notificación del dueño (`…/perrito/[id]?token=…`).
  2. **`telefono`** — el teléfono usado al publicar el reporte.
  3. **`email`** — el correo usado al publicar el reporte.
- Al confirmar, el reporte y **todos sus pares de `matches_ia`** (la misma mascota)
  pasan a `ENCONTRADA` y aparecen en la lista *Encontradas* del home.

### Otras API Routes

- `GET /api/perritos?departamento=&ciudad=&barrio=&rol=&estado=&page=&pageSize=`
  — feed paginado con filtros (estado `ACTIVO|ENCONTRADA`; sin `estado` devuelve
  `ACTIVO` + `ENCONTRADA`).
- `GET /api/perritos/[id]` — detalle de un reporte con el contacto de su publicador
  (la web usa un server component para esto; el endpoint queda disponible como API pública).

---

## 🎨 Interfaz

- **`/` — Home / Feed**: 4 categorías — *Todos*, *🐾 Se buscan* (PERDIDO activos),
  *🏠 Buscan su dueño* (BUSCA_DUEÑO activos) y *✅ Encontradas* — con scroll
  infinito, filtros por **departamento → municipio** (Colombia, lista DANE de 1122
  municipios) y dirección/barrio. Las tarjetas enlazan a la página de detalle y tienen
  botón de WhatsApp.
- **`/perrito/[id]` — Detalle**: foto grande, descripción, zona, datos de contacto,
  botones WhatsApp / llamar, y el botón **"Marcar como encontrada"** (verificado por
  token del correo, teléfono o email; pasa el reporte y sus pares a *Encontradas*).
- **`/publicar` — Formulario**: pestañas *"Perdí a mi mascota"* / *"Encontré una
  mascota"*, teléfono con **+57 fijo**, email obligatorio (para las notificaciones),
  departamento/municipio en selects y botón grande para activar la cámara o subir la
  foto. Al detectar un match, la pantalla se **congela** y aparece el **modal de éxito
  gigante** con la foto del otro reporte, los datos de la contraparte y botones de
  llamada / WhatsApp; el reporte propio sigue publicado.

---

## 🧠 Decisiones técnicas

- **Compresión en el cliente**: se reduce calidad y dimensiones con `<canvas>` hasta
  ≤ 200 KB antes de subir (ahorra almacenamiento gratuito de Supabase y cumple el
  límite de AWS).
- **Foto del rostro**: se pide "de frente y con buena luz"; Rekognition requiere una
  cara mínima detectable para generar el `FaceId`.
- **Auto-coincidencia**: al buscar, se excluye el `ExternalImageId` del reporte recién
  creado para no matchear consigo mismo.
- **Nada se reconcilia solo**: la IA solo registra el par en `matches_ia` y notifica
  por correo; el dueño decide cuándo marcar el reporte como `ENCONTRADA`.
- **Verificación sin login**: el enlace del correo usa una firma HMAC sin estado en BD
  (`APP_TOKEN_SECRET`); también se acepta el teléfono o email usados al publicar.
- **Lista DANE embebida**: los 33 departamentos y 1122 municipios viven en
  `src/lib/colombia.ts` (datos oficiales de datos.gov.co), sin llamadas de red.
- **Privacidad**: los datos de contacto solo se entregan cuando la IA confirma un match.

## 🛠️ Solución de problemas

| Problema | Causa / Solución |
|---|---|
| `No detectamos una cara clara…` | La foto no tiene un rostro nítido: usa otra foto de frente y con luz |
| `La foto supera los 200 KB` | El navegador no comprimió; usa el formulario de la web |
| `Faltan variables de entorno` | Completa `.env.local` y reinicia `npm run dev` |
| Error 403 de Storage | El bucket no es público o falta la política RLS de lectura |
| `AccessDenied` de Rekognition | Verifica la política IAM y la región de la colección |
| Sin matches al publicar | El umbral es 85%: sube fotos de la misma cara con buena resolución |
| No llegan los correos de coincidencia | Falta `RESEND_API_KEY` o el dominio de `EMAIL_FROM` no está verificado en Resend |
| "No pudimos verificar que eres quien publicó" | La identidad debe coincidir con teléfono/email del reporte; o usa el enlace `?token=` del correo |
| `AccessDeniedException` al borrar la colección | La política IAM no incluye `DeleteCollection`; vacía las caras con `ListFaces` + `DeleteFaces` (ver *limpieza total*) o agrega el permiso |
| Los enlaces del correo apuntan a localhost | Define `APP_URL` con la URL pública real |