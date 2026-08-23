'use client';

import { Copy, Play } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  getApiErrorCode,
  getApiErrorMessage,
  usePreviewTemplate,
  type ManagedTemplate,
  type TemplatePreview,
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
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { copyToClipboard } from '@/lib/format';

const DEFAULT_CONTEXT = '{\n  \n}';

function RenderedBlock({
  title,
  value,
  testId,
}: {
  title: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{title}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={() => void copyToClipboard(value)}
        >
          <Copy className="h-3 w-3 mr-1" />
          Copy
        </Button>
      </div>
      <Tabs defaultValue="rendered">
        <TabsList>
          <TabsTrigger value="rendered">Rendered</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
        </TabsList>
        <TabsContent value="rendered">
          {/* The API returns whatever the renderer produced. It is trusted the
              same way the template author is trusted — anyone who can write a
              template can already put markup in front of a recipient — but this
              is the line to replace with an iframe sandbox if template authors
              and dashboard users are not the same people. */}
          <div
            data-testid={testId}
            className="bg-background border rounded-md p-3 text-sm overflow-x-auto max-h-72"
            dangerouslySetInnerHTML={{ __html: value }}
          />
        </TabsContent>
        <TabsContent value="source">
          <pre
            data-testid={`${testId}-source`}
            className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto max-h-72 whitespace-pre-wrap break-all"
          >
            {value}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export interface TemplatePreviewDialogProps {
  template: ManagedTemplate | null;
  onClose: () => void;
}

/**
 * Renders a template version against a context typed here.
 *
 * The context is rendered verbatim: this API has no notification to resolve a
 * registered context generator from, so what is typed below is exactly what the
 * engine receives. Nothing is generated and nothing is stored — the endpoint is
 * a POST but changes no state, which is why `usePreviewTemplate` invalidates
 * nothing.
 */
export function TemplatePreviewDialog({ template, onClose }: TemplatePreviewDialogProps) {
  const [contextText, setContextText] = useState(DEFAULT_CONTEXT);
  const [parseError, setParseError] = useState<string | null>(null);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);

  const previewMutation = usePreviewTemplate();
  const { mutateAsync } = previewMutation;

  const [renderError, setRenderError] = useState<unknown>(null);

  // Clear the previous template's result as the dialog opens on a new one.
  // Render-phase rather than in an effect, so the pane never shows one
  // template's output under another's title for a frame.
  const [openedFor, setOpenedFor] = useState<ManagedTemplate | null>(null);

  if (template !== openedFor) {
    setOpenedFor(template);
    setContextText(DEFAULT_CONTEXT);
    setParseError(null);
    setPreview(null);
    setRenderError(null);
  }

  /**
   * Sends one preview request. Nothing here touches state until the request has
   * come back, which is what keeps it safe to call straight from an effect.
   */
  const runPreview = useCallback(
    async (key: string, version: number, context: Record<string, unknown>) => {
      try {
        const result = await mutateAsync({
          params: { path: { key } },
          // The version is named explicitly: omitting it means "the latest", and
          // the row the user clicked may not be it.
          body: { context, version },
        });

        setPreview(result.data);
        setRenderError(null);
      } catch (error) {
        setPreview(null);
        setRenderError(error);
      }
    },
    [mutateAsync],
  );

  /** Parses what is in the context box, then renders it. */
  const renderTyped = useCallback(
    (key: string, version: number, rawContext: string) => {
      let context: Record<string, unknown>;

      try {
        const parsed: unknown = JSON.parse(rawContext.trim() === '' ? '{}' : rawContext);

        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          setParseError('The context must be a JSON object.');
          return;
        }

        context = parsed as Record<string, unknown>;
      } catch {
        setParseError('That is not valid JSON.');
        return;
      }

      setParseError(null);
      void runPreview(key, version, context);
    },
    [runPreview],
  );

  // Open with an empty-context render, so the dialog shows something to react to
  // rather than an empty pane the user has to prompt. This one *is* an effect:
  // it fires a request, which is exactly the external-system synchronisation an
  // effect is for.
  useEffect(() => {
    if (!template) return;

    // `runPreview` only writes state once its request has resolved, so this is
    // not the cascading render the rule is looking for — but the rule follows
    // the call rather than the await, so it has to be told.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runPreview(template.key, template.version, {});
  }, [template, runPreview]);

  const isPending = previewMutation.isPending;

  const renderResult = () => {
    if (isPending) {
      return (
        <p className="text-sm text-muted-foreground py-6" data-testid="preview-loading">
          Rendering…
        </p>
      );
    }

    if (renderError) {
      // A renderer that cannot preview at all is an expected state for some
      // backends rather than a failure, so it reads as an explanation.
      const isUnavailable = getApiErrorCode(renderError) === 'PREVIEW_UNAVAILABLE';
      const isComposition = getApiErrorCode(renderError) === 'TEMPLATE_COMPOSITION_ERROR';

      return (
        <div className="py-2 space-y-1" data-testid="preview-error">
          <p className={isUnavailable ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'}>
            {getApiErrorMessage(renderError)}
          </p>
          {isComposition && (
            <p className="text-xs text-muted-foreground">
              The template extends or includes something that could not be resolved. The Composition
              tab on the detail panel shows which references it declares.
            </p>
          )}
        </div>
      );
    }

    if (!preview) {
      return null;
    }

    return (
      <div className="space-y-4" data-testid="preview-success">
        {/* Subject and preheader are null for renderers that do not produce
            them — an SMS renderer produces a body only. */}
        {preview.renderedSubject !== null && (
          <RenderedBlock
            title="Rendered subject"
            value={preview.renderedSubject}
            testId="preview-subject"
          />
        )}

        {preview.renderedPreheader !== null && (
          <RenderedBlock
            title="Rendered preheader"
            value={preview.renderedPreheader}
            testId="preview-preheader"
          />
        )}

        <RenderedBlock title="Rendered body" value={preview.renderedBody} testId="preview-body" />
      </div>
    );
  };

  return (
    <Dialog
      open={template !== null}
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
    >
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Preview {template?.key} v{template?.version}
          </DialogTitle>
          <DialogDescription>
            The context below is rendered verbatim — nothing is generated, and nothing is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="preview-context">Context (JSON)</Label>
          <Textarea
            id="preview-context"
            value={contextText}
            rows={6}
            onChange={(event) => setContextText(event.target.value)}
            className="font-mono text-xs"
            data-testid="preview-context"
          />
          {parseError && (
            <p className="text-xs text-destructive" data-testid="preview-parse-error">
              {parseError}
            </p>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() => {
              if (template) renderTyped(template.key, template.version, contextText);
            }}
            disabled={isPending || !template}
            data-testid="preview-render"
          >
            <Play className="h-4 w-4" />
            {isPending ? 'Rendering…' : 'Render'}
          </Button>
        </div>

        <Separator />

        {renderResult()}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
