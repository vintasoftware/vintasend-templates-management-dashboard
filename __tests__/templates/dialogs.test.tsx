/**
 * The write paths.
 *
 * Each of these dialogs is where the dashboard turns a click into a request, so
 * what the tests pin down is the request: which endpoint, and what is in the
 * body. The contract's two easy mistakes both live here — sending a whole
 * template where a diff was meant, and offering a status transition the
 * lifecycle does not allow.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DeleteTemplateDialog } from '@/app/components/delete-template-dialog';
import { TemplateFormDialog } from '@/app/components/template-form-dialog';
import { TemplatePreviewDialog } from '@/app/components/template-preview-dialog';
import { TemplateStatusDialog } from '@/app/components/template-status-dialog';
import { TemplateTagsDialog } from '@/app/components/template-tags-dialog';

import {
  bodyOf,
  createFetchStub,
  dataResponse,
  paginated,
  renderWithTemplates,
  requestLog,
  tag,
  template,
  type FetchStub,
  type StubbedResponse,
} from '../support/templates';

const renderDialog = (
  ui: React.ReactElement,
  routes: Record<string, StubbedResponse | ((request: Request) => StubbedResponse)> = {},
) => {
  const fetch = createFetchStub({
    '/api/v1/tags': { body: paginated([tag(), tag({ id: 't2', text: 'Billing', slug: 'billing' })]) },
    ...routes,
  });

  renderWithTemplates(ui, { fetch: fetch as unknown as typeof globalThis.fetch });

  return fetch;
};

describe('the version form', () => {
  it('sends only the fields that changed, because an omitted one is carried forward', async () => {
    const user = userEvent.setup();

    const fetch = renderDialog(
      <TemplateFormDialog target={template()} onClose={jest.fn()} />,
      { '/versions': { body: dataResponse(template({ version: 4 })) } },
    );

    const name = screen.getByTestId('form-name');
    await user.clear(name);
    await user.type(name, 'Welcome, revised');

    await user.click(screen.getByTestId('form-submit'));

    await waitFor(() => expect(requestLog(fetch).some((entry) => entry.startsWith('POST'))).toBe(true));

    const body = await bodyOf(fetch, 'POST', '/versions');

    expect(body).toEqual({ name: 'Welcome, revised' });
    expect(body).not.toHaveProperty('bodyTemplate');
  });

  it('accepts an empty body, which branches a version off unchanged', async () => {
    const user = userEvent.setup();

    const fetch = renderDialog(
      <TemplateFormDialog target={template()} onClose={jest.fn()} />,
      { '/versions': { body: dataResponse(template({ version: 4 })) } },
    );

    await user.click(screen.getByTestId('form-submit'));

    await waitFor(async () => expect(await bodyOf(fetch, 'POST', '/versions')).toEqual({}));
  });

  it('posts to the collection when creating, with the fields only a first version has', async () => {
    const user = userEvent.setup();

    const fetch = renderDialog(<TemplateFormDialog target="create" onClose={jest.fn()} />, {
      '/api/v1/templates': { body: dataResponse(template({ version: 1 })) },
    });

    await user.type(screen.getByTestId('form-key'), 'password-reset');
    await user.type(screen.getByTestId('form-backend'), 'prisma');
    await user.type(screen.getByTestId('form-name'), 'Password reset');
    await user.type(screen.getByTestId('form-body'), 'Hello');

    await user.click(screen.getByTestId('form-submit'));

    await waitFor(async () => {
      const body = await bodyOf(fetch, 'POST', '/api/v1/templates');

      expect(body).toMatchObject({
        key: 'password-reset',
        templateManagedBackend: 'prisma',
        name: 'Password reset',
        bodyTemplate: 'Hello',
      });
    });
  });

  it('will not submit a new template without the fields the API requires', async () => {
    renderDialog(<TemplateFormDialog target="create" onClose={jest.fn()} />);

    expect(screen.getByTestId('form-submit')).toBeDisabled();
  });
});

describe('the status dialog', () => {
  it('offers only the transitions the version itself reports', async () => {
    renderDialog(
      <TemplateStatusDialog
        template={template({ status: 'draft', allowedTransitions: ['active'] })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('transition-active')).toBeInTheDocument();
    expect(screen.queryByTestId('transition-archived')).not.toBeInTheDocument();
  });

  it('says so when a version is at a terminal status', () => {
    renderDialog(
      <TemplateStatusDialog
        template={template({ status: 'archived', allowedTransitions: [] })}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByTestId('no-transitions')).toBeInTheDocument();
  });

  it('names the version explicitly, since omitting it would mean the latest', async () => {
    const user = userEvent.setup();

    const fetch = renderDialog(
      <TemplateStatusDialog
        template={template({ version: 2, allowedTransitions: ['archived'] })}
        onClose={jest.fn()}
      />,
      { '/status': { body: dataResponse(template({ version: 2, status: 'archived' })) } },
    );

    await user.click(screen.getByTestId('status-changed-by'));
    await user.keyboard('ada');
    await user.click(screen.getByTestId('transition-archived'));

    await waitFor(async () =>
      expect(await bodyOf(fetch, 'POST', '/status')).toEqual({
        status: 'archived',
        version: 2,
        changedBy: 'ada',
      }),
    );
  });
});

describe('the tags dialog', () => {
  it('sends the whole set, because the endpoint replaces rather than merges', async () => {
    const user = userEvent.setup();

    const fetch = renderDialog(
      <TemplateTagsDialog
        template={template({ tags: [tag()] })}
        onClose={jest.fn()}
      />,
      { '/tags': { body: dataResponse(template()) } },
    );

    await user.click(await screen.findByTestId('tag-option-billing'));
    await user.click(screen.getByTestId('save-tags'));

    await waitFor(async () =>
      expect(await bodyOf(fetch, 'PUT', '/tags')).toEqual({
        tags: ['marketing', 'billing'],
        version: 3,
      }),
    );
  });
});

describe('the delete dialog', () => {
  it('deletes the single version by default', async () => {
    const user = userEvent.setup();

    const fetch = renderDialog(
      <DeleteTemplateDialog template={template()} onClose={jest.fn()} />,
      { '/api/v1/templates': { body: dataResponse(null) } },
    );

    await user.click(screen.getByTestId('confirm-delete-template'));

    await waitFor(() =>
      expect(requestLog(fetch)).toContain(
        'DELETE /api/templates/api/v1/templates/welcome-email/versions/3',
      ),
    );
  });

  it('deletes every version when the wider scope is chosen', async () => {
    const user = userEvent.setup();

    const fetch = renderDialog(
      <DeleteTemplateDialog template={template()} onClose={jest.fn()} />,
      { '/api/v1/templates': { body: dataResponse(null) } },
    );

    await user.click(screen.getByTestId('delete-scope'));
    await user.click(await screen.findByText('Every version of welcome-email'));
    await user.click(screen.getByTestId('confirm-delete-template'));

    await waitFor(() =>
      expect(requestLog(fetch)).toContain('DELETE /api/templates/api/v1/templates/welcome-email'),
    );
  });
});

describe('the preview dialog', () => {
  const preview = (overrides: Record<string, unknown> = {}) =>
    dataResponse({
      key: 'welcome-email',
      version: 3,
      renderedBody: '<p>Hello Ada</p>',
      renderedSubject: 'Welcome, Ada',
      renderedPreheader: null,
      ...overrides,
    });

  it('renders once on open, against an empty context', async () => {
    const fetch = renderDialog(
      <TemplatePreviewDialog template={template()} onClose={jest.fn()} />,
      { '/preview': { body: preview() } },
    );

    expect(await screen.findByTestId('preview-success')).toBeInTheDocument();
    expect(await bodyOf(fetch, 'POST', '/preview')).toEqual({ context: {}, version: 3 });
  });

  it('omits a field the renderer did not produce', async () => {
    renderDialog(<TemplatePreviewDialog template={template()} onClose={jest.fn()} />, {
      '/preview': { body: preview({ renderedSubject: null }) },
    });

    await screen.findByTestId('preview-success');

    expect(screen.queryByTestId('preview-subject')).not.toBeInTheDocument();
    expect(screen.getByTestId('preview-body')).toBeInTheDocument();
  });

  it('refuses to send a context that is not valid JSON', async () => {
    const user = userEvent.setup();

    const fetch = renderDialog(
      <TemplatePreviewDialog template={template()} onClose={jest.fn()} />,
      { '/preview': { body: preview() } },
    );

    await screen.findByTestId('preview-success');

    const context = screen.getByTestId('preview-context');
    await user.clear(context);
    await user.type(context, '{{ not json');

    await user.click(screen.getByTestId('preview-render'));

    expect(await screen.findByTestId('preview-parse-error')).toBeInTheDocument();

    // Still only the render that ran on open.
    expect(requestLog(fetch).filter((entry) => entry.includes('/preview'))).toHaveLength(1);
  });

  it('reads PREVIEW_UNAVAILABLE as an explanation rather than a failure', async () => {
    renderDialog(<TemplatePreviewDialog template={template()} onClose={jest.fn()} />, {
      '/preview': {
        status: 422,
        body: {
          error: { code: 'PREVIEW_UNAVAILABLE', message: 'This renderer cannot preview.' },
        },
      },
    });

    const error = await screen.findByTestId('preview-error');

    expect(error).toHaveTextContent('This renderer cannot preview.');
    expect(error.querySelector('.text-destructive')).toBeNull();
  });
});

/** Guards the harness itself: an unstubbed call should be loud, not empty. */
it('fails a request the stub does not know about', async () => {
  const fetch: FetchStub = createFetchStub({});
  const response = await fetch(new Request('http://localhost/api/templates/api/v1/nope'));

  expect(response.status).toBe(404);
});
