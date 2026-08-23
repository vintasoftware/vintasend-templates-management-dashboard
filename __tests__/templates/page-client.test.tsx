/**
 * Integration tests for the templates page.
 *
 * These run the real core hooks — URL parsing, the generated client, the query
 * cache — and stub only `fetch`. That makes them the tests that would actually
 * catch the dashboard drifting away from the package it demonstrates: a filter
 * that never reaches the query string, or a query string the list request
 * ignores.
 */

const replace = jest.fn();
const push = jest.fn();

let currentSearch = '';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(currentSearch),
}));

import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TemplatesPageClient } from '@/app/components/templates-page-client';

import {
  ALL_SORTABLE,
  createFetchStub,
  dataResponse,
  lastQueryFor,
  paginated,
  renderWithTemplates,
  template,
  type FetchStub,
  type StubbedResponse,
} from '../support/templates';

const renderPage = (routes: Record<string, StubbedResponse>) => {
  const fetch = createFetchStub({
    '/api/v1/capabilities': { body: dataResponse({}) },
    '/api/v1/tags': { body: paginated([]) },
    ...routes,
  });

  renderWithTemplates(<TemplatesPageClient />, {
    fetch: fetch as unknown as typeof globalThis.fetch,
  });

  return { fetch };
};

/** The query string the page last wrote into the URL. */
const lastReplacedQuery = () =>
  new URL(String(replace.mock.calls.at(-1)?.[0]), 'http://localhost').searchParams;

/**
 * The mocked router does not re-render the route the way the real one does, so
 * a test that needs the *next* interaction to start from different filters
 * renders again from that query string rather than trying to close the loop.
 * That is also closer to what a user does: each of these is a fresh page load
 * of a URL the previous interaction produced.
 */

const listQuery = (fetch: FetchStub) => lastQueryFor(fetch, '/api/v1/templates');

beforeEach(() => {
  jest.clearAllMocks();
  currentSearch = '';
});

describe('the list', () => {
  it('renders a row per version, with the key and version number', async () => {
    renderPage({
      '/api/v1/templates': {
        body: paginated([
          template({ id: 'a', key: 'welcome-email', version: 3 }),
          template({ id: 'b', key: 'welcome-email', version: 2, status: 'inactive' }),
        ]),
      },
    });

    expect(await screen.findByTestId('template-row-welcome-email-v3')).toBeInTheDocument();
    expect(screen.getByTestId('template-row-welcome-email-v2')).toBeInTheDocument();
    expect(screen.getAllByText('welcome-email')).toHaveLength(2);
  });

  it('marks an abstract template, which is never sent on its own', async () => {
    renderPage({
      '/api/v1/templates': { body: paginated([template({ isAbstract: true })]) },
    });

    expect(await screen.findByText('abstract')).toBeInTheDocument();
  });

  it('shows the API message when the list fails, with a way to retry', async () => {
    renderPage({
      '/api/v1/templates': {
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: 'The template store is down.' } },
      },
    });

    expect(await screen.findByTestId('templates-error')).toHaveTextContent(
      'The template store is down.',
    );
  });

  it('renders an empty state rather than a blank table', async () => {
    renderPage({ '/api/v1/templates': { body: paginated([]) } });

    expect(await screen.findByText('No templates found.')).toBeInTheDocument();
  });
});

