const JSDOMEnvironment = require('jest-environment-jsdom');

const Base = JSDOMEnvironment.TestEnvironment ?? JSDOMEnvironment.default ?? JSDOMEnvironment;

/**
 * jsdom, plus the Fetch API.
 *
 * jsdom implements no part of fetch, so in a plain jsdom environment `Request`,
 * `Response` and `Headers` are simply undefined. The dashboard's data layer is
 * `openapi-fetch`, which builds a `Request` for every call, so without these a
 * component test fails on a missing global rather than on anything it meant to
 * assert.
 *
 * The implementations come from Node itself (18+), so tests exercise the same
 * primitives the app does at runtime. They are copied in rather than
 * polyfilled, which keeps one set of classes in play and `instanceof` honest.
 */
/** Added only where jsdom has no implementation of its own. */
const MISSING_ONLY = [
  'fetch',
  'Request',
  'Response',
  'Headers',
  'FormData',
  'Blob',
  'ReadableStream',
  'TransformStream',
  'structuredClone',
  'TextEncoder',
  'TextDecoder',
];

/**
 * Replaced even though jsdom defines them.
 *
 * Node's `fetch` type-checks `signal` against its own `AbortSignal`, and jsdom
 * supplies a different class with the same name. Leaving jsdom's in place makes
 * every aborted-capable request — which is every request TanStack Query
 * makes — fail with "Expected signal to be an instance of AbortSignal". The
 * fetch stack has to come from one realm.
 */
const ALWAYS_OVERRIDE = ['AbortController', 'AbortSignal'];

class JsdomWithFetchEnvironment extends Base {
  constructor(config, context) {
    super(config, context);

    for (const name of MISSING_ONLY) {
      if (this.global[name] === undefined && globalThis[name] !== undefined) {
        this.global[name] = globalThis[name];
      }
    }

    for (const name of ALWAYS_OVERRIDE) {
      if (globalThis[name] !== undefined) {
        this.global[name] = globalThis[name];
      }
    }
  }
}

module.exports = JsdomWithFetchEnvironment;
