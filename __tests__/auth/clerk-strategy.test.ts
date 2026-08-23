/**
 * @jest-environment node
 */

/**
 * Tests for the Clerk-backed auth strategy.
 *
 * Clerk exposes two different lookup paths — request-scoped (`getAuth`) and
 * context-scoped (`currentUser`/`auth`) — and the strategy has to pick the right
 * one. The user mapping also has several fallbacks worth pinning down.
 */

const auth = jest.fn();
const currentUser = jest.fn();
const getAuth = jest.fn();
const getUser = jest.fn();
const clerkClient = jest.fn(async () => ({ users: { getUser } }));

jest.mock('@clerk/nextjs', () => ({
  ClerkProvider: function ClerkProvider() {
    return null;
  },
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: (...args: unknown[]) => auth(...(args as [])),
  currentUser: (...args: unknown[]) => currentUser(...(args as [])),
  getAuth: (...args: unknown[]) => getAuth(...(args as [])),
  clerkClient: (...args: unknown[]) => clerkClient(...(args as [])),
}));

import { NextRequest } from 'next/server';
import { ClerkProvider } from '@clerk/nextjs';
import { ClerkStrategy } from '@/lib/auth/strategies/clerk-strategy';

const request = () => new NextRequest('https://dashboard.test/notifications');

const clerkUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user_123',
  primaryEmailAddress: { emailAddress: 'primary@example.com' },
  emailAddresses: [{ emailAddress: 'first@example.com' }],
  firstName: 'Ada',
  lastName: 'Lovelace',
  fullName: 'Ada Lovelace',
  imageUrl: 'https://img.clerk.com/ada.png',
  ...overrides,
});

let strategy: ClerkStrategy;

beforeEach(() => {
  jest.clearAllMocks();
  strategy = new ClerkStrategy();
});

describe('ClerkStrategy.validateConfig', () => {
  const keys = ['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'CLERK_SECRET_KEY'];
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('reports every missing key when nothing is configured', () => {
    expect(strategy.validateConfig()).toEqual(keys);
  });

  it('reports only the key that is still missing', () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_x';

    expect(strategy.validateConfig()).toEqual(['CLERK_SECRET_KEY']);
  });

  it('reports nothing when both keys are set', () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';

    expect(strategy.validateConfig()).toEqual([]);
  });
});

describe('ClerkStrategy URLs and provider', () => {
  it('exposes the Clerk provider component', () => {
    expect(strategy.getProviderComponent()).toBe(ClerkProvider);
  });

  it('points sign-in and sign-out at the dashboard routes', () => {
    expect(strategy.getSignInUrl()).toBe('/sign-in');
    expect(strategy.getSignOutUrl()).toBe('/sign-out');
  });
});

describe('ClerkStrategy.getCurrentUser', () => {
  it('looks the user up through clerkClient when given a request', async () => {
    getAuth.mockReturnValue({ userId: 'user_123' });
    getUser.mockResolvedValue(clerkUser());

    const req = request();
    await expect(strategy.getCurrentUser(req)).resolves.toEqual({
      id: 'user_123',
      email: 'primary@example.com',
      name: 'Ada Lovelace',
      imageUrl: 'https://img.clerk.com/ada.png',
    });
    expect(getAuth).toHaveBeenCalledWith(req);
    expect(getUser).toHaveBeenCalledWith('user_123');
  });

  it('returns null for an anonymous request without hitting the API', async () => {
    getAuth.mockReturnValue({ userId: null });

    await expect(strategy.getCurrentUser(request())).resolves.toBeNull();
    expect(clerkClient).not.toHaveBeenCalled();
  });

  it('uses the ambient session when no request is given', async () => {
    currentUser.mockResolvedValue(clerkUser());

    await expect(strategy.getCurrentUser()).resolves.toMatchObject({ id: 'user_123' });
    expect(getAuth).not.toHaveBeenCalled();
  });

  it('returns null when there is no ambient session', async () => {
    currentUser.mockResolvedValue(null);

    await expect(strategy.getCurrentUser()).resolves.toBeNull();
  });

  it('falls back to the first email when there is no primary address', async () => {
    currentUser.mockResolvedValue(clerkUser({ primaryEmailAddress: undefined }));

    await expect(strategy.getCurrentUser()).resolves.toMatchObject({
      email: 'first@example.com',
    });
  });

  it('reports a null email when the account has no address at all', async () => {
    currentUser.mockResolvedValue(
      clerkUser({ primaryEmailAddress: undefined, emailAddresses: [] }),
    );

    await expect(strategy.getCurrentUser()).resolves.toMatchObject({ email: null });
  });

  it('builds a name from first and last name when fullName is absent', async () => {
    currentUser.mockResolvedValue(clerkUser({ fullName: null }));

    await expect(strategy.getCurrentUser()).resolves.toMatchObject({ name: 'Ada Lovelace' });
  });

  it('builds a name from whichever part is present', async () => {
    currentUser.mockResolvedValue(clerkUser({ fullName: null, lastName: null }));

    await expect(strategy.getCurrentUser()).resolves.toMatchObject({ name: 'Ada' });
  });

  it('reports a null name when no name field is set', async () => {
    currentUser.mockResolvedValue(clerkUser({ fullName: null, firstName: null, lastName: null }));

    await expect(strategy.getCurrentUser()).resolves.toMatchObject({ name: null });
  });

  it('reports a null image when the account has none', async () => {
    currentUser.mockResolvedValue(clerkUser({ imageUrl: null }));

    await expect(strategy.getCurrentUser()).resolves.toMatchObject({ imageUrl: null });
  });
});

describe('ClerkStrategy.isAuthenticated', () => {
  it('reads the session off the request when one is given', async () => {
    getAuth.mockReturnValue({ userId: 'user_123' });

    await expect(strategy.isAuthenticated(request())).resolves.toBe(true);
    expect(auth).not.toHaveBeenCalled();
  });

  it('is false for an anonymous request', async () => {
    getAuth.mockReturnValue({ userId: null });

    await expect(strategy.isAuthenticated(request())).resolves.toBe(false);
  });

  it('falls back to the ambient session with no request', async () => {
    auth.mockResolvedValue({ userId: 'user_123' });

    await expect(strategy.isAuthenticated()).resolves.toBe(true);
  });

  it('is false when the ambient session is anonymous', async () => {
    auth.mockResolvedValue({ userId: null });

    await expect(strategy.isAuthenticated()).resolves.toBe(false);
  });
});

describe('ClerkStrategy.protectRoute', () => {
  it('allows a signed-in request through', async () => {
    getAuth.mockReturnValue({ userId: 'user_123' });

    await expect(strategy.protectRoute(request())).resolves.toBeNull();
  });

  it('redirects an anonymous request to sign-in on the same origin', async () => {
    getAuth.mockReturnValue({ userId: null });

    const response = await strategy.protectRoute(request());

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('https://dashboard.test/sign-in');
  });
});
