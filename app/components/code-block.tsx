'use client';

import { Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { copyToClipboard, EMPTY } from '@/lib/format';

export interface CodeBlockProps {
  title: string;
  /** `null` renders the empty placeholder rather than the string "null". */
  content: string | null | undefined;
  testId?: string;
  /** Explains a null value, for the fields a renderer may simply not produce. */
  emptyHint?: string;
}

/** A read-only source pane with a copy button. */
export function CodeBlock({ title, content, testId, emptyHint }: CodeBlockProps) {
  const isEmpty = content === null || content === undefined || content === '';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {!isEmpty && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2"
            onClick={() => void copyToClipboard(content)}
          >
            <Copy className="h-3 w-3 mr-1" />
            Copy
          </Button>
        )}
      </div>
      <pre
        data-testid={testId}
        className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto max-h-64 whitespace-pre-wrap break-all"
      >
        {isEmpty ? (emptyHint ?? EMPTY) : content}
      </pre>
    </div>
  );
}
