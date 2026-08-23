/**
 * @jest-environment node
 */

/**
 * Tests for the dashboard's proxy (middleware).
 *
 * `proxy.ts` is the only thing standing between an anonymous request and the
 * template data, so each provider branch is exercised against the real
 * module: which requests are let through, which are redirected to a sign-in,
 * and which misconfigurations must fail loudly instead of silently redirecting.
 */

// Typed as jest.Mock so the return types stay open: these stubs are re-armed
// per test with different handlers and matcher results.
const clerkHandler: jest.Mock = jest.fn();
const clerkMiddleware: jest.Mock = jest.fn(() => clerkHandler);
const createRouteMatcher: jest.Mock = jest.fn(() => () => true);

jest.mock('@clerk/nextjs/server', () => ({
  clerkMiddleware: (...args: unknown[]) => clerkMiddleware(...(args as [])),
  createRouteMatcher: (...args: unknown[]) => createRouteMatcher(...(args as [])),
}));

const getSession: jest.Mock = jest.fn();
const auth0Middleware: jest.Mock = jest.fn();

jest.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: (...args: unknown[]) => getSession(...(args as [])),
    middleware: (...args: unknown[]) => auth0Middleware(...(args as [])),
  },
}));

const resolveAuthStrategy: jest.Mock = jest.fn();
jest.mock('@/lib/auth', () => ({
  resolveAuthStrategy: (...args: unknown[]) => resolveAuthStrategy(...(args as [])),
}));

const assertValidAuthConfig: jest.Mock = jest.fn();
jest.mock('@/lib/auth/validate-config', () => ({
  assertValidAuthConfig: (...args: unknown[]) => assertValidAuthConfig(...(args as [])),
}));

import { NextFetchEvent, NextRequest, NextResponse } from 'next/server';
import { config, proxy } from '@/proxy';

const makeRequest = (path: string) => new NextRequest(`https://dashboard.test${path}`);
const event = {} as NextFetchEvent;

const originalEnv = process.env.AUTH_PROVIDER;

beforeEach(() => {
  jest.clearAllMocks();
  createRouteMatcher.mockReturnValue(() => true);
});

afterEach(() => {
  if (originalEnv === undefined) {
    delete process.env.AUTH_PROVIDER;
  } else {
    process.env.AUTH_PROVIDER = originalEnv;
  }
});

describe('proxy — Clerk provider', () => {
  beforeEach(() => {
    process.env.AUTH_PROVIDER = 'clerk';
  });

  it('delegates the request to the Clerk middleware handler', async () => {
    const handlerResult = NextResponse.next();
    clerkHandler.mockReturnValue(handlerResult);

    const request = makeRequest('/');
    const result = await proxy(request, event);

    expect(clerkMiddleware).toHaveBeenCalledTimes(1);
    expect(clerkHandler).toHaveBeenCalledWith(request, event);
    expect(result).toBe(handlerResult);
  });

  it('redirects to /sign-in when Clerk reports no signed-in user', async () => {
    clerkHandler.mockImplementation(async (req: NextRequest) => {
      // Run the callback Clerk would invoke, with an anonymous session.
      const callback = clerkMiddleware.mock.calls[0][0];
      return callback(async () => ({ userId: null }), req);
    });

    const result = (await proxy(makeRequest('/'), event)) as NextResponse;

    expect(result.status).toBe(307);
    expect(result.headers.get('location')).toBe('https://dashboard.test/sign-in');
  });

  it('lets a signed-in Clerk user through', async () => {
    clerkHandler.mockImplementation(async (req: NextRequest) => {
      const callback = clerkMiddleware.mock.calls[0][0];
      return callback(async () => ({ userId: 'user_123' }), req);
    });

    const result = (await proxy(makeRequest('/'), event)) as NextResponse;

    expect(result.headers.get('location')).toBeNull();
  });

  it('does not redirect a request the route matcher treats as public', async () => {
    createRouteMatcher.mockReturnValue(() => false);
    clerkHandler.mockImplementation(async (req: NextRequest) => {
      const callback = clerkMiddleware.mock.calls[0][0];
      return callback(async () => ({ userId: null }), req);
    });

    const result = (await proxy(makeRequest('/sign-in'), event)) as NextResponse;

    expect(result.headers.get('location')).toBeNull();
  });
});

