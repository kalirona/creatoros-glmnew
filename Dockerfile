# ============================================================================
# Dockerfile — CreatorOS (Next.js 16 + Prisma)
# ----------------------------------------------------------------------------
# Full build (not standalone) — ensures all dependencies including Prisma CLI
# are available at runtime for database initialization.
# ============================================================================

# ─── Stage 1: Install dependencies (Bun — fast install) ─────────────────────
FROM oven/bun:1.3 AS deps
WORKDIR /app

COPY package.json bun.lock* ./
COPY prisma ./prisma

RUN bun install --ignore-scripts

# ─── Stage 2: Build (Node.js — needed for worker_threads + webpack) ─────────
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/bun.lock* ./

COPY prisma ./prisma
RUN npx prisma generate

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js (no standalone — we need full node_modules at runtime)
RUN npx next build --webpack

# ─── Stage 3: Production runtime ────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3012
ENV HOSTNAME=0.0.0.0

# Install openssl (needed by Prisma) + wget (healthcheck)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    wget \
  && rm -rf /var/lib/apt/lists/*

# Copy everything needed for runtime
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/next.config.ts ./next.config.ts

# Copy entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Create data directory
RUN mkdir -p /app/db

EXPOSE 3012

HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3012/api/ai/features || exit 1

# Entrypoint: initialize DB schema, then start Next.js
CMD ["./docker-entrypoint.sh"]
