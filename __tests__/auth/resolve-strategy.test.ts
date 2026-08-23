/**
 * Tests for auth strategy resolution.
 *
 * Misconfiguration here has to fail loudly at boot rather than fall back to an
 * unauthenticated dashboard, so the error paths matter as much as the happy one.
 */

jest.mock('@/lib/auth/strategies/clerk-strategy', () => ({
  ClerkStrategy: class ClerkStrategy {},
}));

jest.mock('@/lib/auth/strategies/auth0-strategy', () => ({
  Auth0Strategy: class Auth0Strategy {},
}));

import { resolveAuthStrategy } from '@/lib/auth/resolve-strategy';
import { ClerkStrategy } from '@/lib/auth/strategies/clerk-strategy';
import { Auth0Strategy } from '@/lib/auth/strategies/auth0-strategy';

const originalProvider = process.env.AUTH_PROVIDER;

afterEach(() => {
  if (originalProvider === undefined) {
    delete process.env.AUTH_PROVIDER;
  } else {
    process.env.AUTH_PROVIDER = originalProvider;
  }
});

describe('resolveAuthStrategy', () => {
  it('resolves the Clerk strategy from an explicit argument', () => {
    expect(resolveAuthStrategy('clerk')).toBeInstanceOf(ClerkStrategy);
  });

  it('resolves the Auth0 strategy from an explicit argument', () => {
    expect(resolveAuthStrategy('auth0')).toBeInstanceOf(Auth0Strategy);
  });

  it('falls back to AUTH_PROVIDER when no argument is given', () => {
    process.env.AUTH_PROVIDER = 'auth0';

    expect(resolveAuthStrategy()).toBeInstanceOf(Auth0Strategy);
  });

  it('prefers the explicit argument over AUTH_PROVIDER', () => {
    process.env.AUTH_PROVIDER = 'auth0';

    expect(resolveAuthStrategy('clerk')).toBeInstanceOf(ClerkStrategy);
  });

  it('throws when neither an argument nor AUTH_PROVIDER is set', () => {
    delete process.env.AUTH_PROVIDER;

    expect(() => resolveAuthStrategy()).toThrow('AUTH_PROVIDER env var is required');
  });

  it('throws when AUTH_PROVIDER is set to an empty string', () => {
    process.env.AUTH_PROVIDER = '';

    expect(() => resolveAuthStrategy()).toThrow('AUTH_PROVIDER env var is required');
  });

  it('throws for a provider it does not implement', () => {
    expect(() => resolveAuthStrategy('okta')).toThrow('Unsupported auth provider: okta');
  });
});
