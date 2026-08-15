// ============================================================================
// Clerk Middleware — Phase B (Foundation)
// ----------------------------------------------------------------------------
// Establishes Clerk integration WITHOUT forcing authentication on the existing
// demo application. The middleware runs on every request but does NOT call
// auth.protect(), so the existing CreatorOS app remains fully accessible.
//
// Architecture after Phase B:
//   Browser → Clerk Middleware (passthrough) → Existing CreatorOS app
//
// Phase D will add route protection (auth.protect()) to specific routes.
// Clerk is the only authentication source. Demo identity has been removed.
// ============================================================================

import { clerkMiddleware } from '@clerk/nextjs/server'

export default clerkMiddleware(async () => {
  // No auth.protect() here — the existing demo app must remain accessible.
  // Clerk middleware establishes the Clerk session context so that Clerk
  // components (<SignIn />, <SignUp />, <ClerkProvider>) work, but does
  // not block any requests.
  //
  // Phase D will add route-specific protection:
  //   createRouteMatcher([...protectedRoutes]) + auth.protect()
})

export const config = {
  // Match all routes except static assets and Next.js internals
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot)$).*)',
    '/',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
}
