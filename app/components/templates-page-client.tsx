'use client';

import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import {
  getApiErrorMessage,
  useFilteredTemplates,
  type ManagedTemplate,
  type TemplateOrderByField,
} from 'vintasend-templates-management-dashboard-core';
import { useNextRouterAdapter } from 'vintasend-templates-management-dashboard-core/next';

import { Button } from '@/components/ui/button';

import { DeleteTemplateDialog } from './delete-template-dialog';
import { TemplateDetail, type DetailTab, type TemplateSelection } from './template-detail';
import { TemplateFormDialog } from './template-form-dialog';
import { TemplatePreviewDialog } from './template-preview-dialog';
import { TemplateStatusDialog } from './template-status-dialog';
import { TemplateTagsDialog } from './template-tags-dialog';
import { TemplatesFilters } from './templates-filters';
import { TemplatesTable } from './templates-table';

/**
 * The templates page.
 *
 * Everything data-shaped comes from
 * `vintasend-templates-management-dashboard-core`: `useFilteredTemplates` reads
 * the filters out of the URL, runs the list query, resolves which fields the
 * backend can sort by, and hands back pagination helpers. The mutations live in
 * the dialogs, each of which invalidates the caches its write affects.
 *
 * What is left here is this app's own UI — which dialog is open, and which
 * version the detail panel is showing. A dashboard with a different design
 * system replaces these files and keeps the hooks.
 */
export function TemplatesPageClient() {
  // Filters live in the query string, so the Next router — not the History API
  // — has to do the navigating, or the route never re-renders.
  const router = useNextRouterAdapter();

  const {
    templates,
    filters,
    page,
    pageSize,
    hasActiveFilters,
    hasNextPage,
    hasPreviousPage,
    nextPage,
    previousPage,
    patchFilters,
    toggleStatus,
    toggleTag,
    clearFilters,
    setSort,
    sortableFields,
    isFetching,
    isError,
    error,
    refetch,
  } = useFilteredTemplates({ router });

  const [selection, setSelection] = useState<TemplateSelection>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('details');
  const [formTarget, setFormTarget] = useState<'create' | ManagedTemplate | null>(null);
  const [previewTarget, setPreviewTarget] = useState<ManagedTemplate | null>(null);
  const [statusTarget, setStatusTarget] = useState<ManagedTemplate | null>(null);
  const [tagsTarget, setTagsTarget] = useState<ManagedTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedTemplate | null>(null);

  const openDetail = useCallback((template: ManagedTemplate, tab: DetailTab = 'details') => {
    setDetailTab(tab);
    setSelection({ key: template.key, version: template.version });
  }, []);

  /**
   * Clicking a sortable header cycles asc → desc → unsorted for that field, and
   * starts a different field at asc. `setSort()` with no field clears both the
   * field and the direction, which is what the contract wants: a direction with
   * nothing to order is a 400.
   */
  const handleSort = useCallback(
    (field: TemplateOrderByField) => {
      if (filters.orderByField !== field) {
        setSort(field, 'asc');
        return;
      }

      if (filters.orderByDirection === 'asc') {
        setSort(field, 'desc');
        return;
      }

      setSort();
    },
    [filters.orderByField, filters.orderByDirection, setSort],
  );

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Templates</h1>
            <p className="text-muted-foreground mt-2">
              Every row is one version. Templates are versioned rather than edited, so an edit is a
              new version with the untouched fields carried forward.
            </p>
          </div>

          <Button onClick={() => setFormTarget('create')} data-testid="new-template">
            <Plus className="h-4 w-4" />
            New template
          </Button>
        </div>

        <TemplatesFilters
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          isLoading={isFetching}
          patchFilters={patchFilters}
          toggleStatus={toggleStatus}
          toggleTag={toggleTag}
          clearFilters={clearFilters}
        />

        {isError ? (
          <div
            className="rounded-lg border border-destructive/50 bg-destructive/10 p-6"
            data-testid="templates-error"
          >
            <h2 className="font-semibold text-destructive mb-2">Failed to load templates</h2>
            <p className="text-sm text-muted-foreground mb-4">{getApiErrorMessage(error)}</p>
            <button type="button" onClick={refetch} className="text-sm underline underline-offset-4">
              Try again
            </button>
          </div>
        ) : (
          <TemplatesTable
            data={templates}
            page={page}
            pageSize={pageSize}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            isLoading={isFetching}
            onNextPage={nextPage}
            onPreviousPage={previousPage}
            onRowClick={(template) => openDetail(template)}
            sortableFields={sortableFields}
            currentSort={{ field: filters.orderByField, direction: filters.orderByDirection }}
            onSort={handleSort}
            onViewDetails={(template) => openDetail(template)}
            onViewHistory={(template) => openDetail(template, 'history')}
            onCreateVersion={setFormTarget}
            onPreview={setPreviewTarget}
            onEditTags={setTagsTarget}
            onChangeStatus={setStatusTarget}
            onDelete={setDeleteTarget}
          />
        )}

        <TemplateDetail
          selection={selection}
          defaultTab={detailTab}
          onClose={() => setSelection(null)}
          onSelectVersion={setSelection}
        />

        <TemplateFormDialog
          target={formTarget}
          onClose={() => setFormTarget(null)}
          onSaved={(key, version) => {
            if (version !== undefined) {
              setDetailTab('details');
              setSelection({ key, version });
            }
          }}
        />

        <TemplatePreviewDialog template={previewTarget} onClose={() => setPreviewTarget(null)} />

        <TemplateStatusDialog template={statusTarget} onClose={() => setStatusTarget(null)} />

        <TemplateTagsDialog template={tagsTarget} onClose={() => setTagsTarget(null)} />

        <DeleteTemplateDialog
          template={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={(template, scope) => {
            // A panel showing what was just deleted has nothing left to read.
            if (
              selection?.key === template.key &&
              (scope === 'template' || selection.version === template.version)
            ) {
              setSelection(null);
            }
          }}
        />
      </div>
    </main>
  );
}
