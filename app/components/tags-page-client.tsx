'use client';

import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  getApiErrorMessage,
  useArchiveTag,
  useFilteredTags,
  useRestoreTag,
  type ManagedTemplateTag,
} from 'vintasend-templates-management-dashboard-core';
import { useNextRouterAdapter } from 'vintasend-templates-management-dashboard-core/next';

import { Button } from '@/components/ui/button';

import { DeleteTagDialog } from './delete-tag-dialog';
import { TagFormDialog } from './tag-form-dialog';
import { TagsFilters } from './tags-filters';
import { TagsTable } from './tags-table';

/**
 * The tags page.
 *
 * `useFilteredTags` is the tag counterpart of `useFilteredTemplates` — same URL
 * state, same pagination helpers, no capability gating because this endpoint
 * offers no ordering.
 *
 * Archive and restore are done inline rather than behind a dialog: both are
 * reversible, and the toast says which way it went. Deleting is not, so that
 * one asks.
 */
export function TagsPageClient() {
  const router = useNextRouterAdapter();

  const {
    tags,
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
    clearFilters,
    isFetching,
    isError,
    error,
    refetch,
  } = useFilteredTags({ router });

  const [formTarget, setFormTarget] = useState<'create' | ManagedTemplateTag | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ManagedTemplateTag | null>(null);

  const archiveTag = useArchiveTag();
  const restoreTag = useRestoreTag();

  const handleArchive = useCallback(
    async (tag: ManagedTemplateTag) => {
      try {
        await archiveTag.mutateAsync({ params: { path: { slug: tag.slug } } });

        toast.success(`“${tag.text}” archived. It stays on the templates that carry it.`);
      } catch (mutationError) {
        toast.error(`Could not archive the tag: ${getApiErrorMessage(mutationError)}`);
      }
    },
    [archiveTag],
  );

  const handleRestore = useCallback(
    async (tag: ManagedTemplateTag) => {
      try {
        await restoreTag.mutateAsync({ params: { path: { slug: tag.slug } } });

        toast.success(`“${tag.text}” is back in circulation.`);
      } catch (mutationError) {
        toast.error(`Could not restore the tag: ${getApiErrorMessage(mutationError)}`);
      }
    },
    [restoreTag],
  );

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tags</h1>
            <p className="text-muted-foreground mt-2">
              Labels attached to template versions. The slug is the tag’s identity and what the
              template filters match on.
            </p>
          </div>

          <Button onClick={() => setFormTarget('create')} data-testid="new-tag">
            <Plus className="h-4 w-4" />
            New tag
          </Button>
        </div>

        <TagsFilters
          filters={filters}
          hasActiveFilters={hasActiveFilters}
          isLoading={isFetching}
          patchFilters={patchFilters}
          toggleStatus={toggleStatus}
          clearFilters={clearFilters}
        />

        {isError ? (
          <div
            className="rounded-lg border border-destructive/50 bg-destructive/10 p-6"
            data-testid="tags-error"
          >
            <h2 className="font-semibold text-destructive mb-2">Failed to load tags</h2>
            <p className="text-sm text-muted-foreground mb-4">{getApiErrorMessage(error)}</p>
            <button type="button" onClick={refetch} className="text-sm underline underline-offset-4">
              Try again
            </button>
          </div>
        ) : (
          <TagsTable
            data={tags}
            page={page}
            pageSize={pageSize}
            hasNextPage={hasNextPage}
            hasPreviousPage={hasPreviousPage}
            isLoading={isFetching}
            onNextPage={nextPage}
            onPreviousPage={previousPage}
            onRename={setFormTarget}
            onArchive={(tag) => void handleArchive(tag)}
            onRestore={(tag) => void handleRestore(tag)}
            onDelete={setDeleteTarget}
          />
        )}

        <TagFormDialog target={formTarget} onClose={() => setFormTarget(null)} />

        <DeleteTagDialog tag={deleteTarget} onClose={() => setDeleteTarget(null)} />
      </div>
    </main>
  );
}
