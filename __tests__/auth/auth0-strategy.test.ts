/**
 * @jest-environment node
 */

/**
 * Tests for the Auth0-backed auth strategy.
 *
 * Every lookup in this strategy is wrapped in a try/catch that degrades to
 * "not signed in", so the failure paths are the ones that decide whether a
 * transient Auth0 outage quietly exposes the dashboard or locks it down.
 */

const getSession = jest.fn();

jest.mock('@/lib/auth0', () => ({
  auth0: {
    getSession: (...args: unknown[]) => getSession(...(args as [])),
  },
}));

jest.mock('@auth0/nextjs-auth0/client', () => ({
  Auth0Provider: function Auth0Provider() {
    return null;
  },
}));

import { NextRequest } from 'next/server';
import { Auth0Provider } from '@auth0/nextjs-auth0/client';
import { Auth0Strategy } from '@/lib/auth/strategies/auth0-strategy';

const request = (path = '/notifications') => new NextRequest(`https://dashboard.test${path}`);

let strategy: Auth0Strategy;

beforeEach(() => {
  jest.clearAllMocks();
  strategy = new Auth0Strategy();
});

describe('Auth0Strategy.validateConfig', () => {
  const keys = [
    'AUTH0_SECRET',
    'APP_BASE_URL',
    'AUTH0_DOMAIN',
    'AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET',
  ];
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

  it('reports only the keys still missing', () => {
    process.env.AUTH0_SECRET = 'secret';
    process.env.APP_BASE_URL = 'https://dashboard.test';

    expect(strategy.validateConfig()).toEqual([
      'AUTH0_DOMAIN',
      'AUTH0_CLIENT_ID',
      'AUTH0_CLIENT_SECRET',
    ]);
  });

  it('reports nothing when the full set is configured', () => {
    for (const key of keys) process.env[key] = 'value';

    expect(strategy.validateConfig()).toEqual([]);
  });
});

describe('Auth0Strategy URLs and provider', () => {
  it('exposes the Auth0 provider component', () => {
    expect(strategy.getProviderComponent()).toBe(Auth0Provider);
  });

  it('points sign-in and sign-out at the SDK routes', () => {
    expect(strategy.getSignInUrl()).toBe('/auth/login');
    expect(strategy.getSignOutUrl()).toBe('/auth/logout');
  });
});

describe('Auth0Strategy.getCurrentUser', () => {
  it('maps an Auth0 session onto the shared user shape', async () => {
    getSession.mockResolvedValue({
      user: {
        sub: 'auth0|1',
        email: 'ada@example.com',
        name: 'Ada Lovelace',
        picture: 'https://cdn.auth0.com/ada.png',
      },
    });

    await expect(strategy.getCurrentUser()).resolves.toEqual({
      id: 'auth0|1',
      email: 'ada@example.com',
      name: 'Ada Lovelace',
      imageUrl: 'https://cdn.auth0.com/ada.png',
    });
  });

  it('normalises absent claims to empty id and null fields', async () => {
    getSession.mockResolvedValue({ user: {} });

    await expect(strategy.getCurrentUser()).resolves.toEqual({
      id: '',
      email: null,
      name: null,
      imageUrl: null,
    });
  });

  it('returns null when there is no session', async () => {
    getSession.mockResolvedValue(null);

    await expect(strategy.getCurrentUser()).resolves.toBeNull();
  });

  it('returns null when the session carries no user', async () => {
    getSession.mockResolvedValue({});

    await expect(strategy.getCurrentUser()).resolves.toBeNull();
  });

  it('returns null instead of propagating an Auth0 failure', async () => {
    getSession.mockRejectedValue(new Error('auth0 unreachable'));

    await expect(strategy.getCurrentUser()).resolves.toBeNull();
  });
});

describe('Auth0Strategy.isAuthenticated', () => {
  it('is true when the session has a user', async () => {
    getSession.mockResolvedValue({ user: { sub: 'auth0|1' } });

    await expect(strategy.isAuthenticated()).resolves.toBe(true);
  });

  it('is false when there is no session', async () => {
    getSession.mockResolvedValue(null);

    await expect(strategy.isAuthenticated()).resolves.toBe(false);
  });

  it('is false when Auth0 throws', async () => {
    getSession.mockRejectedValue(new Error('auth0 unreachable'));

    await expect(strategy.isAuthenticated()).resolves.toBe(false);
  });
});

describe('Auth0Strategy.protectRoute', () => {
  it('allows a request with a session through', async () => {
    getSession.mockResolvedValue({ user: { sub: 'auth0|1' } });

    await expect(strategy.protectRoute(request())).resolves.toBeNull();
  });

  it('redirects an anonymous request to login, preserving the target path', async () => {
    getSession.mockResolvedValue(null);

    const response = await strategy.protectRoute(request('/notifications'));

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'https://dashboard.test/auth/login?returnTo=%2Fnotifications',
    );
  });

  it('redirects to login when the session lookup throws', async () => {
    getSession.mockRejectedValue(new Error('auth0 unreachable'));

    const response = await strategy.protectRoute(request('/notifications'));

    expect(response?.headers.get('location')).toBe(
      'https://dashboard.test/auth/login?returnTo=%2Fnotifications',
    );
  });
});
