'use client';

import { ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import {
  getApiErrorCode,
  getApiErrorMessage,
  useSetTemplateStatus,
  type ManagedTemplate,
  type TemplateStatus,
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

import { TemplateStatusBadge } from './status-badge';

export interface TemplateStatusDialogProps {
  template: ManagedTemplate | null;
  onClose: () => void;
}

/**
 * Moves a template version through its lifecycle.
 *
 * Only the transitions the version itself reports in `allowedTransitions` are
 * offered. Anything else answers `INVALID_STATUS_TRANSITION`, and the point of
 * the field is that a UI never has to provoke it — an empty list means this
 * version is at a terminal status.
 *
 * `useSetTemplateStatus` handles every target. The named shorthands
 * (`useActivateTemplate`, `useDeactivateTemplate`, `useArchiveTemplate`) hit
 * dedicated routes for the same three moves and are worth using when a screen
 * offers exactly one of them — a single "Activate" button, say.
 */
export function TemplateStatusDialog({ template, onClose }: TemplateStatusDialogProps) {
  const [changedBy, setChangedBy] = useState('');
  const setStatus = useSetTemplateStatus();

  // Cleared as the dialog opens on a new version — see the note in
  // delete-template-dialog.tsx on why this is a render-phase adjustment.
  const [openedFor, setOpenedFor] = useState<ManagedTemplate | null>(null);

  if (template !== null && template !== openedFor) {
    setOpenedFor(template);
    setChangedBy('');
  }

  const handleTransition = async (status: TemplateStatus) => {
    if (!template) return;

    try {
      await setStatus.mutateAsync({
        params: { path: { key: template.key } },
        body: {
          status,
          // The version is named explicitly: omitting it means "the latest",
          // and the row the user clicked may not be it when every version is
          // being shown.
          version: template.version,
          changedBy: changedBy.trim() === '' ? null : changedBy.trim(),
        },
      });

      toast.success(`${template.key} v${template.version} is now ${status}.`);
      onClose();
    } catch (error) {
      if (getApiErrorCode(error) === 'INVALID_STATUS_TRANSITION') {
        toast.error(
          `That move is not allowed from ${template.status}. The list of statuses may be out of date — reload and try again.`,
        );

        return;
      }

      toast.error(`Could not change the status: ${getApiErrorMessage(error)}`);
    }
  };

  return (
    <Dialog
      open={template !== null}
      onOpenChange={(open) => {
        if (!open && !setStatus.isPending) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
          <DialogDescription>
            {template
              ? `${template.key} v${template.version} is currently ${template.status}.`
              : null}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="changed-by">Changed by</Label>
            <Input
              id="changed-by"
              value={changedBy}
              placeholder="Optional — recorded in the status history"
              onChange={(event) => setChangedBy(event.target.value)}
              disabled={setStatus.isPending}
              data-testid="status-changed-by"
            />
          </div>

          <div className="space-y-2">
            <Label>Move to</Label>
            {template && template.allowedTransitions.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-testid="no-transitions">
                This version is at a terminal status — there is nowhere for it to go.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {template?.allowedTransitions.map((status) => (
                  <Button
                    key={status}
                    type="button"
                    variant="outline"
                    onClick={() => void handleTransition(status)}
                    disabled={setStatus.isPending}
                    data-testid={`transition-${status}`}
                  >
                    <ArrowRight className="h-4 w-4" />
                    <TemplateStatusBadge status={status} />
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={setStatus.isPending}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
