/**
 * The detail panel.
 *
 * Five reads back this panel and two of them behave in ways worth pinning down:
 * composition is what the engine actually receives rather than what was typed,
 * and the status history is the one endpoint where omitting `version` means
 * every version rather than the latest.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { TemplateDetail } from '@/app/components/template-detail';

import {
  createFetchStub,
  dataResponse,
  renderWithTemplates,
  requestLog,
  tag,
  template,
  type StubbedResponse,
} from '../support/templates';

const composition = (overrides: Record<string, unknown> = {}) =>
  dataResponse({
    key: 'welcome-email',
    version: 3,
    isAbstract: false,
    references: [{ kind: 'extends', key: 'base-email', version: null, field: 'bodyTemplate' }],
    composedBodyTemplate: '<html><p>Hello {{ name }}</p></html>',
    composedSubjectTemplate: 'Welcome, {{ name }}',
    composedPreheaderTemplate: null,
    ...overrides,
  });

const renderDetail = (
  routes: Record<string, StubbedResponse> = {},
  props: Partial<React.ComponentProps<typeof TemplateDetail>> = {},
) => {
  const fetch = createFetchStub({
    '/api/v1/templates/welcome-email/versions': { body: { data: [template()] } },
    '/api/v1/templates/welcome-email/composition': { body: composition() },
    '/api/v1/templates/welcome-email/status-history': { body: { data: [] } },
    '/api/v1/templates/welcome-email': { body: dataResponse(template({ tags: [tag()] })) },
    ...routes,
  });

  renderWithTemplates(
    <TemplateDetail
      selection={{ key: 'welcome-email', version: 3 }}
      onClose={jest.fn()}
      onSelectVersion={jest.fn()}
      {...props}
    />,
    { fetch: fetch as unknown as typeof globalThis.fetch },
  );

  return fetch;
};

it('stays idle while it is closed', async () => {
  const fetch = createFetchStub({});

  renderWithTemplates(
    <TemplateDetail selection={null} onClose={jest.fn()} onSelectVersion={jest.fn()} />,
    { fetch: fetch as unknown as typeof globalThis.fetch },
  );

  await waitFor(() => expect(fetch).not.toHaveBeenCalled());
});

it('shows the version, its status and its tags', async () => {
  renderDetail();

  const content = await screen.findByTestId('template-detail-content');

  expect(content).toHaveTextContent('welcome-email');
  expect(content).toHaveTextContent('Marketing');
  expect(screen.getByTestId('template-status-active')).toBeInTheDocument();
});

it('asks for the whole key’s status history, not just this version’s', async () => {
  const fetch = renderDetail();

  await screen.findByTestId('template-detail-content');

  await waitFor(() =>
    expect(
      requestLog(fetch).some((entry) => entry.includes('/status-history') && !entry.includes('version=')),
    ).toBe(true),
  );
});

it('separates what was typed from what the engine receives', async () => {
  const user = userEvent.setup();

  renderDetail();

  await screen.findByTestId('template-detail-content');

  await user.click(screen.getByRole('tab', { name: 'Source' }));
  expect(await screen.findByTestId('source-body')).toHaveTextContent('<p>Hello {{ name }}</p>');

  await user.click(screen.getByRole('tab', { name: 'Composition' }));
  expect(await screen.findByTestId('composed-body')).toHaveTextContent(
    '<html><p>Hello {{ name }}</p></html>',
  );
});

it('explains a reference with no version as resolving to the latest', async () => {
  const user = userEvent.setup();

  renderDetail();

  await screen.findByTestId('template-detail-content');
  await user.click(screen.getByRole('tab', { name: 'Composition' }));

  const references = await screen.findByTestId('template-composition');

  expect(references).toHaveTextContent('base-email');
  expect(references).toHaveTextContent('latest');
});

it('explains a broken inheritance chain rather than only reporting it', async () => {
  const user = userEvent.setup();

  renderDetail({
    '/api/v1/templates/welcome-email/composition': {
      status: 422,
      body: {
        error: {
          code: 'TEMPLATE_COMPOSITION_ERROR',
          message: 'base-email could not be resolved.',
        },
      },
    },
  });

  await screen.findByTestId('template-detail-content');
  await user.click(screen.getByRole('tab', { name: 'Composition' }));

  const error = await screen.findByTestId('composition-error');

  expect(error).toHaveTextContent('base-email could not be resolved.');
  expect(error).toHaveTextContent('extends or includes a template that could not be resolved');
});

it('says when a backend keeps no audit trail, instead of showing an empty list', async () => {
  const user = userEvent.setup();

  renderDetail();

  await screen.findByTestId('template-detail-content');
  await user.click(screen.getByRole('tab', { name: 'History' }));

  expect(await screen.findByTestId('template-history-empty')).toBeInTheDocument();
});

it('switches to another version from the versions tab', async () => {
  const user = userEvent.setup();
  const onSelectVersion = jest.fn();

  renderDetail(
    {
      '/api/v1/templates/welcome-email/versions': {
        body: { data: [template(), template({ id: 'tpl-2', version: 2, status: 'inactive' })] },
      },
    },
    { onSelectVersion },
  );

  await screen.findByTestId('template-detail-content');
  await user.click(screen.getByRole('tab', { name: 'Versions' }));
  await user.click(await screen.findByTestId('version-2'));

  expect(onSelectVersion).toHaveBeenCalledWith({ key: 'welcome-email', version: 2 });
});

it('opens on the tab it was asked for', async () => {
  renderDetail({}, { defaultTab: 'history' });

  expect(await screen.findByTestId('template-history-empty')).toBeInTheDocument();
});
