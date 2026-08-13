// ============================================================================
// Clerk Sign-In Page — Phase B (Foundation)
// ----------------------------------------------------------------------------
// Renders Clerk's <SignIn /> component. No custom login UI, no password
// handling, no session logic. Clerk owns the entire authentication flow.
//
// User synchronization (linking Clerk users to CreatorOS User records) is
// Phase C — this page does NOT create or modify any database records.
// ============================================================================

import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SignIn
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
