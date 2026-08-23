'use client';

import { AlertCircle, RotateCcw } from 'lucide-react';
import { useEffect } from 'react';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary.
 *
 * This catches what the data hooks do not: a failed query is rendered inline by
 * the page itself, with the API's own message, so anything reaching here is a
 * render fault or a configuration problem rather than a request that came back
 * with an error envelope.
 */
interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TemplatesError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('Templates dashboard error:', error);
  }, [error]);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-destructive mb-2">Something went wrong</h2>
              <p className="text-sm text-muted-foreground mb-4">
                The page could not be rendered. This is usually a temporary problem or a
                misconfigured API URL — check that TEMPLATES_API_URL and TEMPLATES_API_KEY are set.
              </p>

              {process.env.NODE_ENV === 'development' && (
                <details className="mt-4 p-3 bg-muted rounded text-xs">
                  <summary className="cursor-pointer font-mono text-muted-foreground mb-2">
                    Error details
                  </summary>
                  <pre className="font-mono text-destructive overflow-auto max-h-32">
                    {error.message}
                  </pre>
                </details>
              )}

              <div className="flex flex-wrap gap-3 mt-6">
                <Button onClick={() => reset()} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Try again
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    window.location.href = '/';
                  }}
                >
                  Back to templates
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
