// ============================================================================
// Clerk Sign-Up Page — Phase B (Foundation)
// ----------------------------------------------------------------------------
// Renders Clerk's <SignUp /> component. No custom registration logic, no
// database user creation. Clerk owns the entire signup flow.
//
// User synchronization (creating CreatorOS User records from Clerk users) is
// Phase C — this page does NOT create or modify any database records.
// ============================================================================

import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'shadow-xl',
          },
        }}
      />
    </div>
  )
}
