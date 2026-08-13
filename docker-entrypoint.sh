#!/bin/sh
set -e

# ============================================================================
# Entrypoint — initialize database + seed admin user + start server
# ============================================================================

echo "🔄 Initializing database schema..."
npx prisma db push --accept-data-loss 2>&1 || {
  echo "⚠️  prisma db push failed — database may already be initialized"
}

# Create a default admin user if no users exist (fresh database)
# This ensures the app is usable immediately after first deploy
echo "👤 Checking for admin user..."
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const count = await db.user.count();
  if (count === 0) {
    console.log('Creating default admin user...');
    const user = await db.user.create({
      data: {
        email: 'admin@creatoros.local',
        name: 'Admin',
        role: 'SUPER_ADMIN',
        credits: 10000,
      }
    });
    // Create default workspace
    const ws = await db.workspace.create({
      data: { name: 'CreatorOS', slug: 'creatoros', plan: 'SCALE' }
    });
    // Link user to workspace as OWNER
    await db.workspaceMember.create({
      data: { userId: user.id, workspaceId: ws.id, role: 'OWNER' }
    });
    console.log('✓ Admin user created:', user.email, '(role: SUPER_ADMIN)');
    console.log('✓ Default workspace created:', ws.name);
    console.log('');
    console.log('⚠️  IMPORTANT: Change the admin email in the app or link a Clerk account.');
    console.log('⚠️  This admin user has no password — it only works with demo auth (getDemoUser).');
    console.log('⚠️  Once Clerk is configured, sign in with Clerk and your Clerk user will be linked.');
  } else {
    console.log('✓ Users already exist (' + count + ') — skipping seed');
  }
  await db.\$disconnect();
})().catch(e => { console.error('Seed error:', e.message); process.exit(0); });
" 2>&1 || echo "⚠️ Seed check failed — continuing anyway"

echo "✅ Database ready"
echo "🚀 Starting CreatorOS on port ${PORT:-3012}..."
exec npx next start --port ${PORT:-3012}
