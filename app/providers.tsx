'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import {
  TemplatesProvider,
  createTemplatesClient,
} from 'vintasend-templates-management-dashboard-core';

/**
 * Client-side data layer.
 *
 * `vintasend-templates-management-dashboard-core` ships the API client and the
 * hooks but takes no position on how they are provided, so this is the one
 * place the dashboard decides: one TanStack Query cache, and a templates client
 * pointed at this app's own proxy route.
 *
 * `baseUrl` is the proxy, not the API. The API's bearer key is a server-side
 * secret and `createTemplatesClient` runs in the browser, so the key is added
 * by app/api/templates/[...path]/route.ts instead of being passed here. Anyone
 * copying this file for their own UI should keep that split.
 */
const TEMPLATES_PROXY_URL = '/api/templates';

/** How many times a request that failed in transport is tried again. */
const MAX_TRANSPORT_RETRIES = 2;

/**
 * Retry only what retrying can fix.
 *
 * The API answers with a typed error code, and most of them are verdicts: a
 * 401, a 404, an `INVALID_STATUS_TRANSITION` or a `TEMPLATE_COMPOSITION_ERROR`
 * will say the same thing however many times it is asked. Retrying those just
 * delays the message the user needs to see.
 *
 * This contract has no `UPSTREAM_ERROR` — unlike the notifications one — so the
 * only retryable failure is the one that never reached the API at all and
 * therefore arrives without an envelope. `INTERNAL_ERROR` is deliberately not
 * retried: the proxy returns it for its own misconfiguration, which a second
 * attempt cannot fix.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  const code = (error as { error?: { code?: string } } | null)?.error?.code;

  if (code) {
    return false;
  }

  return failureCount < MAX_TRANSPORT_RETRIES;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Templates change when someone edits them, which on a shared store is
        // someone else. A short staleness window keeps a tab that has been open
        // all afternoon from showing a version that has since been superseded.
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: shouldRetryQuery,
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // Created once per browser session. A module-level client would be shared
  // between requests on the server, leaking one user's cache into another's.
  const [queryClient] = useState(createQueryClient);
  const [templates] = useState(() => createTemplatesClient({ baseUrl: TEMPLATES_PROXY_URL }));

  return (
    <QueryClientProvider client={queryClient}>
      <TemplatesProvider client={templates}>{children}</TemplatesProvider>
    </QueryClientProvider>
  );
}