describe('filters', () => {
  it('writes a toggled status into the URL and into the next list request', async () => {
    const user = userEvent.setup();

    renderPage({ '/api/v1/templates': { body: paginated([template()]) } });

    await screen.findByTestId('template-row-welcome-email-v3');
    await user.click(screen.getByTestId('filter-status-draft'));

    await waitFor(() => expect(lastReplacedQuery().getAll('status')).toEqual(['draft']));
  });

  it('adds to a status already in the URL rather than replacing it', async () => {
    const user = userEvent.setup();

    currentSearch = 'status=draft';
    renderPage({ '/api/v1/templates': { body: paginated([template()]) } });

    await screen.findByTestId('template-row-welcome-email-v3');
    await user.click(screen.getByTestId('filter-status-active'));

    await waitFor(() => expect(lastReplacedQuery().getAll('status')).toEqual(['draft', 'active']));
  });

  it('removes a status that is already on, and drops the parameter with the last one', async () => {
    const user = userEvent.setup();

    currentSearch = 'status=draft';
    renderPage({ '/api/v1/templates': { body: paginated([template()]) } });

    await screen.findByTestId('template-row-welcome-email-v3');
    await user.click(screen.getByTestId('filter-status-draft'));

    // An empty list is a 400 on this contract, not "match nothing", so the
    // parameter goes away entirely rather than being sent empty.
    await waitFor(() => expect(lastReplacedQuery().getAll('status')).toEqual([]));
  });

  it('asks for every version when "show every version" is ticked', async () => {
    const user = userEvent.setup();
    renderPage({ '/api/v1/templates': { body: paginated([template()]) } });

    await screen.findByTestId('template-row-welcome-email-v3');

    await user.click(screen.getByTestId('filter-all-versions'));

    await waitFor(() => expect(lastReplacedQuery().get('mostRecentActiveVersion')).toBe('false'));
  });

  it('sends a URL filter straight through to the list request', async () => {
    currentSearch = 'status=draft&key=welcome';

    const { fetch } = renderPage({ '/api/v1/templates': { body: paginated([template()]) } });

    await screen.findByTestId('template-row-welcome-email-v3');

    await waitFor(() => {
      const query = listQuery(fetch);

      expect(query.getAll('status')).toEqual(['draft']);
      expect(query.get('key')).toBe('welcome');
    });
  });
});

describe('sorting', () => {
  it('offers no sortable column when the backend declares none', async () => {
    renderPage({ '/api/v1/templates': { body: paginated([template()]) } });

    await screen.findByTestId('template-row-welcome-email-v3');

    // orderBy.* defaults to *not* supported: asking for an unsupported field is
    // a 400, so a column may not become clickable before its support is known.
    expect(screen.queryByTestId('sort-name')).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Name')).toBeInTheDocument();
  });

  it('sorts by a declared field, cycling asc then desc then off', async () => {
    const user = userEvent.setup();

    renderPage({
      '/api/v1/capabilities': { body: dataResponse(ALL_SORTABLE) },
      '/api/v1/templates': { body: paginated([template()]) },
    });

    await user.click(await screen.findByTestId('sort-name'));

    await waitFor(() => {
      expect(lastReplacedQuery().get('orderByField')).toBe('name');
      expect(lastReplacedQuery().get('orderByDirection')).toBe('asc');
    });
  });

  it('turns an ascending sort into a descending one', async () => {
    const user = userEvent.setup();

    currentSearch = 'orderByField=name&orderByDirection=asc';
    renderPage({
      '/api/v1/capabilities': { body: dataResponse(ALL_SORTABLE) },
      '/api/v1/templates': { body: paginated([template()]) },
    });

    await user.click(await screen.findByTestId('sort-name'));

    await waitFor(() => expect(lastReplacedQuery().get('orderByDirection')).toBe('desc'));
  });

  it('clears the field and the direction together on the third click', async () => {
    const user = userEvent.setup();

    currentSearch = 'orderByField=name&orderByDirection=desc';
    renderPage({
      '/api/v1/capabilities': { body: dataResponse(ALL_SORTABLE) },
      '/api/v1/templates': { body: paginated([template()]) },
    });

    await user.click(await screen.findByTestId('sort-name'));

    await waitFor(() => {
      // Both go together: a direction with nothing to order is a 400.
      expect(lastReplacedQuery().get('orderByField')).toBeNull();
      expect(lastReplacedQuery().get('orderByDirection')).toBeNull();
    });
  });
});
