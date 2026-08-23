/**
 * The row action menu.
 *
 * The menu is where the versioned model shows up as UI: there is no "edit", the
 * status action is offered only while the lifecycle has somewhere to go, and
 * "delete" always names a version as well as a key.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ManagedTemplate } from 'vintasend-templates-management-dashboard-core';

import { TemplatesTable } from '@/app/components/templates-table';

import { template } from '../support/templates';

const renderTable = (
  rows: ManagedTemplate[],
  overrides: Partial<React.ComponentProps<typeof TemplatesTable>> = {},
) => {
  const handlers = {
    onViewDetails: jest.fn(),
    onViewHistory: jest.fn(),
    onCreateVersion: jest.fn(),
    onPreview: jest.fn(),
    onEditTags: jest.fn(),
    onChangeStatus: jest.fn(),
    onDelete: jest.fn(),
    onRowClick: jest.fn(),
    onSort: jest.fn(),
    onNextPage: jest.fn(),
    onPreviousPage: jest.fn(),
  };

  render(
    <TemplatesTable
      data={rows}
      page={1}
      pageSize={20}
      hasNextPage={false}
      hasPreviousPage={false}
      sortableFields={[]}
      {...handlers}
      {...overrides}
    />,
  );

  return handlers;
};

const openMenu = async (user: ReturnType<typeof userEvent.setup>, index = 0) => {
  await user.click(screen.getAllByRole('button', { name: 'Open menu' })[index]);
};

it('opens the detail panel from the row itself as well as from the menu', async () => {
  const user = userEvent.setup();
  const row = template();
  const { onRowClick, onViewDetails } = renderTable([row]);

  await user.click(screen.getByTestId('template-row-welcome-email-v3'));
  expect(onRowClick).toHaveBeenCalledWith(row);

  await openMenu(user);
  await user.click(await screen.findByTestId(`view-details-${row.id}`));
  expect(onViewDetails).toHaveBeenCalledWith(row);
});

it('calls the edit action a new version, because that is what an edit is here', async () => {
  const user = userEvent.setup();
  const row = template();
  const { onCreateVersion } = renderTable([row]);

  await openMenu(user);

  expect(screen.queryByText('Edit')).not.toBeInTheDocument();

  await user.click(await screen.findByTestId(`new-version-${row.id}`));
  expect(onCreateVersion).toHaveBeenCalledWith(row);
});

it('offers a status change only while the lifecycle has somewhere to go', async () => {
  const user = userEvent.setup();
  const terminal = template({ id: 'tpl-terminal', allowedTransitions: [] });

  renderTable([terminal]);

  await openMenu(user);

  expect(await screen.findByTestId(`preview-${terminal.id}`)).toBeInTheDocument();
  expect(screen.queryByTestId(`change-status-${terminal.id}`)).not.toBeInTheDocument();
});

it('opens the history tab directly', async () => {
  const user = userEvent.setup();
  const row = template();
  const { onViewHistory } = renderTable([row]);

  await openMenu(user);
  await user.click(await screen.findByTestId(`history-${row.id}`));

  expect(onViewHistory).toHaveBeenCalledWith(row);
});

it('collapses a long tag list rather than letting a row grow without bound', () => {
  renderTable([
    template({
      tags: ['a', 'b', 'c', 'd', 'e'].map((slug) => ({
        id: slug,
        text: slug.toUpperCase(),
        slug,
        status: 'active' as const,
        tenant: null,
        createdAt: null,
        updatedAt: null,
      })),
    }),
  ]);

  expect(screen.getByText('A')).toBeInTheDocument();
  expect(screen.getByText('+2')).toBeInTheDocument();
  expect(screen.queryByText('E')).not.toBeInTheDocument();
});

it('shows skeleton rows while a page is in flight, not an empty table', () => {
  renderTable([], { isLoading: true, pageSize: 5 });

  expect(screen.queryByText('No templates found.')).not.toBeInTheDocument();
  expect(screen.getAllByRole('row').length).toBeGreaterThan(1);
});

it('pages only in the direction the API says exists', async () => {
  const user = userEvent.setup();
  const { onNextPage, onPreviousPage } = renderTable([template()], {
    page: 2,
    hasNextPage: false,
    hasPreviousPage: true,
  });

  expect(screen.getByTitle('Next page')).toBeDisabled();

  await user.click(screen.getByTitle('Previous page'));
  expect(onPreviousPage).toHaveBeenCalled();
  expect(onNextPage).not.toHaveBeenCalled();
});
