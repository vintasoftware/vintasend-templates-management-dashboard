/**
 * Tests for the sign-in route.
 *
 * The route serves two very different providers: Clerk renders its widget in
 * place, Auth0 has to bounce straight to its hosted login.
 */

const resolveAuthStrategy = jest.fn();
const redirect = jest.fn(() => {
  // Next's redirect() never returns; it throws a control-flow signal.
  throw new Error('NEXT_REDIRECT');
});

jest.mock('@/lib/auth', () => ({
  resolveAuthStrategy: (...args: unknown[]) => resolveAuthStrategy(...(args as [])),
}));

jest.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => redirect(...(args as [])),
}));

jest.mock('@clerk/nextjs', () => ({
  SignIn: () => <div data-testid="clerk-sign-in" />,
}));

import { render, screen } from '@testing-library/react';
import SignInPage from '@/app/sign-in/[[...sign-in]]/page';

const savedProvider = process.env.AUTH_PROVIDER;

beforeEach(() => {
  jest.clearAllMocks();
  resolveAuthStrategy.mockReturnValue({ getSignInUrl: () => '/auth/login' });
});

afterEach(() => {
  if (savedProvider === undefined) delete process.env.AUTH_PROVIDER;
  else process.env.AUTH_PROVIDER = savedProvider;
});

describe('SignInPage', () => {
  it('renders the Clerk widget when Clerk is the provider', () => {
    process.env.AUTH_PROVIDER = 'clerk';

    render(SignInPage());

    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('renders the Clerk widget when no provider is set', () => {
    delete process.env.AUTH_PROVIDER;

    render(SignInPage());

    expect(screen.getByTestId('clerk-sign-in')).toBeInTheDocument();
  });

  it("redirects to the strategy's login URL under Auth0", () => {
    process.env.AUTH_PROVIDER = 'auth0';

    expect(() => SignInPage()).toThrow('NEXT_REDIRECT');
    expect(redirect).toHaveBeenCalledWith('/auth/login');
  });
});
