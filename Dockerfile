# ============================================================================
# Dockerfile — CreatorOS (Next.js 16 standalone + Prisma)
# ----------------------------------------------------------------------------
# Multi-stage build:
#   Stage 1 (bun:1.3): Install dependencies (fast, matches local lockfile)
#   Stage 2 (node:20): Build Next.js (Node.js needed for worker_threads)
#   Stage 3 (node:20-slim): Production runtime
# ============================================================================

# ─── Stage 1: Install dependencies (Bun — fast install) ─────────────────────
# Use bun:1.3 to match local bun 1.3.x lockfile format (JSON, not binary)
FROM oven/bun:1.3 AS deps
WORKDIR /app

# Copy package files + Prisma schema first
COPY package.json bun.lock* ./
COPY prisma ./prisma

# Install dependencies (skip postinstall — we generate Prisma in stage 2)
RUN bun install --ignore-scripts

# ─── Stage 2: Build (Node.js — needed for worker_threads + webpack) ─────────
FROM node:20-slim AS builder
WORKDIR /app

# Copy installed dependencies from Bun stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/bun.lock* ./

# Copy Prisma schema + generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy all source files
COPY . .

# Set build-time environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js standalone output using webpack (not Turbopack)
# Using npx next build ensures Node.js runs the build, not Bun
RUN npx next build --webpack

# Copy static files + public into standalone (required for standalone output)
RUN cp -r .next/static .next/standalone/.next/ && \
    cp -r public .next/standalone/

# Verify the standalone build exists
RUN ls -la .next/standalone/server.js || (echo "ERROR: standalone build failed" && exit 1)

# ─── Stage 3: Production runtime ────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3012
ENV HOSTNAME=0.0.0.0

# Install openssl (needed by Prisma on slim images)
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    wget \
  && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the standalone build (includes server.js + minimal node_modules)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma client files (not included in standalone by default)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Create data directory for SQLite with correct ownership
RUN mkdir -p /app/db && chown nextjs:nodejs /app/db

# Switch to non-root user
USER nextjs

EXPOSE 3012

# Health check using wget
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3012/api/ai/features || exit 1

# Start the standalone server (Node.js, not Bun — for production stability)
CMD ["node", "server.js"]
