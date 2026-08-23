'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  getApiErrorMessage,
  useCreateTag,
  useUpdateTag,
  type ManagedTemplateTag,
} from 'vintasend-templates-management-dashboard-core';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface TagFormDialogProps {
  /** `'create'` opens an empty form; a tag opens a rename. `null` closes it. */
  target: 'create' | ManagedTemplateTag | null;
  onClose: () => void;
}

/**
 * Creates or renames a tag.
 *
 * The slug is derived from `text` by the server and is never a client's to set:
 * it is the tag's identity, and a client-supplied one could name a tag no other
 * caller would produce.
 *
 * That is also why renaming carries a warning. Editing `text` **regenerates the
 * slug**, so anything holding the old one — a saved filter, a bookmarked URL,
 * another service's config — stops matching.
 */
export function TagFormDialog({ target, onClose }: TagFormDialogProps) {
  const isCreate = target === 'create';
  const tag = isCreate || target === null ? null : target;

  const [text, setText] = useState('');
  const [tenant, setTenant] = useState('');

  const createTag = useCreateTag();
  const updateTag = useUpdateTag();

  const isPending = createTag.isPending || updateTag.isPending;

  // Seeded as the dialog opens, so a rename never shows the previous tag's name.
  const [openedFor, setOpenedFor] = useState<typeof target>(null);

  if (target !== null && target !== openedFor) {
    setOpenedFor(target);
    setText(target === 'create' ? '' : target.text);
    setTenant('');
  }

  const handleSubmit = async () => {
    const trimmed = text.trim();

    if (trimmed === '' || isPending) return;

    try {
      if (isCreate) {
        const created = await createTag.mutateAsync({
          body: { text: trimmed, tenant: tenant.trim() === '' ? null : tenant.trim() },
        });

        toast.success(`Tag “${created.data.text}” created as ${created.data.slug}.`);
      } else {
        if (!tag) return;

        const updated = await updateTag.mutateAsync({
          params: { path: { slug: tag.slug } },
          body: { text: trimmed },
        });

        toast.success(
          updated.data.slug === tag.slug
            ? `Tag renamed to “${updated.data.text}”.`
            : `Tag renamed — its slug is now ${updated.data.slug}.`,
        );
      }

      onClose();
    } catch (error) {
      toast.error(
        isCreate
          ? `Could not create the tag: ${getApiErrorMessage(error)}`
          : `Could not rename the tag: ${getApiErrorMessage(error)}`,
      );
    }
  };

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isCreate ? 'New tag' : `Rename ${tag?.text}`}</DialogTitle>
          <DialogDescription>
            The slug is generated from the name by the server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-text">Name</Label>
            <Input
              id="tag-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              disabled={isPending}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              data-testid="tag-form-text"
            />
          </div>

          {isCreate && (
            <div className="space-y-2">
              <Label htmlFor="tag-tenant">Tenant</Label>
              <Input
                id="tag-tenant"
                value={tenant}
                placeholder="Optional"
                onChange={(event) => setTenant(event.target.value)}
                disabled={isPending}
                data-testid="tag-form-tenant"
              />
            </div>
          )}

          {!isCreate && (
            <div
              className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
              data-testid="rename-warning"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <p className="text-muted-foreground">
                Renaming regenerates the slug, which is what filters match on. Anything still
                referencing <code className="font-mono text-xs">{tag?.slug}</code> will stop
                matching — the templates carrying the tag are updated, saved links are not.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isPending || text.trim() === ''}
            data-testid="tag-form-submit"
          >
            {isPending ? 'Saving…' : isCreate ? 'Create tag' : 'Rename tag'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
