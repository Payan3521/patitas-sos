# 💰 Patitas SOS — Costos (2026)

La plataforma está diseñada para operar **sin pagar nada** o con **centavos al mes**:
la IA (Gemini Flash) y los correos (Brevo) tienen planes gratis para siempre, y el
resto (Supabase + Vercel) vive dentro de los free tiers.

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

Supongamos **30 publicaciones al mes** (una por día), el ritmo de un MVP:

- **Gemini**: 30 publicaciones × 12 comparaciones = 360 consultas → **US$0,86/mes pagado**
  con 3.5 Flash (COP ≈ 3.600)… o **$0** si el día sigue dentro del free tier
  (1 publicación/día usa 12 llamadas, muy por debajo del límite diario).
- **Brevo**: cada match = 2 correos. Con 10 matches/mes = 20 correos de 300/día. **$0**.
- **Supabase**: fotos comprimidas ≤ 200 KB y pocas filas. **$0**.
- **Vercel**: Hobby gratis. **$0**.

**Total con free tiers: $0/mes** — y si algún día se paga, ~**US$0,86/mes**.

## 📈 Escenarios de crecimiento

| Volumen | Comparaciones/mes | 3.5 Flash (default) | 3.1 Flash Lite (barato) |
|---|---|---|---|
| MVP: 30 pubs/mes | 360 | ~US$0,86/mes ($0 con free tier) | ~US$0,14/mes |
| 100 pubs/día (3.000/mes) | 36.000 | ~**US$86/mes** (gratis si el free tier aguanta) | ~US$14/mes |
| 1.000 pubs/día | 360.000 | ~US$864/mes | ~US$144/mes |

- **Brevo**: 300/día (9.000/mes) gratis alcanzan para 4.500 matches/mes; más → Starter ~USD 9/mes.
- **Supabase**: Pro ~USD 25/mes si se pasa el free tier de storage/bandwidth.
- **Vercel**: Pro ~USD 20/mes si se pasa Hobby.

## ⚙️ Cómo se controlan los costos hoy

Todo vive en `src/lib/constants.ts` (una línea cada uno):

| Constante | Valor | Efecto |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.5-flash` | Cambia al modelo (o a `gemini-3.1-flash-lite` para el más barato) |
| `GEMINI_MAX_CANDIDATOS` | 12 | Comparaciones por publicación (y por reporte en el cron) |
| `GEMINI_LOTE_PARALELO` | 4 | No satura el límite de RPM del free tier |
| `GEMINI_LIMITE_DIARIO` | 200 | Tope de llamadas del cron diario (margen sobre el free tier) |
| `GEMINI_MATCH_THRESHOLD` | 80 | Umbral de match (más alto = menos avisos, mismas llamadas) |

## 📌 Reglas de oro

1. **La publicación nunca cuesta más de 12 comparaciones.** Si falta la API key o gemini
   falla, el reporte se guarda igual (costo $0) y la revisión diaria lo intenta después.
2. La revisión diaria entra en el **mismo presupuesto de 200 llamadas/día**: no hay llamadas
   dobles (la tabla `comparaciones` deduplica cada par en ambas direcciones).
3. Si el free tier de Gemini se queda corto algún día, el cron simplemente procesa menos
   y retoma al día siguiente; el fallo nunca bloquea la app.

## 🔗 Referencias oficiales (verificar precios antes de decidir)

- Gemini (por modelo): https://ai.google.dev/gemini-api/docs/pricing (API key: https://aistudio.google.com/apikey)
- Brevo: https://brevo.com/pricing (plan gratis: 300 correos/día, forever free)
- Supabase: https://supabase.com/pricing (free tier del proyecto)
- Vercel: https://vercel.com/pricing (Hobby: free tier)