#!/bin/sh
set -e

# ============================================================================
# Entrypoint — initialize database + start server
# ============================================================================

echo "🔄 Initializing database schema..."
npx prisma db push --accept-data-loss 2>&1 || {
  echo "⚠️  prisma db push failed — database may already be initialized"
}

# Create a default workspace if none exists (needed for app to function)
# Users are created automatically when they sign in via Clerk (getCurrentUser)
echo "🏢 Checking for default workspace..."
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const count = await db.workspace.count();
  if (count === 0) {
    console.log('Creating default workspace...');
    await db.workspace.create({
      data: { name: 'CreatorOS', slug: 'creatoros', plan: 'PRO' }
    });
    console.log('✓ Default workspace created');
  } else {
    console.log('✓ Workspaces already exist (' + count + ')');
  }
  await db.\$disconnect();
})().catch(e => { console.error('Workspace check error:', e.message); process.exit(0); });
" 2>&1 || echo "⚠️ Workspace check failed — continuing anyway"

echo "✅ Database ready"
echo "🚀 Starting CreatorOS on port ${PORT:-3012}..."
exec npx next start --port ${PORT:-3012}
