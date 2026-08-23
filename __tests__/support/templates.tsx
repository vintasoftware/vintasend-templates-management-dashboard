/**
 * Test harness for the `vintasend-templates-management-dashboard-core` data
 * layer.
 *
 * Component tests that only care about rendering can mock the core's hooks.
 * This helper is for the ones that should exercise the real thing — the URL
 * filters, the query cache, the generated client — by swapping only the
 * transport underneath it. What they assert on is therefore the same code path
 * the browser runs, minus the network.
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import { useState, type ReactElement, type ReactNode } from 'react';
import {
  TemplatesProvider,
  createTemplatesClient,
  type ManagedTemplate,
  type ManagedTemplateTag,
} from 'vintasend-templates-management-dashboard-core';

export type StubbedResponse = {
  status?: number;
  body: unknown;
};

export type FetchStub = jest.Mock<Promise<Response>, [Request]>;

/**
 * Builds a `fetch` that answers from a path -> response map. Keys are matched
 * as a substring of the request URL, so a test can key on '/api/v1/templates'
 * without spelling out the query string.
 *
 * A route may also be a function, for the tests that need a different answer
 * per call — a mutation followed by the refetch it invalidated, say.
 */
export function createFetchStub(
  routes: Record<string, StubbedResponse | ((request: Request) => StubbedResponse)>,
): FetchStub {
  return jest.fn(async (request: Request) => {
    const url = typeof request === 'string' ? request : request.url;
    const match = Object.keys(routes)
      // Longest key first, so '/templates/{key}/versions' wins over
      // '/templates'.
      .sort((a, b) => b.length - a.length)
      .find((path) => url.includes(path));

    if (!match) {
      return new Response(
        JSON.stringify({ error: { code: 'NOT_FOUND', message: `No stub for ${url}` } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const route = routes[match];
    const { status = 200, body } = typeof route === 'function' ? route(request) : route;

    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as FetchStub;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // Retries turn an expected failure into a multi-second test.
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

/**
 * The app configures the client with the relative '/api/templates', which a
 * browser resolves against the page. Node's fetch has no page to resolve
 * against and rejects a relative URL outright, so tests spell out the origin
 * jsdom is already serving from.
 */
const TEST_BASE_URL = 'http://localhost/api/templates';

export function TemplatesTestProvider({
  children,
  fetch,
  queryClient,
}: {
  children: ReactNode;
  fetch: typeof globalThis.fetch;
  queryClient?: QueryClient;
}) {
  // Both are built once per mount, exactly as the app builds them. Rebuilding
  // the query client on every render would throw the cache away mid-test, which
  // is not something the app ever does.
  const [cache] = useState(() => queryClient ?? createTestQueryClient());
  const [client] = useState(() => createTemplatesClient({ baseUrl: TEST_BASE_URL, fetch }));

  return (
    <QueryClientProvider client={cache}>
      <TemplatesProvider client={client}>{children}</TemplatesProvider>
    </QueryClientProvider>
  );
}

export function renderWithTemplates(
  ui: ReactElement,
  {
    fetch,
    queryClient,
    ...options
  }: Omit<RenderOptions, 'wrapper'> & {
    fetch: typeof globalThis.fetch;
    queryClient?: QueryClient;
  },
) {
  return render(ui, {
    wrapper: ({ children }) => (
      <TemplatesTestProvider fetch={fetch} queryClient={queryClient}>
        {children}
      </TemplatesTestProvider>
    ),
    ...options,
  });
}

/** A page in the contract's pagination envelope. */
export function paginated(data: unknown[], overrides: Record<string, unknown> = {}) {
  return { data, page: 1, pageSize: 20, hasMore: false, ...overrides };
}

/** The single-item envelope. */
export function dataResponse(data: unknown) {
  return { data };
}

export function template(overrides: Partial<ManagedTemplate> = {}): ManagedTemplate {
  return {
    id: 'tpl-1',
    key: 'welcome-email',
    version: 3,
    name: 'Welcome email',
    description: 'Sent on signup',
    templateManagedBackend: 'prisma',
    bodyTemplate: '<p>Hello {{ name }}</p>',
    subjectTemplate: 'Welcome, {{ name }}',
    preheaderTemplate: null,
    status: 'active',
    tenant: null,
    createdAt: '2024-01-01T09:00:00Z',
    updatedAt: '2024-02-01T09:00:00Z',
    tags: [],
    allowedTransitions: ['inactive', 'archived'],
    isAbstract: false,
    ...overrides,
  };
}

export function tag(overrides: Partial<ManagedTemplateTag> = {}): ManagedTemplateTag {
  return {
    id: 'tag-1',
    text: 'Marketing',
    slug: 'marketing',
    status: 'active',
    tenant: null,
    createdAt: '2024-01-01T09:00:00Z',
    updatedAt: '2024-01-01T09:00:00Z',
    ...overrides,
  };
}

/**
 * Capabilities with every template field sortable.
 *
 * `orderBy.*` defaults to **not** supported, so a test that expects sortable
 * columns has to say so — which is the same thing a real backend has to do.
 */
export const ALL_SORTABLE = {
  'orderBy.key': true,
  'orderBy.name': true,
  'orderBy.version': true,
  'orderBy.status': true,
  'orderBy.createdAt': true,
  'orderBy.updatedAt': true,
};

/** The query string of the most recent request matching `path`. */
export function lastQueryFor(fetch: FetchStub, path: string): URLSearchParams {
  const url = fetch.mock.calls
    .map(([request]) => (typeof request === 'string' ? request : request.url))
    .reverse()
    .find((candidate) => candidate.includes(path));

  return new URL(url as string, 'http://localhost').searchParams;
}

/** Every request the stub saw, as `METHOD path?query`. */
export function requestLog(fetch: FetchStub): string[] {
  return fetch.mock.calls.map(([request]) => {
    const url = new URL(typeof request === 'string' ? request : request.url);

    return `${typeof request === 'string' ? 'GET' : request.method} ${url.pathname}${url.search}`;
  });
}

/** The parsed JSON body of the first request matching method and path. */
export async function bodyOf(
  fetch: FetchStub,
  method: string,
  path: string,
): Promise<Record<string, unknown>> {
  const call = fetch.mock.calls.find(([request]) => {
    if (typeof request === 'string') return false;

    return request.method === method && new URL(request.url).pathname.includes(path);
  });

  if (!call) throw new Error(`No ${method} request to ${path}. Saw: ${requestLog(fetch).join(', ')}`);

  return (await (call[0] as Request).clone().json()) as Record<string, unknown>;
}
