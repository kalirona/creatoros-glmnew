# ============================================================================
# Dockerfile — CreatorOS (Next.js 16 standalone + Prisma + Bun)
# ----------------------------------------------------------------------------
# Multi-stage build for minimal production image.
# Uses Bun for install + build, Node.js for runtime (standalone output).
# ============================================================================

# ─── Stage 1: Install dependencies + build ──────────────────────────────────
FROM oven/bun:1.1 AS builder
WORKDIR /app

# Copy package files + Prisma schema first
# (postinstall script runs prisma generate, which needs the schema)
COPY package.json bun.lock* ./
COPY prisma ./prisma

# Install dependencies
# --ignore-scripts skips postinstall (we run prisma generate explicitly below)
# to avoid race conditions with schema not being available
RUN bun install --ignore-scripts

# Generate Prisma client (now schema is available)
RUN bunx prisma generate

# Copy all source files
COPY . .

# Set build-time environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js standalone output
# The build script runs: next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
RUN bun run build

# Verify the standalone build exists
RUN ls -la .next/standalone/server.js || (echo "ERROR: standalone build failed" && exit 1)

# ─── Stage 2: Production runtime ────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
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

EXPOSE 3000

# Health check using wget (more reliable than node fetch in slim images)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/ai/features || exit 1

# Start the standalone server
CMD ["node", "server.js"]
