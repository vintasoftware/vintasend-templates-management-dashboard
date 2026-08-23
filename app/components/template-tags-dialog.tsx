'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  getApiErrorMessage,
  useSetTemplateTags,
  type ManagedTemplate,
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

import { TagPicker } from './tag-picker';

export interface TemplateTagsDialogProps {
  template: ManagedTemplate | null;
  onClose: () => void;
}

/**
 * Retags one version in place.
 *
 * `PUT /templates/{key}/tags` replaces the set outright rather than merging, so
 * the picker starts from the version's current tags and the whole list is sent
 * back — unticking everything is how a version's tags are cleared.
 *
 * This is the one write that changes a version without creating a new one.
 */
export function TemplateTagsDialog({ template, onClose }: TemplateTagsDialogProps) {
  const [tags, setTags] = useState<string[]>([]);
  const setTemplateTags = useSetTemplateTags();

  // Seeded from the version's current tags as the dialog opens — see the note
  // in delete-template-dialog.tsx on why this is a render-phase adjustment.
  const [openedFor, setOpenedFor] = useState<ManagedTemplate | null>(null);

  if (template !== null && template !== openedFor) {
    setOpenedFor(template);
    setTags(template.tags.map((tag) => tag.slug));
  }

  const handleSave = async () => {
    if (!template) return;

    try {
      await setTemplateTags.mutateAsync({
        params: { path: { key: template.key } },
        body: { tags, version: template.version },
      });

      toast.success(`Tags updated on ${template.key} v${template.version}.`);
      onClose();
    } catch (error) {
      toast.error(`Could not update the tags: ${getApiErrorMessage(error)}`);
    }
  };

  return (
    <Dialog
      open={template !== null}
      onOpenChange={(open) => {
        if (!open && !setTemplateTags.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit tags</DialogTitle>
          <DialogDescription>
            {template ? `Replaces every tag on ${template.key} v${template.version}.` : null}
          </DialogDescription>
        </DialogHeader>

        <TagPicker
          value={tags}
          onChange={setTags}
          disabled={setTemplateTags.isPending}
          allowCreate
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={setTemplateTags.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={setTemplateTags.isPending}
            data-testid="save-tags"
          >
            {setTemplateTags.isPending ? 'Saving…' : 'Save tags'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
