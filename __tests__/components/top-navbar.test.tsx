const mockUseAuth = jest.fn();
let pathname = '/';

jest.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
}));

import { render, screen } from '@testing-library/react';

import { TopNavbar } from '@/app/components/top-navbar';

const user = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  imageUrl: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  pathname = '/';
  mockUseAuth.mockReturnValue({ user, signOutUrl: '/sign-out' });
});

it('renders nothing when nobody is signed in', () => {
  mockUseAuth.mockReturnValue({ user: null, signOutUrl: '/sign-out' });

  const { container } = render(<TopNavbar />);

  expect(container).toBeEmptyDOMElement();
});

it('links to both sections', () => {
  render(<TopNavbar />);

  expect(screen.getByRole('link', { name: 'Templates' })).toHaveAttribute('href', '/');
  expect(screen.getByRole('link', { name: 'Tags' })).toHaveAttribute('href', '/tags');
  expect(screen.getByRole('link', { name: 'VintaSend Templates' })).toHaveAttribute('href', '/');
});

it('marks the section the user is on', () => {
  pathname = '/tags';

  render(<TopNavbar />);

  expect(screen.getByRole('link', { name: 'Tags' })).toHaveAttribute('aria-current', 'page');

  // Templates is href="/", so it is matched on equality rather than as a
  // prefix — otherwise it would read as the current section on every route.
  expect(screen.getByRole('link', { name: 'Templates' })).not.toHaveAttribute('aria-current');
});

it('marks templates current on the root route', () => {
  render(<TopNavbar />);

  expect(screen.getByRole('link', { name: 'Templates' })).toHaveAttribute('aria-current', 'page');
});
