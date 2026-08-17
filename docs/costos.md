# 💰 Patitas SOS — Costos (2026)

La plataforma está diseñada para operar con **pocos dólares al mes**: el match
"instantáneo" compara todos los candidatos del rol opuesto (hasta 300) con Gemini
Flash por cada publicación, y el resto (Brevo, Supabase y Vercel) vive dentro de los
free tiers. Con un ritmo de 1 publicación/día el modelo por defecto sale por
**~US$7,2/mes**; usando Flash Lite baja a **~US$1,2/mes**.

> ⚠️ **Free tier vs. key pagada (importante para el modo "match de una")**:
> una API key **sin billing** limita `gemini-3.5-flash` a **~5 llamadas por minuto**
> y a una **cuota diaria** (se renueva a la 02:00 a. m. hora Colombia). Con 100
> candidatos eso alarga el escaneo a ~20 min y puede cortarlo a mitad del día. El
> "match de una" real (segundos/minutos) requiere un proyecto de Gemini **con
> billing habilitado**; es lo que recomienda `docs/DEPLOY.md` para el despliegue
> definitivo.

## Tabla de precios oficial (medio 2026, USD)

> Verifica siempre en las páginas oficiales antes de decidir (enlaces al final).
> Los tokens de imagen cuentan como tokens: una foto comprimida de ~200 KB equivale
> a **~500 tokens** de entrada para el modelo.

| Servicio | Qué hace | Free | Tarifa pagada (por millón de tokens) |
|---|---|---|---|
| **Gemini 3.5 Flash** (default de la app) | Compara fotos de mascotas | Límite diario sin tarjeta (decenas de publicaciones/día) | **$1,50 entrada / $9,00 salida** |
| **Gemini 3.1 Flash Lite** (el más barato) | Ídem, calidad ligeramente menor | Ídem | **$0,25 entrada / $1,50 salida** |
| **Brevo** | Correos de aviso de coincidencias | **300 correos/día (≈9.000/mes) para siempre**, sin tarjeta | Starter: ~USD 9/mes |
| **Supabase** | Postgres + Storage + RLS | Free tier del proyecto | Pro según uso |
| **Vercel** | Hosting del Next.js (frontend + API Routes) | **Hobby: free** (100 GB/h de funciones, límites sanos) | Pro ~USD 20/mes |

### Costo por comparación (2 fotos)

- Una comparación envía **~1.100 tokens** (2 fotos + prompt + instrucciones) y recibe
  **~80 tokens** de JSON (`{es_mismo, similitud, razon}`).
- **3.5 Flash**: 1.100 × $1,50/M + 80 × $9,00/M ≈ **US$0,0024 / comparación**.
- **3.1 Flash Lite**: 1.100 × $0,25/M + 80 × $1,50/M ≈ **US$0,0004 / comparación**.

## 🔢 Simulación mensual real

Supongamos **30 publicaciones al mes** (una por día) comparando **~100 candidatos
cada una** (el volumen real de un MVP: menos de 300 publicaciones totales):

- **Gemini**: 30 × 100 = 3.000 comparaciones → **~US$7,2/mes** con 3.5 Flash
  (COP ≈ 30.000) o **~US$1,2/mes** con 3.1 Flash Lite.
- **Brevo**: cada match = 2 correos. Con 10 matches/mes = 20 correos de 300/día. **$0**.
- **Supabase**: fotos comprimidas ≤ 200 KB y pocas filas. **$0**.
- **Vercel**: Hobby gratis. **$0**.

**Total: ~US$7,2/mes con el modelo por defecto** (o ~US$1,2 con Flash Lite).

## 📈 Escenarios de crecimiento

El costo es proporcional a LOS CANDIDATOS, no a las publicaciones: cada publicación
compara todos los del rol opuesto (hasta 300). Con **300 publicaciones totales** en
el país y **un promedio de ~100 candidatos por publicación**:

| Volumen | Comparaciones/mes | 3.5 Flash (default) | 3.1 Flash Lite (barato) |
|---|---|---|---|
| MVP: 30 pubs/mes | ~3.000 | **US$7,2/mes** | ~US$1,2/mes |
| 3 pubs/día (90/mes) | ~9.000 | **US$21,6/mes** | ~US$3,6/mes |
| 5 pubs/día (150/mes) | ~15.000 | **US$36/mes** | ~US$6/mes |
| Tope absoluto (1.500 llamadas/día) | ~45.000 | **US$108/mes** (peor caso) | ~US$18/mes |

- **Brevo**: 300/día (9.000/mes) gratis alcanzan para 4.500 matches/mes; más → Starter ~USD 9/mes.
- **Supabase**: Pro ~USD 25/mes si se pasa el free tier de storage/bandwidth.
- **Vercel**: Pro ~USD 20/mes si se pasa Hobby.

## ⚙️ Cómo se controlan los costos hoy

Todo vive en `src/lib/constants.ts` (una línea cada uno):

| Constante | Valor | Efecto |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.5-flash` | Cambia al modelo (o a `gemini-3.1-flash-lite` para el más barato) |
| `GEMINI_MAX_CANDIDATOS_PUBLICACION` | 300 | **Al publicar** compara TODO el rol opuesto de la misma especie (match "de una") — bajar a 100-150 reduce el costo ~2-3× |
| `GEMINI_MAX_CANDIDATOS` | 12 | Candidatos por reporte en el cron diario (respaldo) |
| `GEMINI_LOTE_PARALELO` | 16 | Comparaciones en paralelo por lote (con API key pagada hay RPM de sobra) |
| `GEMINI_LIMITE_DIARIO` | 1500 | Tope de llamadas Gemini por día (publicación + cron; ~US$3,6/día peor caso con 3.5 Flash) |
| `GEMINI_MATCH_THRESHOLD` | 80 | Umbral de match (más alto = menos avisos, mismas llamadas) |

## 📌 Reglas de oro

1. **La publicación cuesta como mucho ~US$0,72** (300 comparaciones × US$0,0024 con 3.5
   Flash; ~US$0,12 con Flash Lite; con ~100 candidatos reales ≈ US$0,24). Si falta la
   API key o gemini falla, el reporte se guarda igual (costo $0) y la revisión diaria lo
   intenta después. Los candidatos se filtran por la misma especie: un perro nunca se
   compara contra gatos, así que ninguna llamada se desperdicia en cruces imposibles.
2. La revisión diaria entra en el **mismo presupuesto de 1.500 llamadas/día**: no hay
   llamadas dobles (la tabla `comparaciones` deduplica cada par en ambas direcciones).
   El cron barre los reportes de los últimos 14 días (hasta 80 por ejecución, 12
   candidatos por reporte) dentro de ese mismo tope.
3. Si el límite diario se alcanza, el cron simplemente procesa menos y retoma al día
   siguiente; el fallo nunca bloquea la app.

## 🔗 Referencias oficiales (verificar precios antes de decidir)

- Gemini (por modelo): https://ai.google.dev/gemini-api/docs/pricing (API key: https://aistudio.google.com/apikey)
- Brevo: https://brevo.com/pricing (plan gratis: 300 correos/día, forever free)
- Supabase: https://supabase.com/pricing (free tier del proyecto)
- Vercel: https://vercel.com/pricing (Hobby: free tier)