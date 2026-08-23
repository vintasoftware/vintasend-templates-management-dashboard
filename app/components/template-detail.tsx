'use client';

import { ArrowUpRight, Copy } from 'lucide-react';
import {
  getApiErrorCode,
  getApiErrorMessage,
  useTemplate,
  useTemplateComposition,
  useTemplateStatusHistory,
  useTemplateVersions,
} from 'vintasend-templates-management-dashboard-core';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { copyToClipboard, EMPTY, formatDate } from '@/lib/format';

import { CodeBlock } from './code-block';
import { TemplateStatusBadge } from './status-badge';

/** Which template version the panel is showing. `null` keeps it closed. */
export type TemplateSelection = { key: string; version: number } | null;

export interface TemplateDetailProps {
  selection: TemplateSelection;
  onClose: () => void;
  /** Switches the panel to another version of the same key. */
  onSelectVersion: (selection: NonNullable<TemplateSelection>) => void;
  /** Opens the initial tab — used by the "Status history" row action. */
  defaultTab?: DetailTab;
}

export type DetailTab = 'details' | 'source' | 'composition' | 'versions' | 'history';

function Field({
  label,
  value,
  monospace = false,
}: {
  label: string;
  value: React.ReactNode;
  monospace?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className={`text-sm break-all ${monospace ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  );
}

/**
 * Everything about one template version.
 *
 * Five reads back this panel, and they are separate endpoints on purpose: the
 * stored sources, what those compose into, every version of the key, and the
 * status trail. All of them stay idle while the panel is closed, because each
 * hook holds until its key is non-null.
 */
export function TemplateDetail({
  selection,
  onClose,
  onSelectVersion,
  defaultTab = 'details',
}: TemplateDetailProps) {
  const key = selection?.key ?? null;
  const version = selection?.version ?? null;

  const templateQuery = useTemplate(key, version);
  const versionsQuery = useTemplateVersions(key);
  const compositionQuery = useTemplateComposition(key, version);

  // The one endpoint where omitting `version` means *every* version rather than
  // the latest, so the panel shows the whole key's trail — which is what makes
  // it readable: an entry per version, in the order the key moved through them.
  const historyQuery = useTemplateStatusHistory(key, null);

  const template = templateQuery.data?.data ?? null;
  const versions = versionsQuery.data?.data ?? [];
  const composition = compositionQuery.data?.data ?? null;
  const history = historyQuery.data?.data ?? [];

  const renderDetails = () => {
    if (templateQuery.isLoading) {
      return (
        <div className="space-y-4" data-testid="template-detail-loading">
          <Skeleton className="h-6 w-3/4" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        </div>
      );
    }

    if (templateQuery.isError) {
      return (
        <div className="text-center py-6" data-testid="template-detail-error">
          <p className="text-destructive mb-4">{getApiErrorMessage(templateQuery.error)}</p>
          <Button variant="outline" onClick={() => void templateQuery.refetch()}>
            Retry
          </Button>
        </div>
      );
    }

    if (!template) return null;

    return (
      <div className="space-y-4" data-testid="template-detail-content">
        <div className="flex flex-wrap items-center gap-2">
          <TemplateStatusBadge status={template.status} />
          <Badge variant="outline">v{template.version}</Badge>
          {template.isAbstract && <Badge variant="secondary">abstract</Badge>}
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Key"
            monospace
            value={
              <span className="flex items-center gap-1">
                {template.key}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => void copyToClipboard(template.key)}
                  aria-label="Copy key"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </span>
            }
          />
          <Field label="Id" value={template.id} monospace />
          <Field label="Name" value={template.name || EMPTY} />
          <Field label="Backend" value={template.templateManagedBackend || EMPTY} />
          <Field label="Tenant" value={template.tenant || EMPTY} />
          <Field label="Description" value={template.description || EMPTY} />
          <Field label="Created" value={formatDate(template.createdAt)} />
          <Field label="Updated" value={formatDate(template.updatedAt)} />
        </div>

        <Separator />

        <Field
          label="Tags"
          value={
            template.tags.length === 0 ? (
              EMPTY
            ) : (
              <span className="flex flex-wrap gap-1">
                {template.tags.map((tag) => (
                  <Badge key={tag.slug} variant={tag.status === 'archived' ? 'outline' : 'secondary'}>
                    {tag.text}
                    {tag.status === 'archived' && ' (archived)'}
                  </Badge>
                ))}
              </span>
            )
          }
        />

        {/* The lifecycle's legal next steps, straight from the API. A UI that
            offers anything else gets INVALID_STATUS_TRANSITION. */}
        <Field
          label="Allowed transitions"
          value={
            template.allowedTransitions.length === 0 ? (
              <span className="text-muted-foreground">Terminal — nowhere to go from here.</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {template.allowedTransitions.map((status) => (
                  <Badge key={status} variant="outline">
                    {status}
                  </Badge>
                ))}
              </span>
            )
          }
        />
      </div>
    );
  };

  const renderSource = () => {
    if (!template) return null;

    return (
      <div className="space-y-4" data-testid="template-source">
        <p className="text-xs text-muted-foreground">
          What someone typed, stored verbatim. Inheritance is not resolved here — see Composition.
        </p>
        <CodeBlock
          title="Subject template"
          content={template.subjectTemplate}
          testId="source-subject"
          emptyHint="This renderer produces no subject."
        />
        <CodeBlock
          title="Preheader template"
          content={template.preheaderTemplate}
          testId="source-preheader"
          emptyHint="This renderer produces no preheader."
        />
        <CodeBlock title="Body template" content={template.bodyTemplate} testId="source-body" />
      </div>
    );
  };

  const renderComposition = () => {
    if (compositionQuery.isLoading) {
      return <Skeleton className="h-40 w-full" />;
    }

    if (compositionQuery.isError) {
      const isCompositionError =
        getApiErrorCode(compositionQuery.error) === 'TEMPLATE_COMPOSITION_ERROR';

      return (
        <div className="space-y-2" data-testid="composition-error">
          <p className="text-sm text-destructive">{getApiErrorMessage(compositionQuery.error)}</p>
          {isCompositionError && (
            <p className="text-xs text-muted-foreground">
              This version extends or includes a template that could not be resolved — usually a key
              that no longer exists, or a version that was deleted. Until it resolves, the template
              cannot be rendered.
            </p>
          )}
        </div>
      );
    }

    if (!composition) return null;

    return (
      <div className="space-y-4" data-testid="template-composition">
        <p className="text-xs text-muted-foreground">
          The version as the engine receives it: one flat string per field, with every inheritance
          tag already resolved. Context is <em>not</em> applied — <code>{'{{ name }}'}</code> and
          friends survive untouched.
        </p>

        <div>
          <span className="text-sm font-medium text-muted-foreground">Direct references</span>
          {composition.references.length === 0 ? (
            <p className="text-sm mt-1">This template stands alone.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {composition.references.map((reference, index) => (
                <li
                  key={`${reference.kind}-${reference.key}-${reference.field}-${index}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <Badge variant="outline">{reference.kind}</Badge>
                  <span className="font-mono text-xs">{reference.key}</span>
                  <span className="text-muted-foreground text-xs">
                    {/* A reference with no version resolves to whatever that key
                        currently is, at render time. */}
                    {reference.version === null ? 'latest' : `v${reference.version}`} ·{' '}
                    {reference.field}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Open ${reference.key}`}
                    onClick={() =>
                      onSelectVersion({
                        key: reference.key,
                        version: reference.version ?? composition.version,
                      })
                    }
                  >
                    <ArrowUpRight className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <CodeBlock
          title="Composed subject"
          content={composition.composedSubjectTemplate}
          testId="composed-subject"
        />
        <CodeBlock
          title="Composed preheader"
          content={composition.composedPreheaderTemplate}
          testId="composed-preheader"
        />
        <CodeBlock
          title="Composed body"
          content={composition.composedBodyTemplate}
          testId="composed-body"
        />
      </div>
    );
  };

  const renderVersions = () => {
    if (versionsQuery.isLoading) {
      return <Skeleton className="h-32 w-full" />;
    }

    if (versionsQuery.isError) {
      return <p className="text-sm text-destructive">{getApiErrorMessage(versionsQuery.error)}</p>;
    }

    return (
      <ul className="space-y-1" data-testid="template-versions">
        {versions.map((entry) => {
          const isCurrent = entry.version === version;

          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSelectVersion({ key: entry.key, version: entry.version })}
                className={`w-full flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent ${
                  isCurrent ? 'border-primary bg-accent/50' : ''
                }`}
                data-testid={`version-${entry.version}`}
              >
                <span className="font-mono text-xs">v{entry.version}</span>
                <TemplateStatusBadge status={entry.status} />
                <span className="truncate flex-1">{entry.name}</span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(entry.updatedAt)}
                </span>
              </button>
            </li>
          );
        })}
        {versions.length === 0 && <p className="text-sm text-muted-foreground">No versions.</p>}
      </ul>
    );
  };

  const renderHistory = () => {
    if (historyQuery.isLoading) {
      return <Skeleton className="h-32 w-full" />;
    }

    if (historyQuery.isError) {
      return <p className="text-sm text-destructive">{getApiErrorMessage(historyQuery.error)}</p>;
    }

    if (history.length === 0) {
      return (
        <p className="text-sm text-muted-foreground" data-testid="template-history-empty">
          No status changes recorded. Not every backend keeps an audit trail.
        </p>
      );
    }

    return (
      <ol className="space-y-2" data-testid="template-history">
        {history.map((entry, index) => (
          <li
            key={`${entry.version}-${entry.status}-${entry.createdAt}-${index}`}
            className="flex items-center gap-2 text-sm border rounded-md px-3 py-2"
          >
            <span className="font-mono text-xs">v{entry.version}</span>
            <TemplateStatusBadge status={entry.status} />
            <span className="text-xs text-muted-foreground">{entry.changedBy || 'unknown'}</span>
            <span className="ml-auto text-xs text-muted-foreground whitespace-nowrap">
              {formatDate(entry.createdAt)}
            </span>
          </li>
        ))}
      </ol>
    );
  };

  return (
    <Sheet open={selection !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="break-all">{template?.name || selection?.key}</SheetTitle>
          <SheetDescription>
            {selection ? `${selection.key} · v${selection.version}` : 'Loading…'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <Tabs defaultValue={defaultTab} key={defaultTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="source">Source</TabsTrigger>
              <TabsTrigger value="composition">Composition</TabsTrigger>
              <TabsTrigger value="versions">Versions</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="details">{renderDetails()}</TabsContent>
            <TabsContent value="source">{renderSource()}</TabsContent>
            <TabsContent value="composition">{renderComposition()}</TabsContent>
            <TabsContent value="versions">{renderVersions()}</TabsContent>
            <TabsContent value="history">{renderHistory()}</TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}
