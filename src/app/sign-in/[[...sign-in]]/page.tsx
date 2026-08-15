// ============================================================================
// Clerk Sign-In Page
// ----------------------------------------------------------------------------
// Renders Clerk's <SignIn /> component with redirect to / after login.
// Clerk handles the entire authentication flow.
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
        routing="path"
        path="/sign-in"
        fallbackRedirectUrl="/"
        forceRedirectUrl="/"
      />
    </div>
  )
}
