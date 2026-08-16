# ============================================================
# 🐾 PATITAS SOS — Dockerfile (multi-stage optimizado)
#
# Build:
#   docker compose up --build -d
# o bien:
#   docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=... -t patitas-sos .
# ============================================================

# ---------- Etapa base ----------
FROM node:22-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- Etapa 1: instalar dependencias ----------
FROM base AS deps
COPY package.json package-lock.json ./
# Usa la caché de npm del host (contexto adicional `npm_cache`) para no
# descargar todo desde el registry: red inestable (ECONNRESET) tolerada.
COPY --from=npm_cache /_cacache /root/.npm/_cacache
RUN npm ci --frozen-lockfile \
  --prefer-offline \
  --fetch-retries=5 \
  --fetch-retry-mintimeout=20000 \
  --fetch-retry-maxtimeout=120000 \
  --fetch-timeout=600000

# ---------- Etapa 2: compilar la app ----------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Las variables NEXT_PUBLIC_* se incrustan en el bundle del cliente
# durante el build (las demás se leen en runtime desde el entorno).
ARG NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL

RUN npm run build

# ---------- Etapa 3: imagen de runtime ----------
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario sin privilegios por seguridad
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Solo lo que necesita la salida "standalone" de Next.js
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
