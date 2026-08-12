# ============================================================================
# Dockerfile — CreatorOS (Next.js 16 standalone + Prisma + Bun)
# ----------------------------------------------------------------------------
# Multi-stage build for minimal production image.
# Uses Bun for install + build, Node.js for runtime (standalone output).
# ============================================================================

# ─── Stage 1: Install dependencies ──────────────────────────────────────────
FROM oven/bun:1.1 AS deps
WORKDIR /app

# Copy lockfile + package.json first for cache
COPY package.json bun.lock ./

# Install ALL dependencies (including devDeps for build)
RUN bun install --frozen-lockfile

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN bunx prisma generate

# ─── Stage 2: Build the app ─────────────────────────────────────────────────
FROM oven/bun:1.1 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set build-time env (no secrets needed at build — Clerk keys are runtime only)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build the standalone output
RUN bun run build

# ─── Stage 3: Production runtime ────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install openssl (needed by Prisma on slim images) + sqlite3 for debugging
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy the standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy Prisma files for runtime schema
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Create data directory for SQLite
RUN mkdir -p /app/db && chown nextjs:nodejs /app/db

# Switch to non-root user
USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/ai/features').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start the standalone server
CMD ["node", "server.js"]
