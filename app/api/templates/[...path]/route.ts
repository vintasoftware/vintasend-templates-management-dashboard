import { NextResponse, type NextRequest } from 'next/server';

import { resolveAuthStrategy } from '@/lib/auth';
import { assertValidAuthConfig } from '@/lib/auth/validate-config';
import type { ApiErrorCode } from 'vintasend-templates-management-dashboard-core';

/**
 * Same-origin proxy to the VintaSend templates-management API.
 *
 * `TEMPLATES_API_KEY` is a server-side secret, so the browser never talks to
 * the API directly. The dashboard's client is pointed at `/api/templates`
 * (see app/providers.tsx) and this route re-signs each call with the key.
 *
 * Two things make it a proxy rather than a hand-written endpoint per resource:
 * the path is forwarded verbatim, so every endpoint in the contract — including
 * ones added later — works without a code change here; and the API's own error
 * envelope is relayed untouched, so `getApiErrorCode` in the browser still sees
 * the real code. That matters more here than on the notifications dashboard:
 * `INVALID_STATUS_TRANSITION` and `TEMPLATE_COMPOSITION_ERROR` are states the
 * UI explains rather than failures it reports.
 *
 * The session check is the dashboard's, not the API's. `proxy.ts` deliberately
 * does not redirect requests under this prefix, because a 307 to an HTML
 * sign-in page is useless to a fetch call; an expired session gets a JSON 401
 * instead.
 */

/**
 * Methods the contract uses. This API writes with all four verbs — PUT retags a
 * version, PATCH renames a tag, DELETE removes a template or a single version —
 * so unlike the read-mostly notifications proxy, all of them are forwarded.
 */
const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

/**
 * Response headers worth relaying. The rest are the proxy's own business:
 * `content-length` and `content-encoding` describe a body that has already been
 * decoded by the time it reaches us, and relaying them corrupts the response.
 */
const RELAYED_RESPONSE_HEADERS = ['content-type'];

type RouteContext = { params: Promise<{ path?: string[] }> };

function apiError(code: ApiErrorCode, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

function readApiConfig(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.TEMPLATES_API_URL?.trim();
  const apiKey = process.env.TEMPLATES_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    return null;
  }

  return { baseUrl: baseUrl.replace(/\/+$/, ''), apiKey };
}

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const strategy = resolveAuthStrategy();
  assertValidAuthConfig(strategy);

  return strategy.isAuthenticated(request);
}

async function handle(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const method = request.method.toUpperCase();

  if (!(ALLOWED_METHODS as readonly string[]).includes(method)) {
    return apiError('BAD_REQUEST', `The ${method} method is not supported.`, 405);
  }

  let authenticated: boolean;

  try {
    authenticated = await isAuthenticated(request);
  } catch (error) {
    // A missing or invalid AUTH_PROVIDER is a deployment fault, not a client
    // one, and must never read as "signed out".
    console.error('Auth configuration error in the templates proxy:', error);

    return apiError('INTERNAL_ERROR', 'The dashboard is not configured correctly.', 500);
  }

  if (!authenticated) {
    return apiError('UNAUTHORIZED', 'Your session has expired. Sign in again.', 401);
  }

  const config = readApiConfig();

  if (!config) {
    return apiError(
      'INTERNAL_ERROR',
      'TEMPLATES_API_URL and TEMPLATES_API_KEY must both be set.',
      500,
    );
  }

  const { path = [] } = await context.params;
  const target = new URL(`${config.baseUrl}/${path.map(encodeURIComponent).join('/')}`);
  target.search = request.nextUrl.search;

  const body = method === 'GET' ? undefined : await request.text();

  let upstream: Response;

  try {
    upstream = await fetch(target, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body } : {}),
      // The dashboard always shows current state; a cached list of templates is
      // worse than a slightly slower one.
      cache: 'no-store',
    });
  } catch (error) {
    // This contract has no `UPSTREAM_ERROR`, so a transport failure is reported
    // under the closest code it does define. `toApiErrorResponse` in the core
    // normalises unenveloped failures the same way.
    return apiError(
      'INTERNAL_ERROR',
      `Could not reach the templates API: ${
        error instanceof Error ? error.message : 'unknown network error'
      }`,
      503,
    );
  }

  const headers = new Headers();

  for (const name of RELAYED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;

/** The session is per-request, so this route can never be statically rendered. */
export const dynamic = 'force-dynamic';
