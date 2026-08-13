# Clerk Dashboard Configuration Guide

**For:** CreatorOS production deployment
**App ID:** `app_3HnpSZ0BhqUjsJZyiwL33KKEE2Q`
**Dashboard:** https://dashboard.clerk.com

---

## Overview

This guide walks you through every setting you need to configure in the Clerk Dashboard before going to production. CreatorOS is already fully integrated with Clerk — you just need to configure the dashboard side.

---

## Step 1 — Get Your API Keys

1. Go to **https://dashboard.clerk.com**
2. Select your app (CreatorOS)
3. Go to **API Keys** (left sidebar)
4. Copy these two values:

| Key | Environment Variable | Starts With |
|-----|---------------------|------------|
| Publishable Key | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_` or `pk_live_` |
| Secret Key | `CLERK_SECRET_KEY` | `sk_test_` or `sk_live_` |

5. Set these in your Dokploy environment variables (or `.env` file)

---

## Step 2 — Configure Redirect URLs

These tell Clerk where to send users after they sign in, sign up, or sign out.

1. Go to **Dashboard** → **User & Authentication** → **Email, Phone, Username**
2. Scroll down to **Redirect URLs** (or go to **Settings** → **Redirect URLs**)

### Required Redirect URLs

Add each of these URLs (replace `cr.sitenexai.com` with your actual domain):

| URL | Purpose |
|-----|---------|
| `https://cr.sitenexai.com` | After sign-in (return to app) |
| `https://cr.sitenexai.com/sign-in` | Sign-in page |
| `https://cr.sitenexai.com/sign-up` | Sign-up page |
| `https://cr.sitenexai.com/**` | Allow all app routes as valid redirect targets |

### Environment Variable Equivalents

These are already set in CreatorOS `.env` but you should also configure them in the Clerk dashboard:

```
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/
```

---

## Step 3 — Configure Sign-In and Sign-Up URLs

1. Go to **Dashboard** → **Settings** → **Paths**
2. Set the following:

| Setting | Value |
|---------|-------|
| Sign-in path | `/sign-in` |
| Sign-up path | `/sign-up` |
| After sign-in redirect | `/` (home page) |
| After sign-up redirect | `/` (home page) |
| After sign-out redirect | `/sign-in` |

---

## Step 4 — Account Portal (Optional but Recommended)

Clerk's Account Portal is a hosted page where users can manage their profile, security settings, and connected accounts.

1. Go to **Dashboard** → **Account Portal**
2. Click **Enable Account Portal**
3. Configure the portal:
   - **Portal URL:** Clerk will provide a URL like `https://account.clerk.com/...`
   - **Custom domain (optional):** You can point a subdomain like `account.sitenexai.com`
4. Enable the sections you want users to manage:
   - ✅ Profile (name, avatar)
   - ✅ Security (password, 2FA)
   - ✅ Connected accounts (Google, etc.)
   - ❌ Organizations (not needed for CreatorOS yet)

### How CreatorOS Uses Account Portal

The `<UserButton />` in the topbar automatically links to the Account Portal. When a user clicks their avatar → "Manage account", they'll be taken to the Clerk-hosted portal page.

---

## Step 5 — Configure Authentication Methods

1. Go to **Dashboard** → **User & Authentication** → **Email, Phone, Username**

### Recommended Settings for CreatorOS

| Method | Status | Notes |
|--------|--------|-------|
| Email address | ✅ Required | Primary identifier |
| Password | ✅ Enabled | Users can set a password |
| Google OAuth | ✅ Enabled | One-click signup |
| GitHub OAuth | ✅ Enabled | Good for developers |
| Phone number | ❌ Disabled | Not needed |
| Username | ❌ Disabled | Email is the identifier |
| Magic link | ❌ Disabled | Password is sufficient |

### To Enable Google OAuth

1. Go to **Dashboard** → **User & Authentication** → **Social Connections**
2. Click **Google**
3. Follow Clerk's guide to create a Google OAuth app:
   - Go to https://console.cloud.google.com
   - Create a new project
   - Enable Google+ API
   - Create OAuth credentials
   - Set authorized redirect URI to: `https://<your-clerk-domain>/v1/oauth/google/callback`
   - Copy Client ID + Client Secret into Clerk dashboard

---

## Step 6 — Move to Production Instance

When you're ready to go live:

1. Go to **Dashboard** → **Settings** → **Instance**
2. Click **Promote to Production**
3. Your keys will change from `pk_test_` / `sk_test_` to `pk_live_` / `sk_live_`
4. Update your Dokploy environment variables with the **live** keys

### What Changes in Production

| Test Mode | Production Mode |
|-----------|----------------|
| `pk_test_...` / `sk_test_...` | `pk_live_...` / `sk_live_...` |
| "Development mode" banner on sign-in | No banner |
| Telemetry data collected | No telemetry |
| Up to 10,000 monthly users free | Paid plan required |
| Test users only | Real users |

---

## Step 7 — Configure Allowed Origins (CORS)

1. Go to **Dashboard** → **Settings** → **Allowed Origins**
2. Add your production domain:

```
https://cr.sitenexai.com
```

