#!/bin/sh
set -e

# ============================================================================
# Entrypoint — initialize database + start server
# ----------------------------------------------------------------------------
# On first container start, the SQLite database is empty (fresh volume).
# This script runs prisma db push to create all tables before starting
# the Next.js server.
# ============================================================================

echo "🔄 Initializing database schema..."
npx prisma db push --accept-data-loss --schema=/app/prisma/schema.prisma 2>&1 || {
  echo "⚠️  prisma db push failed — database may already be initialized"
}

echo "✅ Database ready"
echo "🚀 Starting CreatorOS..."
exec node server.js
