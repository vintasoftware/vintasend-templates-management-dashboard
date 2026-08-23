/**
 * The tag write paths that the page test does not reach.
 *
 * Deleting a tag and creating one inline from a template form are both places
 * where the slug/text distinction matters: the client sends text, the server
 * answers with the slug, and the slug is what everything else holds on to.
 */

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DeleteTagDialog } from '@/app/components/delete-tag-dialog';
import { TagPicker } from '@/app/components/tag-picker';

import {
  bodyOf,
  createFetchStub,
  dataResponse,
  paginated,
  renderWithTemplates,
  requestLog,
  tag,
  type StubbedResponse,
} from '../support/templates';

type Route = StubbedResponse | ((request: Request) => StubbedResponse);

const withTags = (routes: Record<string, Route> = {}) =>
  createFetchStub({
    '/api/v1/tags': { body: paginated([tag(), tag({ id: 't2', text: 'Billing', slug: 'billing' })]) },
    ...routes,
  });

describe('deleting a tag', () => {
  it('points at archiving, which is what most people mean', () => {
    const fetch = withTags();

    renderWithTemplates(<DeleteTagDialog tag={tag()} onClose={jest.fn()} />, {
      fetch: fetch as unknown as typeof globalThis.fetch,
    });

    expect(screen.getByText(/Archiving keeps the tag attached/)).toBeInTheDocument();
  });

  it('deletes by slug', async () => {
    const user = userEvent.setup();
    const onClose = jest.fn();
    const fetch = withTags({ '/api/v1/tags/marketing': { body: dataResponse(null) } });

    renderWithTemplates(<DeleteTagDialog tag={tag()} onClose={onClose} />, {
      fetch: fetch as unknown as typeof globalThis.fetch,
    });

    await user.click(screen.getByTestId('confirm-delete-tag'));

    await waitFor(() =>
      expect(requestLog(fetch)).toContain('DELETE /api/templates/api/v1/tags/marketing'),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('stays closed when there is no tag to delete', () => {
    const fetch = withTags();

    renderWithTemplates(<DeleteTagDialog tag={null} onClose={jest.fn()} />, {
      fetch: fetch as unknown as typeof globalThis.fetch,
    });

    expect(screen.queryByTestId('confirm-delete-tag')).not.toBeInTheDocument();
  });
});

describe('the tag picker', () => {
  const renderPicker = (
    value: string[] = [],
    routes: Record<string, Route> = {},
    props: Partial<React.ComponentProps<typeof TagPicker>> = {},
  ) => {
    const onChange = jest.fn();
    const fetch = withTags(routes);

    renderWithTemplates(
      <TagPicker value={value} onChange={onChange} allowCreate {...props} />,
      { fetch: fetch as unknown as typeof globalThis.fetch },
    );

    return { onChange, fetch };
  };

  it('selects by slug rather than by name', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker();

    await user.click(await screen.findByTestId('tag-option-billing'));

    expect(onChange).toHaveBeenCalledWith(['billing']);
  });

  it('unticks a tag that is already selected', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPicker(['marketing', 'billing']);

    await user.click(await screen.findByTestId('tag-option-marketing'));

    expect(onChange).toHaveBeenCalledWith(['billing']);
  });

  it('keeps a selected slug the list no longer offers, such as an archived tag', async () => {
    renderPicker(['retired']);

    expect(await screen.findByText('Also selected:')).toBeInTheDocument();
    expect(screen.getByText('retired')).toBeInTheDocument();
  });

  it('reads the new tag’s slug off the response rather than guessing it', async () => {
    const user = userEvent.setup();

    const { onChange, fetch } = renderPicker([], {
      // The server derives the slug; "Q3 Campaign" is not "q3 campaign".
      '/api/v1/tags': (request) =>
        request.method === 'POST'
          ? { body: dataResponse(tag({ id: 't3', text: 'Q3 Campaign', slug: 'q3-campaign' })) }
          : { body: paginated([tag()]) },
    });

    await user.type(screen.getByTestId('new-tag-input'), 'Q3 Campaign');
    await user.click(screen.getByTestId('create-tag-inline'));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(['q3-campaign']));
    expect(await bodyOf(fetch, 'POST', '/api/v1/tags')).toEqual({ text: 'Q3 Campaign' });
  });

  it('will not create a tag with no name', async () => {
    renderPicker();

    expect(screen.getByTestId('create-tag-inline')).toBeDisabled();
  });

  it('hides the create box when the caller did not ask for it', async () => {
    renderPicker([], {}, { allowCreate: false });

    await screen.findByTestId('tag-option-marketing');

    expect(screen.queryByTestId('new-tag-input')).not.toBeInTheDocument();
  });
});
