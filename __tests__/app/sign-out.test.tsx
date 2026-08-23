/**
 * Tests for the sign-out route.
 *
 * Signing out has to actually terminate the session for whichever provider is
 * configured — a page that only says "Signing out..." would be a security bug.
 */

const signOut = jest.fn();

jest.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ signOut }),
}));

import { render, screen } from '@testing-library/react';
import SignOutPage from '@/app/sign-out/[[...sign-out]]/page';

const savedProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER;

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  if (savedProvider === undefined) delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;
  else process.env.NEXT_PUBLIC_AUTH_PROVIDER = savedProvider;
});

describe('SignOutPage', () => {
  it('tells the user what is happening', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';

    render(<SignOutPage />);

    expect(screen.getByText('Signing out...')).toBeInTheDocument();
  });

  it('signs the user out through Clerk and returns them to the root', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'clerk';

    render(<SignOutPage />);

    expect(signOut).toHaveBeenCalledWith({ redirectUrl: '/' });
  });

  it('defaults to the Clerk sign-out when no provider is configured', () => {
    delete process.env.NEXT_PUBLIC_AUTH_PROVIDER;

    render(<SignOutPage />);

    expect(signOut).toHaveBeenCalledWith({ redirectUrl: '/' });
  });

  it('sends the browser to the Auth0 logout endpoint with a return URL', () => {
    process.env.NEXT_PUBLIC_AUTH_PROVIDER = 'auth0';
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<SignOutPage />);

    expect(signOut).not.toHaveBeenCalled();
    // jsdom locks window.location against stubbing, so the observable signal of
    // the assignment is its refusal to navigate.
    expect(
      consoleError.mock.calls.some((call) =>
        String(call[0]).includes('Not implemented: navigation'),
      ),
    ).toBe(true);

    consoleError.mockRestore();
  });
});
