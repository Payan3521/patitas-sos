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
├── Dockerfile                     # Multi-stage, salida standalone
├── docker-compose.yml             # Expone la app en :3000 y mapea las variables
├── aws/
│   └── migrations/
│       └── aws-iam-policy.json    # Política IAM mínima de AWS (con ARN específico)
├── supabase/
│   ├── schema.sql                 # Script SQL completo (bases nuevas)
│   ├── migrations/                # Migraciones para bases ya existentes
│   └── aws-iam-policy.json        # (movido a aws/migrations/aws-iam-policy.json)
└── src/
    ├── app/
    │   ├── page.tsx               # Home / Feed (categorías + scroll infinito + filtros)
    │   ├── publicar/page.tsx      # Formulario de registro (Dueño / Rescatista)
    │   ├── perrito/[id]/page.tsx  # Detalle del reporte + "marcar como encontrada"
    │   └── api/
    │       ├── publicar-perrito/route.ts          # POST: flujo completo + matching IA
    │       ├── perritos/route.ts                  # GET: feed con paginación y filtros
    │       ├── perritos/[id]/route.ts             # GET: detalle de un reporte
    │       └── perritos/[id]/marcar-encontrada/   # POST: validar y marcar ENCONTRADA
    ├── components/                # Header, PetCard, FilterBar, PublicarForm, MatchModal…
    └── lib/                       # Supabase, Rekognition, mail (Resend), colombia, validators…
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

---

## 🤖 2. Configurar AWS Rekognition

1. Crea un usuario IAM con acceso programático y adjunta la política
   [`aws/migrations/aws-iam-policy.json`](aws/migrations/aws-iam-policy.json)
   (acción: `IndexFaces`, `SearchFacesByImage`, `DeleteFaces`, `ListFaces`,
   `CreateCollection`, `ListCollections`; el ARN está fijado a tu región y cuenta).
2. Crea la colección de caras (una sola vez) con la CLI de AWS:

   ```bash
   aws rekognition create-collection --collection-id perritos --region us-east-1
   ```

3. Anota `AWS_REKOGNITION_COLLECTION_ID=perritos` en tu `.env.local`.

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

> **Modo pruebas**: con el remitente por defecto `onboarding@resend.dev` (cuando no
> defines `EMAIL_FROM`) solo puedes enviarte correos a ti mismo desde la cuenta de Resend.
> Para correos reales a cualquier destinatario necesitas un dominio verificado.

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
| Los enlaces del correo apuntan a localhost | Define `APP_URL` con la URL pública real |