// ============================================================================
// SUPER_ADMIN Bootstrap Script
// ----------------------------------------------------------------------------
// Run this script to assign SUPER_ADMIN role to an existing CreatorOS user.
//
// Usage:
//   bun run scripts/assign-superadmin.ts <email>
//
// Example:
//   bun run scripts/assign-superadmin.ts preet@gmail.com
//
// The user MUST already exist in the database (created by signing in via Clerk
// first). This script does NOT create users — it only updates the role.
// ============================================================================

import { db } from '../src/lib/db'

async function main() {
  const email = process.argv[2]
  if (!email) {
    console.error('Usage: bun run scripts/assign-superadmin.ts <email>')
    process.exit(1)
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    console.error(`User not found: ${email}`)
    console.error('The user must sign in via Clerk first to create their CreatorOS account.')
    process.exit(1)
  }

  console.log(`Current user: ${user.name} (${user.email})`)
  console.log(`Current role: ${user.role}`)

  if (user.role === 'SUPER_ADMIN') {
    console.log('User is already SUPER_ADMIN — no changes needed.')
    process.exit(0)
  }

  await db.user.update({
    where: { id: user.id },
    data: { role: 'SUPER_ADMIN' },
  })

  console.log(`✓ Assigned SUPER_ADMIN role to ${user.name} (${user.email})`)
  console.log(`  User ID: ${user.id}`)
  console.log(`  Clerk ID: ${user.clerkId || '(not linked yet)'}`)
  console.log('')
  console.log('The user can now access /superadmin after signing in.')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
