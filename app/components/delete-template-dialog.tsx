'use client';

import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  getApiErrorMessage,
  useDeleteTemplate,
  useDeleteTemplateVersion,
  type ManagedTemplate,
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Scope = 'version' | 'template';

export interface DeleteTemplateDialogProps {
  template: ManagedTemplate | null;
  onClose: () => void;
  /** Called after a successful delete, so an open detail panel can close. */
  onDeleted?: (template: ManagedTemplate, scope: Scope) => void;
}

/**
 * Deletes one version, or the whole template.
 *
 * The two are separate endpoints and mean genuinely different things — a
 * version is one row, a key is every row it ever had — so the scope is chosen
 * explicitly rather than inferred, and the destructive default is the narrower
 * one.
 *
 * Archiving is usually what someone wants instead; the status dialog does that,
 * and an archived template stays readable.
 */
export function DeleteTemplateDialog({ template, onClose, onDeleted }: DeleteTemplateDialogProps) {
  const [scope, setScope] = useState<Scope>('version');

  const deleteVersion = useDeleteTemplateVersion();
  const deleteTemplate = useDeleteTemplate();

  const isPending = deleteVersion.isPending || deleteTemplate.isPending;

  // Re-seed as the dialog opens against a new target rather than in an effect:
  // adjusting state during render is React's own answer to "a prop changed", and
  // it avoids the extra committed render an effect would cause. Resetting on
  // *open* rather than on close also keeps the closing animation from flashing
  // the default back at the user.
  const [openedFor, setOpenedFor] = useState<ManagedTemplate | null>(null);

  if (template !== null && template !== openedFor) {
    setOpenedFor(template);
    setScope('version');
  }

  const handleConfirm = async () => {
    if (!template || isPending) return;

    try {
      if (scope === 'version') {
        await deleteVersion.mutateAsync({
          params: { path: { key: template.key, version: template.version } },
        });

        toast.success(`Deleted ${template.key} v${template.version}.`);
      } else {
        await deleteTemplate.mutateAsync({ params: { path: { key: template.key } } });

        toast.success(`Deleted ${template.key} and every version of it.`);
      }

      onDeleted?.(template, scope);
      onClose();
    } catch (error) {
      toast.error(`Could not delete: ${getApiErrorMessage(error)}`);
    }
  };

  return (
    <AlertDialog
      open={template !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Delete template
          </AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. Archiving keeps the template readable and is usually the safer
            move.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-scope">What to delete</Label>
          <Select
            value={scope}
            onValueChange={(value) => setScope(value as Scope)}
            disabled={isPending}
          >
            <SelectTrigger id="delete-scope" data-testid="delete-scope">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="version">
                Only v{template?.version ?? ''} of {template?.key ?? ''}
              </SelectItem>
              <SelectItem value="template">
                Every version of {template?.key ?? ''}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              // The action closes the dialog by default; the mutation decides.
              event.preventDefault();
              void handleConfirm();
            }}
            disabled={isPending}
            data-testid="confirm-delete-template"
          >
            {isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
