# VintaSend Templates Management Dashboard

A Next.js dashboard for managing
[VintaSend](https://github.com/vintasoftware/vintasend) notification
**templates** — their versions, their lifecycle, and the tags that organise
them — with pluggable authentication (Clerk or Auth0) selected by environment
variable.

It is the sibling of
[vintasend-dashboard](https://github.com/vintasoftware/vintasend-dashboard),
which does the same job for sent notifications. Where that one is read-mostly,
this one is a write tool: creating templates, versioning them, moving them
through their lifecycle, and previewing what they render to.

**This is an example, and meant to be copied.** Everything data-shaped lives in
[`vintasend-templates-management-dashboard-core`](https://github.com/vintasoftware/vintasend-templates-management-dashboard-core)
— the generated API client, the TanStack Query hooks, and the URL-backed
filters. What is in this repository is one opinionated UI over those hooks, in
Tailwind and shadcn/ui. Replace `app/components/**` with your own design system
and the data layer keeps working unchanged.

```
┌──────────────────────────┐   HTTPS + API key   ┌──────────────────────────────┐
│  This dashboard          │ ──────────────────▶ │  templates-management-api    │
│  (Clerk / Auth0)         │ ◀────────────────── │  + your template backend     │
└──────────────────────────┘    JSON contract    └──────────────────────────────┘
```

The API key never reaches the browser: the client is pointed at this app's own
`/api/templates` proxy route, which re-signs each call server-side.

## Getting started

```bash
npm install
cp .env.example .env.local
```

Point it at a running
[templates-management API](https://github.com/vintasoftware/vintasend-ts-templates-management-api):

```bash
TEMPLATES_API_URL=http://localhost:3334
TEMPLATES_API_KEY=the-same-key-the-api-was-started-with
```

Configure authentication (below), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## What the screens do

### Templates (`/`)

One row per template **version**. The list collapses to the most recent active
version of each key by default; tick _Show every version_ for the raw listing.

| Action         | What it actually does                                               |
| -------------- | ------------------------------------------------------------------- |
| New template   | `POST /templates` — creates the first version, in draft             |
| New version    | `POST /templates/{key}/versions` — this API's equivalent of an edit |
| Render preview | `POST /templates/{key}/preview` against a context you type          |
| Edit tags      | `PUT /templates/{key}/tags` — replaces the set outright             |
| Change status  | only the transitions the version itself reports                     |
| Delete         | one version, or every version of the key                            |

The detail panel splits **Source** (what someone typed) from **Composition**
(the flat string the engine receives, with inheritance resolved), and shows the
key's status history and every version it has had.

### Tags (`/tags`)

Create, rename, archive, restore and delete tags. The slug — not the name — is a
tag's identity and what the template filters match on, so renaming is flagged:
it regenerates the slug, and anything holding the old one stops matching.

## Three things this contract does differently

If you are coming from the notifications dashboard, these are the differences
the UI has to respect.

**1. Templates are versioned, not edited.** A row in the store is a version.
There is no update endpoint — `useCreateTemplateVersion` is the edit, and any
field omitted from its body is carried forward from the latest version. The form
in `app/components/template-form-dialog.tsx` pre-fills from the current version
and sends only what changed.

**2. Ordering is gated; filtering is not.** The capability namespaces have
opposite defaults:

| Namespace                                  | A missing key means | An unsupported request               |
| ------------------------------------------ | ------------------- | ------------------------------------ |
| `fields.*`, `stringLookups.*`, `logical.*` | supported           | silently dropped — you get more rows |
| `orderBy.*`                                | **not** supported   | **400**                              |

So a column header only becomes clickable once `useFilteredTemplates` reports
the field in `sortableFields`, and a filter control is not rendered at all when
the backend cannot honour it — an input that silently does nothing is worse than
no input.

**3. `version` means different things on different endpoints.** Omitting it
means _the latest_ everywhere except the status-history endpoint, where it means
_every version_. Every write here names the version explicitly, because the row
a user clicked is not necessarily the latest one.

## Architecture

| Path                                   | Responsibility                                                     |
| -------------------------------------- | ------------------------------------------------------------------ |
| `app/providers.tsx`                    | The one query cache and the templates client, pointed at the proxy |
| `app/api/templates/[...path]/route.ts` | Same-origin proxy: adds the API key, relays the error envelope     |
| `proxy.ts`                             | Middleware: route protection per auth provider                     |
| `app/components/`                      | The UI — tables, filter bars, detail panel, dialogs                |
| `lib/auth/`                            | The pluggable auth strategies                                      |
| `components/ui/`                       | shadcn/ui primitives, generated by `npx shadcn add`                |

Errors from the API carry a machine-readable `code`, and the proxy relays it
untouched so `getApiErrorCode` still works in the browser. The UI branches on
three of them rather than showing a generic failure:
`INVALID_STATUS_TRANSITION`, `TEMPLATE_COMPOSITION_ERROR` and
`PREVIEW_UNAVAILABLE`.

## Authentication

`resolveAuthStrategy()` reads `AUTH_PROVIDER` and delegates to the chosen
provider. The middleware protects routes and handles provider-specific flows;
the root layout wraps the app in the provider component.

Requests under `/api/templates` deliberately are **not** redirected when signed
out — a 307 to an HTML sign-in page is useless to a `fetch` — so the route
handler answers with a JSON 401 instead.

### Clerk

1. Create a Clerk application and copy the publishable and secret keys.
2. Set `AUTH_PROVIDER=clerk` in `.env.local`, plus the two keys.
3. Start the dev server and visit `/sign-in`.

### Auth0 (SDK v4)

1. Create an Auth0 Regular Web Application.
2. Configure its URLs:
   - Allowed Callback URLs: `http://localhost:3000/auth/callback`
   - Allowed Logout URLs: `http://localhost:3000`
   - Allowed Web Origins: `http://localhost:3000`
3. Set `AUTH_PROVIDER=auth0` in `.env.local`, plus the Auth0 values.
4. Start the dev server and visit `/auth/login`.

Auth0 v4 mounts its routes at `/auth/*` automatically — no route handlers of
your own are needed.

## Environment variables

| Variable                            | Provider | Description                                            |
| ----------------------------------- | -------- | ------------------------------------------------------ |
| `TEMPLATES_API_URL`                 | API      | Base URL of the templates-management API               |
| `TEMPLATES_API_KEY`                 | API      | Shared secret sent as a bearer token. Server-side only |
| `AUTH_PROVIDER`                     | both     | `clerk` or `auth0`                                     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk    | Clerk publishable key                                  |
| `CLERK_SECRET_KEY`                  | Clerk    | Clerk secret key                                       |
| `AUTH0_SECRET`                      | Auth0    | Session cookie encryption secret                       |
| `APP_BASE_URL`                      | Auth0    | Base URL of the app                                    |
| `AUTH0_DOMAIN`                      | Auth0    | Tenant domain, without a scheme                        |
| `AUTH0_CLIENT_ID`                   | Auth0    | Auth0 client id                                        |
| `AUTH0_CLIENT_SECRET`               | Auth0    | Auth0 client secret                                    |

## Development

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

The tests that matter most run the **real** core hooks — URL parsing, the
generated client, the query cache — and stub only `fetch`
(`__tests__/support/templates.tsx`). Those are the ones that would catch this UI
drifting away from the package it demonstrates: a filter that never reaches the
query string, or a query string the list request ignores.

## Using this as a starting point

1. Copy `app/providers.tsx` and `app/api/templates/[...path]/route.ts` — that
   pair is the whole security model, and the split between them is the part
   worth keeping.
2. Take the hooks from
   `vintasend-templates-management-dashboard-core`; leave the components behind.
3. Keep the three contract rules above in mind, and read the comments in
   `app/components/` — each one records why the UI does something that looks
   roundabout.

## License

MIT
