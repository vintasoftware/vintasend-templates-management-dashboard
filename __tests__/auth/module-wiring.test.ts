// @vitest-environment node

/**
 * Tests for the auth module's wiring: the shared Auth0 client and the barrel
 * that the app imports from. Both are small, but a bad callback URL or a
 * dropped re-export breaks sign-in everywhere at once.
 */

const Auth0Client = vi.fn();

// The module under test calls `new Auth0Client(...)`, so the stand-in has to be
// constructible.
vi.mock('@auth0/nextjs-auth0/server', () => ({
  Auth0Client: class {
    constructor(...args: unknown[]) {
      Auth0Client(...(args as []));
    }
  },
}));

vi.mock('@auth0/nextjs-auth0/client', () => ({ Auth0Provider: () => null }));
vi.mock('@clerk/nextjs', () => ({ ClerkProvider: () => null, useUser: () => ({}) }));
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getAuth: vi.fn(),
  clerkClient: vi.fn(),
}));

describe('auth0 client', () => {
  const savedBaseUrl = process.env.APP_BASE_URL;

  afterEach(() => {
    if (savedBaseUrl === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = savedBaseUrl;
    vi.resetModules();
  });

  it('builds the callback URL from APP_BASE_URL and requests the profile scopes', async () => {
    vi.resetModules();
    Auth0Client.mockClear();
    process.env.APP_BASE_URL = 'https://dashboard.test';

    const { auth0 } = await import('@/lib/auth0');

    expect(auth0).toBeDefined();
    expect(Auth0Client).toHaveBeenCalledWith({
      authorizationParameters: {
        scope: 'openid profile email',
        redirect_uri: 'https://dashboard.test/auth/callback',
      },
    });
  });
});

describe('auth barrel', () => {
  it('re-exports the strategy resolver, both strategies and the client context', async () => {
    const authModule = await import('@/lib/auth');

    expect(typeof authModule.resolveAuthStrategy).toBe('function');
    expect(typeof authModule.ClerkStrategy).toBe('function');
    expect(typeof authModule.Auth0Strategy).toBe('function');
    expect(typeof authModule.AuthProvider).toBe('function');
    expect(typeof authModule.useAuth).toBe('function');
  });
});
