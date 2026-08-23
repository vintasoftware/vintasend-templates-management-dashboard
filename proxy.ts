import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { auth0 } from './lib/auth0';
import { resolveAuthStrategy } from './lib/auth';
import { assertValidAuthConfig } from './lib/auth/validate-config';

const PUBLIC_ROUTES = ['/sign-in', '/sign-out', '/auth'];

/**
 * The same-origin proxy to the templates-management API.
 *
 * Requests under this prefix still pass through the middleware — that is what
 * establishes the provider's request context, so the route handler can ask the
 * strategy who is signed in — but they are never redirected. Answering a fetch
 * with a 307 to an HTML sign-in page produces a parse error in the browser
 * instead of something the UI can act on, so the route handler returns a JSON
 * 401 of its own. See app/api/templates/[...path]/route.ts.
 */
const API_ROUTE_PREFIX = '/api/templates';

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const pathname = request.nextUrl.pathname;

  const isApiRoute = pathname.startsWith(API_ROUTE_PREFIX);

  const isPublicRoute =
    PUBLIC_ROUTES.some((route) => pathname.startsWith(route)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/public');

  // For Clerk, we need to use their middleware wrapper
  if (process.env.AUTH_PROVIDER === 'clerk') {
    const isProtectedRoute = createRouteMatcher([
      '/((?!sign-in|sign-out|api/auth|api/templates|_next|public).*)',
    ]);

    const handler = clerkMiddleware(async (auth, req) => {
      if (isProtectedRoute(req) && !(await auth()).userId) {
        const signInUrl = new URL('/sign-in', req.url);
        return NextResponse.redirect(signInUrl);
      }
      return NextResponse.next();
    });

    return handler(request, event);
  }

  // For Auth0 v4, use the auth0 client middleware
  if (process.env.AUTH_PROVIDER === 'auth0') {
    const authRes = await auth0.middleware(request);

    // Ensure routes starting with /auth are handled by the SDK
    if (pathname.startsWith('/auth')) {
      return authRes;
    }

    // Allow access to public routes without requiring a session
    if (pathname === '/') {
      return authRes;
    }

    // The proxy route authenticates itself, so that a signed-out fetch gets a
    // JSON 401 rather than a redirect to a login page.
    if (isApiRoute) {
      return authRes;
    }

    // Protected routes - require authentication
    const session = await auth0.getSession(request);
    if (!session) {
      const { origin } = new URL(request.url);
      return NextResponse.redirect(`${origin}/auth/login`);
    }

    return authRes;
  }

  // Fallback for other providers
  if (isPublicRoute || isApiRoute) {
    return NextResponse.next();
  }

  try {
    const strategy = resolveAuthStrategy();
    assertValidAuthConfig(strategy);
    return (await strategy.protectRoute(request)) || NextResponse.next();
  } catch (error) {
    if (error instanceof Error) {
      const message = error.message;
      if (
        message.includes('AUTH_PROVIDER env var is required') ||
        message.includes('Unsupported auth provider') ||
        message.includes('Missing required auth configuration')
      ) {
        throw error;
      }
    }

    console.error('Middleware auth error:', error);
    const signInUrl = new URL('/sign-in', request.url);
    return NextResponse.redirect(signInUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     *
     * API routes are deliberately included: the proxy route needs the
     * provider's request context to be established before its handler runs,
     * which for Clerk only happens inside clerkMiddleware.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
