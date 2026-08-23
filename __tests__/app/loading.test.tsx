/**
 * Tests for the list loading skeleton.
 */

import { render, screen } from '@testing-library/react';

import LoadingDefault, { ListLoadingFallback } from '@/app/loading';

describe('ListLoadingFallback', () => {
  it('renders a table-shaped skeleton so the layout does not jump on load', () => {
    const { container } = render(<ListLoadingFallback />);

    expect(container.querySelectorAll('tbody tr')).toHaveLength(10);
    expect(container.querySelectorAll('thead th')).toHaveLength(7);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('is also the route-level default export Next renders', () => {
    expect(LoadingDefault).toBe(ListLoadingFallback);
  });
});