This prevents CORS errors when Clerk's JavaScript SDK makes requests from your domain.

---

## Step 8 — Webhooks (Optional — for Phase D)

Webhooks let CreatorOS know when user events happen (sign-up, sign-in, profile update, deletion).

1. Go to **Dashboard** → **Webhooks**
2. Click **Add Endpoint**
3. Set endpoint URL: `https://cr.sitenexai.com/api/webhooks/clerk`
4. Select events to listen for:
   - `user.created` — Create CreatorOS User record
   - `user.updated` — Update name/avatar
   - `user.deleted` — Soft-delete or anonymize
5. Copy the **Signing Secret** and add to your env:
   ```
   CLERK_WEBHOOK_SECRET=whsec_xxxxx
   ```

**Note:** The webhook endpoint doesn't exist yet in CreatorOS (Phase D). You can skip this step for now — the `getCurrentUser()` identity bridge in `src/lib/auth.ts` handles user linking without webhooks.

---

## Step 9 — Email Configuration (Optional)

By default, Clerk sends emails from their domain. For a branded experience:

1. Go to **Dashboard** → **Settings** → **Emails**
2. Click **Connect SMTP**
3. Configure with your email provider (SendGrid, Postmark, etc.)
4. Set:
   - **From email:** `noreply@sitenexai.com`
   - **From name:** `CreatorOS`
5. Verify the domain

### Emails Clerk Sends

| Email | Trigger |
|-------|---------|
| Welcome email | New user signs up |
| Email verification | User signs up with email |
| Password reset | User clicks "Forgot password" |
| Email change | User changes their email |

---

## Step 10 — Custom Sign-In/Sign-Up Page (Optional)

CreatorOS already has custom Clerk sign-in/sign-up pages at `/sign-in` and `/sign-up`. If you want Clerk to host them instead:

1. Go to **Dashboard** → **Account Portal** → **Sign In**
2. Enable **Hosted Sign-In Page**
3. Set the redirect URL to `https://cr.sitenexai.com`

**Recommendation:** Keep using the built-in `<SignIn />` / `<SignUp />` components in CreatorOS — they render on your domain and match your theme.

---

## Environment Variables Summary

Set ALL of these in Dokploy (or your `.env` file):

```env
# Required — get from Clerk Dashboard → API Keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_or_live_key
CLERK_SECRET_KEY=sk_test_or_live_key

# Redirect URLs (already set in CreatorOS, but document here)
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Webhook (optional — Phase D)
CLERK_WEBHOOK_SECRET=whsec_xxxxx
```

---

## Pre-Production Checklist

Before going live:

- [ ] API keys set in Dokploy (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
- [ ] Redirect URLs configured in Clerk dashboard (include your domain)
- [ ] Sign-in path set to `/sign-in` in Clerk dashboard
- [ ] Sign-up path set to `/sign-up` in Clerk dashboard
- [ ] Allowed origins includes `https://cr.sitenexai.com`
- [ ] Google OAuth enabled (if desired)
- [ ] At least one test user created in development mode
- [ ] Sign-in flow tested end-to-end
- [ ] Sign-up flow tested end-to-end
- [ ] UserButton (avatar) shows after sign-in
- [ ] Sign-out works from UserButton
- [ ] `/api/auth/me` returns user data after sign-in
- [ ] Promoted to production instance (when ready)
- [ ] Live keys set in Dokploy (replace test keys)

---

## How CreatorOS Uses Clerk

```
User visits https://cr.sitenexai.com
  ↓
Clerk proxy.ts runs (establishes session)
  ↓
User clicks "Sign in" in topbar
  ↓
<SignIn /> modal opens (Clerk-hosted component)
  ↓
User signs in with email/password or Google
  ↓
Clerk creates session → redirects to /
  ↓
Topbar shows UserButton (avatar) instead of Sign in/Sign up
  ↓
User clicks avatar → Account Portal (manage profile)
  ↓
API calls use Clerk session → getCurrentUser() resolves CreatorOS User
```

### What Clerk Owns
- User identity (email, name, avatar)
- Authentication (login, signup, passwords, OAuth)
- Sessions (cookies, tokens)
- Account Portal (profile management)

### What CreatorOS Owns
- User.role (SUPER_ADMIN, MEMBER)
- User.credits
- Workspace membership
- All business data (courses, products, orders, community, AI)
- Authorization decisions (requireSuperAdmin, RBAC)

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Missing environment variables" on sign-in page | Set `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` |
| Sign-in works but redirects to wrong URL | Check Redirect URLs in Clerk dashboard + `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` |
| "Development mode" banner | Promote to production instance in Clerk dashboard |
| Google OAuth not working | Configure Google OAuth in Clerk dashboard + Google Cloud Console |
| CORS errors | Add domain to Allowed Origins in Clerk dashboard |
| UserButton not showing after sign-in | Check browser console for Clerk errors; verify `ClerkProvider` is in layout |
| `/api/auth/me` returns 401 after sign-in | Verify `CLERK_SECRET_KEY` is set correctly |
| Styles look wrong on sign-in page | Verify `@clerk/ui` is installed and `shadcn.css` is imported |
