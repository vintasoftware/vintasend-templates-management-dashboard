# Auth Architecture Notes

## Overview

The dashboard uses a strategy pattern to keep authentication provider logic
isolated from the app shell. The strategy is resolved at runtime using the
`AUTH_PROVIDER` environment variable and provides a consistent API for the rest
of the app.

## Supported Providers

- **Clerk**: Uses Clerk's SDK and components with routes at `/sign-in` and `/sign-out`
- **Auth0 v4**: Uses Auth0's Next.js SDK v4 with auto-mounted routes at `/auth/*`

## Request Flow

### Clerk

- `proxy.ts` uses `clerkMiddleware()` to wrap the request handler
- Protected routes redirect to `/sign-in` if unauthenticated
- `app/layout.tsx` wraps the app with `ClerkProvider`
- Client components use Clerk's hooks or the unified `useAuth()`

### Auth0 v4

- `proxy.ts` calls `auth0.middleware(request)` which auto-mounts auth routes at `/auth/*`
- Routes like `/auth/login`, `/auth/logout`, `/auth/callback` are handled automatically
- The middleware checks sessions using `auth0.getSession(request)` for protected routes
- `app/layout.tsx` wraps the app with `Auth0Provider` from the client package
- Client components use `useAuth()` to access auth state
- No API route handlers needed - everything is handled by the middleware

### Shared Flow

- `app/layout.tsx` resolves the strategy, wraps the app in the provider
  component, and initializes the `AuthProvider` context for client components.
- Client components consume auth state via `useAuth()`.

## Auth0 v4 Architecture

Auth0 v4 introduces a centralized `Auth0Client` instance defined in `lib/auth0.ts`.
This client:

- Automatically mounts authentication routes via `auth0.middleware()`
- Manages sessions and rolling session updates
- Provides `getSession()` for server-side session access
- No longer requires API route handlers like v3 did

## Adding a New Provider

1. Implement the `AuthStrategy` interface in `lib/auth/strategies`.
2. Register the new strategy in `resolveAuthStrategy()`.
3. Update `proxy.ts` to handle the new provider's middleware requirements.
4. Document the new environment variables in `.env.example` and
   the dashboard `README.md`.
5. Add provider-specific setup instructions to the main README.

## Client Usage

Use `useAuth()` in client components to access `user`, `isAuthenticated`, and
sign-in/sign-out URLs provided by the current strategy.

## Important Notes

- **Auth0 v4 Migration**: The implementation uses Auth0 SDK v4, which has breaking
  changes from v3. Route prefixes changed from `/api/auth/*` to `/auth/*`, and
  environment variables were renamed (`AUTH0_BASE_URL` → `APP_BASE_URL`,
  `AUTH0_ISSUER_BASE_URL` → `AUTH0_DOMAIN`).
- **Middleware**: Named `proxy.ts` following Next.js convention (not `middleware.ts`).
- **Session Management**: Auth0 v4 handles rolling sessions automatically in middleware.
