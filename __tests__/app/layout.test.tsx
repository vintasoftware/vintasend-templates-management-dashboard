/**
 * Tests for the root layout.
 *
 * The layout is where auth is wired up for the whole app: it must refuse to
 * render on a bad configuration rather than serve an unauthenticated shell.
 */

const resolveAuthStrategy = jest.fn();
const assertValidAuthConfig = jest.fn();

jest.mock('@/lib/auth', () => ({
  resolveAuthStrategy: (...args: unknown[]) => resolveAuthStrategy(...(args as [])),
}));

jest.mock('@/lib/auth/validate-config', () => ({
  assertValidAuthConfig: (...args: unknown[]) => assertValidAuthConfig(...(args as [])),
}));

jest.mock('@/lib/auth/auth-context', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

jest.mock('@/app/components/top-navbar', () => ({
  TopNavbar: () => <nav data-testid="top-navbar" />,
}));

jest.mock('@/components/ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

jest.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-geist-sans' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}));

jest.mock('@/app/globals.css', () => ({}), { virtual: true });

import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import RootLayout, { metadata } from '@/app/layout';
import type { AuthUser } from '@/lib/auth/types';

const currentUser: AuthUser = {
  id: 'user-1',
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  imageUrl: null,
};

const Provider = ({ children }: { children: React.ReactNode }) => (
  <div data-testid="strategy-provider">{children}</div>
);

const makeStrategy = (overrides: Record<string, unknown> = {}) => ({
  getProviderComponent: jest.fn(() => Provider),
  getCurrentUser: jest.fn().mockResolvedValue(currentUser),
  getSignInUrl: jest.fn(() => '/sign-in'),
  getSignOutUrl: jest.fn(() => '/sign-out'),
  ...overrides,
});

beforeEach(() => {
  // reset, not clear: some tests install throwing implementations.
  jest.resetAllMocks();
});

describe('RootLayout', () => {
  it('validates the auth configuration before rendering anything', async () => {
    const strategy = makeStrategy();
    resolveAuthStrategy.mockReturnValue(strategy);

    await RootLayout({ children: <p>content</p> });

    expect(assertValidAuthConfig).toHaveBeenCalledWith(strategy);
  });

  it('refuses to render when no provider is configured', async () => {
    resolveAuthStrategy.mockImplementation(() => {
      throw new Error('AUTH_PROVIDER env var is required');
    });

    await expect(RootLayout({ children: <p>content</p> })).rejects.toThrow(
      'AUTH_PROVIDER env var is required',
    );
  });

  it('refuses to render when the provider is misconfigured', async () => {
    resolveAuthStrategy.mockReturnValue(makeStrategy());
    assertValidAuthConfig.mockImplementation(() => {
      throw new Error('Missing required auth configuration: CLERK_SECRET_KEY');
    });

    await expect(RootLayout({ children: <p>content</p> })).rejects.toThrow(
      'Missing required auth configuration: CLERK_SECRET_KEY',
    );
  });

  it('seeds the client provider with the server-resolved user and URLs', async () => {
    const strategy = makeStrategy();
    resolveAuthStrategy.mockReturnValue(strategy);

    const html = (await RootLayout({ children: <p>content</p> })) as ReactElement<
      Record<string, unknown>
    >;
    const body = html.props.children as ReactElement<Record<string, unknown>>;
    const [layoutContent] = body.props.children as ReactElement<Record<string, unknown>>[];

    expect(layoutContent.props).toMatchObject({
      ProviderComponent: Provider,
      currentUser,
      signInUrl: '/sign-in',
      signOutUrl: '/sign-out',
    });
    expect(strategy.getCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('renders the provider chain, navbar, page content and toaster', async () => {
    resolveAuthStrategy.mockReturnValue(makeStrategy());

    const html = (await RootLayout({ children: <p>content</p> })) as ReactElement<
      Record<string, unknown>
    >;
    const body = html.props.children as ReactElement<Record<string, unknown>>;
    const [layoutContent, toaster] = body.props.children as ReactElement<Record<string, unknown>>[];

    // The shell is a server component tree; render its resolved output.
    const resolved = await (layoutContent.type as (p: unknown) => Promise<ReactElement>)(
      layoutContent.props,
    );

    render(
      <>
        {resolved}
        {toaster}
      </>,
    );

    expect(screen.getByTestId('strategy-provider')).toBeInTheDocument();
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('top-navbar')).toBeInTheDocument();
    expect(screen.getByTestId('toaster')).toBeInTheDocument();
    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('sets the document metadata', () => {
    expect(metadata.title).toBe('VintaSend Templates');
    expect(metadata.description).toBe('Manage VintaSend notification templates and their versions');
  });

  it('declares the page language', async () => {
    resolveAuthStrategy.mockReturnValue(makeStrategy());

    const html = (await RootLayout({ children: <p>content</p> })) as ReactElement<
      Record<string, unknown>
    >;

    expect(html.props.lang).toBe('en');
  });
});
