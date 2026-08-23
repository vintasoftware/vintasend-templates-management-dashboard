'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  getApiErrorMessage,
  useCreateTemplate,
  useCreateTemplateVersion,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

import { TagPicker } from './tag-picker';

/**
 * What the form edits.
 *
 * Both modes fill the same fields; which of them the API accepts differs.
 * `key`, `templateManagedBackend` and `tenant` exist only on creation —
 * `CreateVersionBody` carries none of them, because neither the backend nor the
 * tenant can change across versions of one key.
 */
type FormState = {
  key: string;
  name: string;
  description: string;
  templateManagedBackend: string;
  tenant: string;
  bodyTemplate: string;
  subjectTemplate: string;
  preheaderTemplate: string;
  tags: string[];
};

const EMPTY_FORM: FormState = {
  key: '',
  name: '',
  description: '',
  templateManagedBackend: '',
  tenant: '',
  bodyTemplate: '',
  subjectTemplate: '',
  preheaderTemplate: '',
  tags: [],
};

function formFromTemplate(template: ManagedTemplate): FormState {
  return {
    key: template.key,
    name: template.name,
    description: template.description,
    templateManagedBackend: template.templateManagedBackend,
    tenant: template.tenant ?? '',
    bodyTemplate: template.bodyTemplate,
    subjectTemplate: template.subjectTemplate ?? '',
    preheaderTemplate: template.preheaderTemplate ?? '',
    tags: template.tags.map((tag) => tag.slug),
  };
}

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((slug) => b.includes(slug));
}

export interface TemplateFormDialogProps {
  /**
   * `null` closes the dialog. `'create'` starts a new template; a template
   * starts a new **version** of it, pre-filled with that version's fields.
   */
  target: 'create' | ManagedTemplate | null;
  onClose: () => void;
  /** Called with the key and new version number after a successful write. */
  onSaved?: (key: string, version?: number) => void;
}

/**
 * Creates a template, or a new version of one.
 *
 * These are one dialog because on this API they are one action seen twice:
 * there is no update endpoint. A template is versioned rather than edited, so
 * "edit" means `POST /templates/{key}/versions`, and every field left out of
 * that body is carried forward from the latest version.
 *
 * The form pre-fills from the current version and sends only the fields that
 * actually changed. Sending all of them would work identically — the carried
 * value and the resent one are the same string — but a diff is what the
 * contract is asking for, and it keeps an unrelated concurrent edit from being
 * silently overwritten by a stale field.
 */
