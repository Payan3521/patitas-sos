# 🐾 Patitas SOS

**Plataforma de ayuda humanitaria post-terremoto**: conecta a las personas que perdieron a sus
perritos con quienes los encontraron o rescataron. Usa **AWS Rekognition** para cruzar las fotos
de los rostros al momento de publicar y avisar al instante cuando hay una coincidencia.

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
| Despliegue | **Docker** (multi-stage + docker-compose) |

---

## 📁 Estructura del proyecto

```
├── Dockerfile                     # Multi-stage, salida standalone
├── docker-compose.yml             # Expone la app en :3000 y mapea las variables
├── supabase/
│   ├── schema.sql                 # Script SQL listo para el editor de Supabase
│   └── aws-iam-policy.json        # Política IAM mínima de AWS
└── src/
    ├── app/
    │   ├── page.tsx               # Home / Feed (scroll infinito + filtros)
    │   ├── publicar/page.tsx      # Formulario de registro (Dueño / Rescatista)
    │   └── api/
    │       ├── publicar-perrito/route.ts   # POST: flujo completo + matching IA
    │       ├── perritos/route.ts           # GET: feed con paginación y filtros
    │       └── ciudades/route.ts           # GET: ciudades para filtros
    ├── components/                # Header, PetCard, FilterBar, PublicarForm, MatchModal
    └── lib/                       # Supabase, Rekognition, validators, imagen, tipos
```

---

## 🔐 Variables de entorno

Copia `.env.local.example` → `.env.local` y completa los valores:

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL pública del proyecto Supabase (se incrusta en el frontend) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Llave anónima (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave maestra. **Solo se usa en las API Routes** (nunca en el navegador) |
| `AWS_ACCESS_KEY_ID` | Credencial de AWS |
| `AWS_SECRET_ACCESS_KEY` | Credencial secreta de AWS |
| `AWS_REGION` | Región de la colección (ej: `us-east-1`) |
| `AWS_REKOGNITION_COLLECTION_ID` | Nombre de la colección de Rekognition (ej: `perritos`) |

---

## 🗄️ 1. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Ve a **SQL Editor**, pega el contenido de `supabase/schema.sql` y ejecútalo.
   Crea las tablas `usuarios`, `perritos` y `matches_ia`, los ENUMs, índices y las políticas RLS.
3. Crea el bucket público: **Storage → New bucket → name: `fotos-perritos` → marcar "Public bucket" → Create**.
4. Copia la URL y las llaves desde **Settings → API** a tu `.env.local`.

> Las escrituras se hacen siempre desde el servidor con la `service role key` (salta la RLS).
> La RLS solo blinda el acceso directo y permite leer el feed de reportes ACTIVOS.

---

## 🤖 2. Configurar AWS Rekognition

1. Crea un usuario IAM con acceso programático y adjunta la política
   [`supabase/aws-iam-policy.json`](supabase/aws-iam-policy.json)
   (permisos: `IndexFaces`, `SearchFacesByImage`, `DeleteFaces`, `ListFaces`).
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
> de Next.js. Las variables secretas (`SUPABASE_SERVICE_ROLE_KEY`, AWS…) se inyectan
> en tiempo de ejecución desde el entorno del contenedor.

---

## ⚙️ Lógica de negocio — `POST /api/publicar-perrito`

Flujo unificado para Dueño (`PERDIDO`) y Rescatista (`BUSCA_DUEÑO`):

1. **Recibe** el formulario + foto (`multipart/form-data`).
2. **Comprime** la foto en el cliente (canvas) hasta ≤ **200 KB**; el servidor valida el tamaño.
3. **Sube** la imagen al bucket público `fotos-perritos` y obtiene su URL.
4. **`IndexFacesCommand`** registra la cara en la colección → obtiene un `FaceId`.
   Si no detecta cara, responde un error amigable pidiendo otra foto clara.
5. **Guarda** el reporte en `perritos` (con `aws_face_id` y `foto_url`).
6. **`SearchFacesByImageCommand`** con umbral **85.0%** busca coincidencias.
7. Si encuentra un **match válido** (rol opuesto + reporte ACTIVO):
   - Registra el evento en `matches_ia` y marca ambos como `RECONCILIADO`.
   - Responde `{ "match": true, "matchInfo": { perrito, usuario, porcentaje_similitud } }`
     con los datos de contacto de la contraparte.

### Otras API Routes

- `GET /api/perritos?ciudad=&barrio=&rol=&page=&pageSize=` — feed paginado de reportes ACTIVOS.
- `GET /api/ciudades` — lista de ciudades para los filtros y el autocompletado.

---

## 🎨 Interfaz

- **`/` — Home / Feed**: scroll infinito, filtros por ciudad/barrio y categoría
  (Perdidos / Rescatados), tarjetas con foto grande, descripción, zona y botón
  directo a WhatsApp (`https://wa.me/…`).
- **`/publicar` — Formulario**: pestañas *"Perdí a mi mascota"* / *"Encontré una mascota"*,
  campos de contacto, descripción, zona exacta y botón grande para activar la cámara
  o subir la foto. Al detectar un match, la pantalla se **congela** y aparece el
  **modal de éxito gigante**: *"¡LA IA ENCONTRÓ UNA COINCIDENCIA!"* con la foto del
  otro reporte, los datos de la contraparte y botones de llamada / WhatsApp.

---

## 🧠 Decisiones técnicas

- **Compresión en el cliente**: se reduce calidad y dimensiones con `<canvas>` hasta
  ≤ 200 KB antes de subir (ahorra almacenamiento gratuito de Supabase y cumple el
  límite de AWS).
- **Foto del rostro**: se pide "de frente y con buena luz"; Rekognition requiere una
  cara mínima detectable para generar el `FaceId`.
- **Auto-coincidencia**: al buscar, se excluye el `ExternalImageId` del reporte recién
  creado para no matchear consigo mismo.
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
