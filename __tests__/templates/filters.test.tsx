/**
 * The filter bar.
 *
 * Two behaviours here are contract-shaped rather than cosmetic: a control is
 * not rendered at all for a filter the backend cannot honour (an unsupported
 * filter is *dropped*, so the input would silently do nothing), and switching
 * between "has all of" and "has any of" moves the selection rather than losing
 * it, because those are two separate query parameters.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TemplatesFilters } from '@/app/components/templates-filters';

import {
  createFetchStub,
  dataResponse,
  paginated,
  TemplatesTestProvider,
  tag,
  type StubbedResponse,
} from '../support/templates';

const renderFilters = (
  props: Partial<React.ComponentProps<typeof TemplatesFilters>> = {},
  routes: Record<string, StubbedResponse> = {},
) => {
  const handlers = {
    patchFilters: jest.fn(),
    toggleStatus: jest.fn(),
    toggleTag: jest.fn(),
    clearFilters: jest.fn(),
  };

  const fetch = createFetchStub({
    '/api/v1/capabilities': { body: dataResponse({}) },
    '/api/v1/tags': {
      body: paginated([tag(), tag({ id: 't2', text: 'Billing', slug: 'billing' })]),
    },
    ...routes,
  });

  render(
    <TemplatesTestProvider fetch={fetch as unknown as typeof globalThis.fetch}>
      <TemplatesFilters filters={{}} hasActiveFilters={false} {...handlers} {...props} />
    </TemplatesTestProvider>,
  );

  return handlers;
};

it('hides a control for a filter the backend cannot honour', async () => {
  renderFilters(
    {},
    {
      '/api/v1/capabilities': {
        body: dataResponse({ 'fields.isAbstract': false, 'fields.description': false }),
      },
    },
  );

  await waitFor(() => expect(screen.queryByTestId('filter-abstract')).not.toBeInTheDocument());
  expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();

  // A key the backend did not mention is supported — backends declare only what
  // they cannot do.
  expect(screen.getByLabelText('Key')).toBeInTheDocument();
});

it('debounces a text filter rather than writing on every keystroke', async () => {
  const user = userEvent.setup();
  const { patchFilters } = renderFilters();

  await user.type(screen.getByLabelText('Key'), 'welcome');

  expect(patchFilters).not.toHaveBeenCalled();

  await waitFor(() => expect(patchFilters).toHaveBeenCalledWith({ key: 'welcome' }));
  expect(patchFilters).toHaveBeenCalledTimes(1);
});

it('clears a text filter to undefined rather than to an empty string', async () => {
  const user = userEvent.setup();
  const { patchFilters } = renderFilters({ filters: { key: 'welcome' } });

  await user.clear(screen.getByLabelText('Key'));

  await waitFor(() => expect(patchFilters).toHaveBeenCalledWith({ key: undefined }));
});

it('carries the selection across when the tag mode changes', async () => {
  const user = userEvent.setup();
  const { patchFilters } = renderFilters({
    filters: { includesAllTags: ['marketing', 'billing'] },
  });

  await user.click(screen.getByTestId('filter-tag-mode'));
  await user.click(await screen.findByText('Has any of'));

  expect(patchFilters).toHaveBeenCalledWith({
    includesAllTags: undefined,
    includesAnyOfTags: ['marketing', 'billing'],
  });
});

it('reads a selection out of whichever tag parameter is set', async () => {
  const user = userEvent.setup();
  const { toggleTag } = renderFilters({ filters: { includesAnyOfTags: ['marketing'] } });

  await user.click(screen.getByTestId('filter-tags-trigger'));
  await user.click(await screen.findByTestId('filter-tag-billing'));

  expect(toggleTag).toHaveBeenCalledWith('billing', 'any');
});

it('sends both bounds of a date range together', async () => {
  const { patchFilters } = renderFilters({
    filters: { createdAtFrom: '2024-01-01T00:00:00.000Z' },
  });

  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Clear created date filter/ }));

  expect(patchFilters).toHaveBeenCalledWith({
    createdAtFrom: undefined,
    createdAtTo: undefined,
  });
});

it('asks for every version by removing the parameter, not by sending true', async () => {
  const user = userEvent.setup();
  const { patchFilters } = renderFilters({ filters: { mostRecentActiveVersion: false } });

  // Already ticked, so this un-ticks it: back to the server's own default,
  // which the URL expresses by saying nothing.
  await user.click(screen.getByTestId('filter-all-versions'));

  expect(patchFilters).toHaveBeenCalledWith({ mostRecentActiveVersion: undefined });
});

it('offers "clear filters" only when something is set', async () => {
  const user = userEvent.setup();

  const { clearFilters } = renderFilters({
    hasActiveFilters: true,
    filters: { status: ['draft'] },
  });

  await user.click(screen.getByTestId('clear-filters'));

  expect(clearFilters).toHaveBeenCalled();
});

it('hides "clear filters" when nothing is set', () => {
  renderFilters();

  expect(screen.queryByTestId('clear-filters')).not.toBeInTheDocument();
});

it('ignores a version filter that is not a number', async () => {
  const user = userEvent.setup();
  const { patchFilters } = renderFilters();

  await user.type(screen.getByLabelText('Version'), '2');

  expect(patchFilters).toHaveBeenCalledWith({ version: 2 });
});
