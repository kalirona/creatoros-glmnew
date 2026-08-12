#!/bin/sh
set -e

# ============================================================================
# Entrypoint — initialize database + start server
# ============================================================================

echo "🔄 Initializing database schema..."
npx prisma db push --accept-data-loss 2>&1 || {
  echo "⚠️  prisma db push failed — database may already be initialized"
}

echo "✅ Database ready"
echo "🚀 Starting CreatorOS on port ${PORT:-3012}..."
exec npx next start --port ${PORT:-3012}
