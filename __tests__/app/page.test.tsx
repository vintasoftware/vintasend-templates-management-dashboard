/**
 * Tests for the two list routes.
 *
 * Neither page parses search params or fetches anything — the core's hooks read
 * the query string themselves — so all that is left to check is the Suspense
 * boundary, which Next requires around anything calling `useSearchParams`.
 * Without it the whole route silently opts out of static rendering, which is
 * the kind of regression nothing else would catch.
 */

jest.mock('@/app/components/templates-page-client', () => ({
  TemplatesPageClient: () => <div data-testid="templates-client" />,
}));

jest.mock('@/app/components/tags-page-client', () => ({
  TagsPageClient: () => <div data-testid="tags-client" />,
}));

import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';

import { ListLoadingFallback } from '@/app/loading';
import TemplatesPage from '@/app/page';
import TagsPage from '@/app/tags/page';

describe.each([
  ['templates', TemplatesPage, 'templates-client'],
  ['tags', TagsPage, 'tags-client'],
])('the %s route', (_name, Page, testId) => {
  it('wraps the client component in a Suspense boundary', () => {
    const page = Page() as ReactElement<Record<string, unknown>>;

    expect(page.props.fallback).toEqual(<ListLoadingFallback />);
  });

  it('renders the client component', () => {
    render(Page());

    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('takes no props, so the route needs no server-side fetch', () => {
    expect(Page).toHaveLength(0);
  });
});