export function TemplateFormDialog({ target, onClose, onSaved }: TemplateFormDialogProps) {
  const isCreate = target === 'create';
  const template = isCreate || target === null ? null : target;

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const createTemplate = useCreateTemplate();
  const createVersion = useCreateTemplateVersion();

  const isPending = createTemplate.isPending || createVersion.isPending;

  // Re-seeded whenever the dialog opens against a different target, so a second
  // "new version" does not show the first template's body. Adjusting state
  // during render is React's own answer to "a prop changed" and saves the extra
  // committed render an effect would cost on a form this large.
  const [openedFor, setOpenedFor] = useState<typeof target>(null);

  if (target !== null && target !== openedFor) {
    setOpenedFor(target);
    setForm(target === 'create' ? EMPTY_FORM : formFromTemplate(target));
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const canSubmit = isCreate
    ? form.key.trim() !== '' &&
      form.name.trim() !== '' &&
      form.templateManagedBackend.trim() !== '' &&
      form.bodyTemplate.trim() !== ''
    : template !== null;

  const handleSubmit = async () => {
    if (!canSubmit || isPending) return;

    try {
      if (isCreate) {
        const created = await createTemplate.mutateAsync({
          body: {
            key: form.key.trim(),
            name: form.name.trim(),
            description: form.description,
            templateManagedBackend: form.templateManagedBackend.trim(),
            bodyTemplate: form.bodyTemplate,
            subjectTemplate: form.subjectTemplate.trim() === '' ? null : form.subjectTemplate,
            preheaderTemplate: form.preheaderTemplate.trim() === '' ? null : form.preheaderTemplate,
            tenant: form.tenant.trim() === '' ? null : form.tenant.trim(),
            tags: form.tags,
          },
        });

        toast.success(`Template “${created.data.key}” created at v${created.data.version}.`);
        onSaved?.(created.data.key, created.data.version);
        onClose();

        return;
      }

      if (!template) return;

      const original = formFromTemplate(template);

      // Only what changed. An omitted field is carried forward, so a body with
      // nothing in it is a legitimate way to branch a version off unchanged.
      const body: Record<string, unknown> = {};

      if (form.name !== original.name) body.name = form.name;
      if (form.description !== original.description) body.description = form.description;
      if (form.bodyTemplate !== original.bodyTemplate) body.bodyTemplate = form.bodyTemplate;
      if (form.subjectTemplate !== original.subjectTemplate) {
        body.subjectTemplate = form.subjectTemplate.trim() === '' ? null : form.subjectTemplate;
      }
      if (form.preheaderTemplate !== original.preheaderTemplate) {
        body.preheaderTemplate =
          form.preheaderTemplate.trim() === '' ? null : form.preheaderTemplate;
      }
      if (!sameTags(form.tags, original.tags)) body.tags = form.tags;

      const created = await createVersion.mutateAsync({
        params: { path: { key: template.key } },
        body,
      });

      toast.success(`${template.key} is now at v${created.data.version}.`);
      onSaved?.(template.key, created.data.version);
      onClose();
    } catch (error) {
      toast.error(
        isCreate
          ? `Could not create the template: ${getApiErrorMessage(error)}`
          : `Could not create the version: ${getApiErrorMessage(error)}`,
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isCreate ? 'New template' : `New version of ${template?.key}`}</DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Creates the template’s first version, in draft.'
              : `Starts from v${template?.version}. Fields you leave untouched are carried forward.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isCreate && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="template-key">Key</Label>
                <Input
                  id="template-key"
                  value={form.key}
                  placeholder="welcome-email"
                  onChange={(event) => set('key', event.target.value)}
                  disabled={isPending}
                  data-testid="form-key"
                />
                <p className="text-xs text-muted-foreground">
                  The template’s identity. It cannot be changed later.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-backend">Managed backend</Label>
                <Input
                  id="template-backend"
                  value={form.templateManagedBackend}
                  placeholder="prisma"
                  onChange={(event) => set('templateManagedBackend', event.target.value)}
                  disabled={isPending}
                  data-testid="form-backend"
                />
                <p className="text-xs text-muted-foreground">
                  Fixed for every version of this key.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="template-name">Name</Label>
              <Input
                id="template-name"
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                disabled={isPending}
                data-testid="form-name"
              />
            </div>

            {isCreate && (
              <div className="space-y-2">
                <Label htmlFor="template-tenant">Tenant</Label>
                <Input
                  id="template-tenant"
                  value={form.tenant}
                  placeholder="Optional"
                  onChange={(event) => set('tenant', event.target.value)}
                  disabled={isPending}
                  data-testid="form-tenant"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Input
              id="template-description"
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              disabled={isPending}
              data-testid="form-description"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-subject">Subject template</Label>
            <Textarea
              id="template-subject"
              value={form.subjectTemplate}
              rows={2}
              placeholder="Leave empty for renderers that produce no subject (SMS, push)."
              onChange={(event) => set('subjectTemplate', event.target.value)}
              disabled={isPending}
              className="font-mono text-xs"
              data-testid="form-subject"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-preheader">Preheader template</Label>
            <Textarea
              id="template-preheader"
              value={form.preheaderTemplate}
              rows={2}
              placeholder="Optional"
              onChange={(event) => set('preheaderTemplate', event.target.value)}
              disabled={isPending}
              className="font-mono text-xs"
              data-testid="form-preheader"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-body">Body template</Label>
            <Textarea
              id="template-body"
              value={form.bodyTemplate}
              rows={12}
              onChange={(event) => set('bodyTemplate', event.target.value)}
              disabled={isPending}
              className="font-mono text-xs"
              data-testid="form-body"
            />
            <p className="text-xs text-muted-foreground">
              Engine tags are stored verbatim. Inheritance is resolved before rendering — check the
              Composition tab on the detail panel to see what the engine actually receives.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <TagPicker
              value={form.tags}
              onChange={(next) => set('tags', next)}
              disabled={isPending}
              allowCreate
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || isPending}
            data-testid="form-submit"
          >
            {isPending ? 'Saving…' : isCreate ? 'Create template' : 'Create version'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
