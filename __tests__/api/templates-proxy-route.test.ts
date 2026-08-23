/**
 * @jest-environment node
 */

/**
 * Tests for the templates proxy route.
 *
 * This route is what keeps `TEMPLATES_API_KEY` out of the browser, so the two
 * things worth pinning down are that it never forwards a request it has not
 * authenticated, and that it never answers one without attaching the key. The
 * rest is relaying: path, query, body, status and the error envelope have to
 * survive the hop, or the core's error helpers stop working in the browser.
 */

const isAuthenticated = jest.fn();
const resolveAuthStrategy: jest.Mock = jest.fn(() => ({ isAuthenticated }));
const assertValidAuthConfig: jest.Mock = jest.fn();

jest.mock('@/lib/auth', () => ({
  resolveAuthStrategy: (...args: unknown[]) => resolveAuthStrategy(...(args as [])),
}));

jest.mock('@/lib/auth/validate-config', () => ({
  assertValidAuthConfig: (...args: unknown[]) => assertValidAuthConfig(...(args as [])),
}));

import { NextRequest } from 'next/server';
import { DELETE, GET, PATCH, POST, PUT } from '@/app/api/templates/[...path]/route';

const fetchMock = jest.fn();

const context = (path: string[]) => ({ params: Promise.resolve({ path }) });

const request = (url: string, init?: RequestInit) =>
  new NextRequest(`https://dashboard.test${url}`, init as never);

const upstream = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const savedEnv = {
  url: process.env.TEMPLATES_API_URL,
  key: process.env.TEMPLATES_API_KEY,
};

beforeEach(() => {
  jest.clearAllMocks();
  isAuthenticated.mockResolvedValue(true);
  resolveAuthStrategy.mockReturnValue({ isAuthenticated });
  fetchMock.mockResolvedValue(upstream({ data: [] }));
  global.fetch = fetchMock as unknown as typeof fetch;

  process.env.TEMPLATES_API_URL = 'https://api.test';
  process.env.TEMPLATES_API_KEY = 'secret-key';
});

afterEach(() => {
  process.env.TEMPLATES_API_URL = savedEnv.url;
  process.env.TEMPLATES_API_KEY = savedEnv.key;
});

describe('authentication', () => {
  it('answers a signed-out request with a JSON 401 rather than a redirect', async () => {
    isAuthenticated.mockResolvedValue(false);

    const response = await GET(request('/api/templates/api/v1/templates'), context([
      'api',
      'v1',
      'templates',
    ]));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'UNAUTHORIZED', message: expect.any(String) },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a misconfigured auth provider as a server fault, not as signed out', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    assertValidAuthConfig.mockImplementation(() => {
      throw new Error('Missing required auth configuration: CLERK_SECRET_KEY');
    });

    const response = await GET(request('/api/templates/health'), context(['health']));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INTERNAL_ERROR', message: expect.any(String) },
    });
    expect(fetchMock).not.toHaveBeenCalled();

    assertValidAuthConfig.mockReset();
    consoleError.mockRestore();
  });
});

describe('configuration', () => {
  it('refuses to forward when the API url or key is missing', async () => {
    delete process.env.TEMPLATES_API_KEY;

    const response = await GET(request('/api/templates/api/v1/templates'), context([
      'api',
      'v1',
      'templates',
    ]));

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('forwarding', () => {
  it('attaches the bearer key and relays the path and query verbatim', async () => {
    await GET(
      request('/api/templates/api/v1/templates?status=draft&status=active&page=2'),
      context(['api', 'v1', 'templates']),
    );

    const [target, init] = fetchMock.mock.calls[0];

    expect(String(target)).toBe('https://api.test/api/v1/templates?status=draft&status=active&page=2');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secret-key');
    expect(init.cache).toBe('no-store');
  });

  it.each([
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('forwards a %s body', async (method, handler) => {
    await handler(
      request('/api/templates/api/v1/templates/welcome/versions', {
        method,
        body: JSON.stringify({ name: 'Renamed' }),
      }),
      context(['api', 'v1', 'templates', 'welcome', 'versions']),
    );

    const [, init] = fetchMock.mock.calls[0];

    expect(init.method).toBe(method);
    expect(init.body).toBe('{"name":"Renamed"}');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('relays the API error envelope untouched, so error codes survive the hop', async () => {
    fetchMock.mockResolvedValue(
      upstream(
        { error: { code: 'INVALID_STATUS_TRANSITION', message: 'draft cannot go to archived' } },
        409,
      ),
    );

    const response = await POST(
      request('/api/templates/api/v1/templates/welcome/status', {
        method: 'POST',
        body: JSON.stringify({ status: 'archived' }),
      }),
      context(['api', 'v1', 'templates', 'welcome', 'status']),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INVALID_STATUS_TRANSITION', message: 'draft cannot go to archived' },
    });
  });

  it('reports an unreachable API as INTERNAL_ERROR — this contract has no UPSTREAM_ERROR', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const response = await GET(request('/api/templates/api/v1/templates'), context([
      'api',
      'v1',
      'templates',
    ]));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: { code: 'INTERNAL_ERROR', message: expect.stringContaining('ECONNREFUSED') },
    });
  });
});
