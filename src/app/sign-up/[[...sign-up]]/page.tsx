// ============================================================================
// Clerk Sign-Up Page
// ----------------------------------------------------------------------------
// Renders Clerk's <SignUp /> component with redirect to / after signup.
// Clerk handles the entire registration flow.
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
        routing="path"
        path="/sign-up"
        fallbackRedirectUrl="/"
        forceRedirectUrl="/"
      />
    </div>
  )
}
