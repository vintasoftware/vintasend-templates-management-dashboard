/**
 * The tags page.
 *
 * Tags are simpler than templates — no ordering, no versions — so what these
 * cover is the vocabulary the contract insists on: the slug is the identity,
 * archiving is not deleting, and a rename regenerates the slug.
 */

const replace = jest.fn();

let currentSearch = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: jest.fn() }),
  usePathname: () => '/tags',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TagsPageClient } from '@/app/components/tags-page-client';

import {
  bodyOf,
  createFetchStub,
  dataResponse,
  lastQueryFor,
  paginated,
  renderWithTemplates,
  requestLog,
  tag,
  type StubbedResponse,
} from '../support/templates';

const renderPage = (routes: Record<string, StubbedResponse> = {}) => {
  const fetch = createFetchStub({
    '/api/v1/tags': { body: paginated([tag(), tag({ id: 't2', text: 'Old', slug: 'old', status: 'archived' })]) },
    ...routes,
  });

  renderWithTemplates(<TagsPageClient />, {
    fetch: fetch as unknown as typeof globalThis.fetch,
  });

  return fetch;
};

const lastReplacedQuery = () =>
  new URL(String(replace.mock.calls.at(-1)?.[0]), 'http://localhost').searchParams;

beforeEach(() => {
  jest.clearAllMocks();
  currentSearch = '';
});

it('lists tags with their slug, which is what filters match on', async () => {
  renderPage();

  expect(await screen.findByTestId('tag-row-marketing')).toHaveTextContent('marketing');
});

it('writes a status filter into the URL', async () => {
  const user = userEvent.setup();

  renderPage();

  await screen.findByTestId('tag-row-marketing');
  await user.click(screen.getByTestId('filter-tag-status-archived'));

  await waitFor(() => expect(lastReplacedQuery().getAll('status')).toEqual(['archived']));
});

it('carries a URL search term into the list request', async () => {
  currentSearch = 'search=mark';

  const fetch = renderPage();

  await screen.findByTestId('tag-row-marketing');

  await waitFor(() => expect(lastQueryFor(fetch, '/api/v1/tags').get('search')).toBe('mark'));
});

it('offers archive on an active tag and restore on an archived one', async () => {
  const user = userEvent.setup();

  renderPage();

  await user.click((await screen.findByTestId('tag-row-marketing')).querySelector('button') as HTMLElement);
  expect(await screen.findByTestId('archive-tag-marketing')).toBeInTheDocument();
  await user.keyboard('{Escape}');

  await user.click(screen.getByTestId('tag-row-old').querySelector('button') as HTMLElement);
  expect(await screen.findByTestId('restore-tag-old')).toBeInTheDocument();
});

it('archives through the dedicated route rather than a status write', async () => {
  const user = userEvent.setup();

  const fetch = renderPage({ '/api/v1/tags/marketing/archive': { body: dataResponse(tag({ status: 'archived' })) } });

  await user.click((await screen.findByTestId('tag-row-marketing')).querySelector('button') as HTMLElement);
  await user.click(await screen.findByTestId('archive-tag-marketing'));

  await waitFor(() =>
    expect(requestLog(fetch)).toContain('POST /api/templates/api/v1/tags/marketing/archive'),
  );
});

it('warns that renaming regenerates the slug', async () => {
  const user = userEvent.setup();

  renderPage();

  await user.click((await screen.findByTestId('tag-row-marketing')).querySelector('button') as HTMLElement);
  await user.click(await screen.findByTestId('rename-tag-marketing'));

  expect(await screen.findByTestId('rename-warning')).toHaveTextContent('regenerates the slug');
});

it('sends only the text on a rename — the slug is the server’s to derive', async () => {
  const user = userEvent.setup();

  const fetch = renderPage({
    '/api/v1/tags/marketing': { body: dataResponse(tag({ text: 'Growth', slug: 'growth' })) },
  });

  await user.click((await screen.findByTestId('tag-row-marketing')).querySelector('button') as HTMLElement);
  await user.click(await screen.findByTestId('rename-tag-marketing'));

  const input = screen.getByTestId('tag-form-text');
  await user.clear(input);
  await user.type(input, 'Growth');
  await user.click(screen.getByTestId('tag-form-submit'));

  await waitFor(async () =>
    expect(await bodyOf(fetch, 'PATCH', '/api/v1/tags/marketing')).toEqual({ text: 'Growth' }),
  );
});

it('shows the API message when the list fails', async () => {
  renderPage({
    '/api/v1/tags': {
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'The tag store is down.' } },
    },
  });

  expect(await screen.findByTestId('tags-error')).toHaveTextContent('The tag store is down.');
});
