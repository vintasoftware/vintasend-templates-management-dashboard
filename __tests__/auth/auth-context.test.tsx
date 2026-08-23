/**
 * Tests for the client-side auth context.
 *
 * The provider seeds itself from a server-rendered user and then, on Clerk only,
 * keeps that state in sync with Clerk's client hook. The Auth0 path must leave
 * the seeded user alone even though the hook is still called unconditionally.
 */

const useUser = jest.fn();

jest.mock('@clerk/nextjs', () => ({
  useUser: () => useUser(),
}));

import { render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/auth/auth-context';
import type { AuthUser } from '@/lib/auth/types';

function Consumer() {
  const { user, isAuthenticated, signInUrl, signOutUrl } = useAuth();

  return (
    <dl>
      <dd data-testid="authenticated">{String(isAuthenticated)}</dd>
      <dd data-testid="id">{user?.id ?? 'none'}</dd>
      <dd data-testid="email">{user?.email ?? 'none'}</dd>
      <dd data-testid="name">{user?.name ?? 'none'}</dd>
      <dd data-testid="sign-in">{signInUrl}</dd>
      <dd data-testid="sign-out">{signOutUrl}</dd>
    </dl>
  );
}

const renderProvider = (initialUser: AuthUser | null) =>
  render(
    <AuthProvider initialUser={initialUser} signInUrl="/sign-in" signOutUrl="/sign-out">
      <Consumer />
    </AuthProvider>,
  );

const serverUser: AuthUser = {
  id: 'server-1',
  email: 'server@example.com',
  name: 'Server User',
  imageUrl: null,
};

const savedProvider = {
  public: process.env.NEXT_PUBLIC_AUTH_PROVIDER,
  server: process.env.AUTH_PROVIDER,
};

beforeEach(() => {
  jest.clearAllMocks();
  useUser.mockReturnValue({ user: null, isLoaded: false });
});

afterEach(() => {
  for (const [key, value] of [
    ['NEXT_PUBLIC_AUTH_PROVIDER', savedProvider.public],
    ['AUTH_PROVIDER', savedProvider.server],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe('AuthProvider', () => {
  it('exposes the server-rendered user and the configured URLs', () => {
    renderProvider(serverUser);

    expect(screen.getByTestId('id')).toHaveTextContent('server-1');
    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('sign-in')).toHaveTextContent('/sign-in');
    expect(screen.getByTestId('sign-out')).toHaveTextContent('/sign-out');
  });

  it('reports an anonymous visitor when there is no initial user', () => {
    renderProvider(null);

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('id')).toHaveTextContent('none');
  });

  it('adopts the Clerk user once the Clerk hook has loaded', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    useUser.mockReturnValue({
      isLoaded: true,
      user: {
        id: 'clerk-1',
        primaryEmailAddress: { emailAddress: 'clerk@example.com' },
        fullName: 'Clerk User',
        imageUrl: 'https://img.clerk.com/u.png',
      },
    });

    renderProvider(null);

    expect(screen.getByTestId('id')).toHaveTextContent('clerk-1');
    expect(screen.getByTestId('email')).toHaveTextContent('clerk@example.com');
    expect(screen.getByTestId('name')).toHaveTextContent('Clerk User');
  });

  it('falls back to the first name when Clerk has no full name', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    useUser.mockReturnValue({
      isLoaded: true,
      user: {
        id: 'clerk-1',
        primaryEmailAddress: undefined,
        fullName: null,
        firstName: 'Ada',
        imageUrl: 'https://img.clerk.com/u.png',
      },
    });

    renderProvider(null);

    expect(screen.getByTestId('name')).toHaveTextContent('Ada');
    // No address at all still renders, as an empty string rather than a crash.
    expect(screen.getByTestId('email')).toBeEmptyDOMElement();
  });

  it('clears a stale server user when Clerk reports nobody signed in', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    useUser.mockReturnValue({ isLoaded: true, user: null });

    renderProvider(serverUser);

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('keeps the server user while the Clerk hook is still loading', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';
    useUser.mockReturnValue({ isLoaded: false, user: null });

    renderProvider(serverUser);

    expect(screen.getByTestId('id')).toHaveTextContent('server-1');
  });

  it('defaults to the Clerk path when no provider is configured', () => {
    delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
    delete process.env.AUTH_PROVIDER;
    useUser.mockReturnValue({ isLoaded: true, user: null });

    renderProvider(serverUser);

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
  });

  it('leaves the server user untouched under Auth0, even if Clerk reports a user', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'auth0';
    useUser.mockReturnValue({
      isLoaded: true,
      user: { id: 'clerk-1', fullName: 'Clerk User', imageUrl: null },
    });

    renderProvider(serverUser);

    expect(screen.getByTestId('id')).toHaveTextContent('server-1');
  });

  it('reads the server-side AUTH_PROVIDER when the public one is unset', () => {
    delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
    process.env.AUTH_PROVIDER = 'auth0';
    useUser.mockReturnValue({ isLoaded: true, user: null });

    renderProvider(serverUser);

    expect(screen.getByTestId('id')).toHaveTextContent('server-1');
  });
});

describe('useAuth', () => {
  it('throws when used outside a provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow('useAuth must be used within an AuthProvider');

    consoleError.mockRestore();
  });
});