describe('proxy — Auth0 provider', () => {
  beforeEach(() => {
    process.env.AUTH_PROVIDER = 'auth0';
  });

  it('hands /auth routes to the Auth0 SDK without checking for a session', async () => {
    const authRes = NextResponse.next();
    auth0Middleware.mockResolvedValue(authRes);

    const result = await proxy(makeRequest('/auth/login'), event);

    expect(result).toBe(authRes);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('allows the root route through without a session', async () => {
    const authRes = NextResponse.next();
    auth0Middleware.mockResolvedValue(authRes);

    const result = await proxy(makeRequest('/'), event);

    expect(result).toBe(authRes);
    expect(getSession).not.toHaveBeenCalled();
  });

  it('redirects an anonymous request for a protected route to the Auth0 login', async () => {
    auth0Middleware.mockResolvedValue(NextResponse.next());
    getSession.mockResolvedValue(null);

    const result = (await proxy(makeRequest('/tags'), event)) as NextResponse;

    expect(result.status).toBe(307);
    expect(result.headers.get('location')).toBe('https://dashboard.test/auth/login');
  });

  it('returns the Auth0 response when a session exists', async () => {
    const authRes = NextResponse.next();
    auth0Middleware.mockResolvedValue(authRes);
    getSession.mockResolvedValue({ user: { sub: 'auth0|1' } });

    const result = await proxy(makeRequest('/tags'), event);

    expect(result).toBe(authRes);
  });
});

describe('proxy — strategy fallback', () => {
  beforeEach(() => {
    process.env.AUTH_PROVIDER = 'custom';
  });

  it.each(['/sign-in', '/sign-out', '/auth/callback', '/_next/static/chunk.js', '/public/logo.svg'])(
    'lets the public route %s through without resolving a strategy',
    async (path) => {
      const result = (await proxy(makeRequest(path), event)) as NextResponse;

      expect(resolveAuthStrategy).not.toHaveBeenCalled();
      expect(result.headers.get('location')).toBeNull();
    },
  );

  it('continues when the strategy allows the request', async () => {
    const protectRoute = jest.fn().mockResolvedValue(null);
    resolveAuthStrategy.mockReturnValue({ protectRoute });

    const request = makeRequest('/tags');
    const result = (await proxy(request, event)) as NextResponse;

    expect(assertValidAuthConfig).toHaveBeenCalledWith({ protectRoute });
    expect(protectRoute).toHaveBeenCalledWith(request);
    expect(result.headers.get('location')).toBeNull();
  });

  it('returns the strategy response when the strategy blocks the request', async () => {
    const redirect = NextResponse.redirect('https://dashboard.test/login');
    resolveAuthStrategy.mockReturnValue({
      protectRoute: jest.fn().mockResolvedValue(redirect),
    });

    const result = await proxy(makeRequest('/tags'), event);

    expect(result).toBe(redirect);
  });

  it.each([
    'AUTH_PROVIDER env var is required',
    'Unsupported auth provider: banana',
    'Missing required auth configuration: CLERK_SECRET_KEY',
  ])('rethrows the configuration error %s instead of redirecting', async (message) => {
    resolveAuthStrategy.mockImplementation(() => {
      throw new Error(message);
    });

    await expect(proxy(makeRequest('/tags'), event)).rejects.toThrow(message);
  });

  it('redirects to /sign-in when the strategy fails for an unexpected reason', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    resolveAuthStrategy.mockReturnValue({
      protectRoute: jest.fn().mockRejectedValue(new Error('upstream auth service is down')),
    });

    const result = (await proxy(makeRequest('/tags'), event)) as NextResponse;

    expect(result.status).toBe(307);
    expect(result.headers.get('location')).toBe('https://dashboard.test/sign-in');
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('redirects to /sign-in when a non-Error value is thrown', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    resolveAuthStrategy.mockImplementation(() => {
      throw 'string failure';
    });

    const result = (await proxy(makeRequest('/tags'), event)) as NextResponse;

    expect(result.headers.get('location')).toBe('https://dashboard.test/sign-in');
    consoleError.mockRestore();
  });
});

describe('proxy config', () => {
  it('matches app routes while excluding static assets', () => {
    expect(config.matcher).toHaveLength(1);
    // Next anchors matcher patterns; an unanchored RegExp would match substrings.
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    expect(matcher.test('/tags')).toBe(true);
    expect(matcher.test('/_next/static/app.js')).toBe(false);
    expect(matcher.test('/favicon.ico')).toBe(false);
  });

  it('matches the VintaSend proxy route', () => {
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    // The route handler asks the strategy who is signed in, and for Clerk that
    // only works if clerkMiddleware has already run for the request. Excluding
    // /api here would make every proxied call look anonymous.
    expect(matcher.test('/api/templates/api/v1/templates')).toBe(true);
  });
});

describe('proxy — the VintaSend API route', () => {
  const apiPath = '/api/templates/api/v1/templates';

  it('does not redirect an anonymous Clerk request, so the route can answer 401', async () => {
    process.env.AUTH_PROVIDER = 'clerk';
    createRouteMatcher.mockReturnValue((req: NextRequest) => {
      // Mirrors the real negative lookahead, which exempts api/vintasend.
      return !req.nextUrl.pathname.startsWith('/api/templates');
    });
    clerkHandler.mockImplementation(async (req: NextRequest) => {
      const callback = clerkMiddleware.mock.calls[0][0];
      return callback(async () => ({ userId: null }), req);
    });

    const result = (await proxy(makeRequest(apiPath), event)) as NextResponse;

    expect(result.headers.get('location')).toBeNull();
  });

  it('does not redirect an anonymous Auth0 request', async () => {
    process.env.AUTH_PROVIDER = 'auth0';
    const authRes = NextResponse.next();
    auth0Middleware.mockResolvedValue(authRes);
    getSession.mockResolvedValue(null);

    const result = await proxy(makeRequest(apiPath), event);

    expect(result).toBe(authRes);
  });

  it('does not run the fallback strategy over the proxy route', async () => {
    process.env.AUTH_PROVIDER = 'custom';

    const result = (await proxy(makeRequest(apiPath), event)) as NextResponse;

    expect(resolveAuthStrategy).not.toHaveBeenCalled();
    expect(result.headers.get('location')).toBeNull();
  });
});
