'use client';

import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getApiErrorMessage,
  useDeleteTag,
  type ManagedTemplateTag,
} from 'vintasend-templates-management-dashboard-core';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface DeleteTagDialogProps {
  tag: ManagedTemplateTag | null;
  onClose: () => void;
}

/**
 * Deletes a tag outright.
 *
 * Archiving is almost always what someone wants instead: an archived tag stays
 * attached to the templates carrying it and stays filterable, it is simply no
 * longer offered in a picker. Deleting removes it from circulation entirely.
 */
export function DeleteTagDialog({ tag, onClose }: DeleteTagDialogProps) {
  const deleteTag = useDeleteTag();

  const handleConfirm = async () => {
    if (!tag || deleteTag.isPending) return;

    try {
      await deleteTag.mutateAsync({ params: { path: { slug: tag.slug } } });

      toast.success(`Deleted the tag “${tag.text}”.`);
      onClose();
    } catch (error) {
      toast.error(`Could not delete the tag: ${getApiErrorMessage(error)}`);
    }
  };

  return (
    <AlertDialog
      open={tag !== null}
      onOpenChange={(open) => {
        if (!open && !deleteTag.isPending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Delete “{tag?.text}”
          </AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. Archiving keeps the tag attached to its templates and still
            filterable — it just stops being offered.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteTag.isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            disabled={deleteTag.isPending}
            data-testid="confirm-delete-tag"
          >
            {deleteTag.isPending ? 'Deleting…' : 'Delete tag'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
