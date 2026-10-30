import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';
import { vi } from 'vitest';

// Testing Library's own async timeout is 1s and is independent of Vitest's
// testTimeout. Mounting a Radix Sheet or Dialog and resolving a mocked server
// action can exceed that on a loaded CI runner, which showed up as suites that
// passed alone and failed in a full parallel run.
configure({ asyncUtilTimeout: 5000 });

// Testing Library only recognises Jest's fake timers: it advances them while
// draining after a user-event interaction and while polling in `waitFor`, but
// only when it finds a global `jest`. Without one, a suite on `vi.useFakeTimers()`
// hangs on the first `await user.type(...)`. Exposing the one method it calls
// lets it drive Vitest's clock the same way.
Object.assign(globalThis, {
  jest: { advanceTimersByTime: (ms: number) => vi.advanceTimersByTime(ms) },
});

// jsdom implements neither the Pointer Capture API nor scrollIntoView, and
// Radix's Select/Popover/DropdownMenu call both while opening. Without these the
// primitives throw instead of rendering their content, so any test that opens a
// menu fails for reasons that have nothing to do with the component under test.
// Guarded because this file also runs for node-environment suites (proxy, API
// client, auth strategies), where there is no DOM at all.
if (typeof Element !== 'undefined') {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
    Element.prototype.setPointerCapture = () => {};
    Element.prototype.releasePointerCapture = () => {};
  }

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}

// jsdom reports what it cannot do — "Not implemented: navigation", for one — on
// its virtual console, which Vitest leaves pointed at the worker's original
// console. Route those reports through the test's `console.error` instead, so a
// suite can spy on them.
type VirtualConsole = {
  removeAllListeners(event: 'jsdomError'): void;
  on(event: 'jsdomError', listener: (error: Error) => void): void;
};
const { jsdom } = globalThis as { jsdom?: { virtualConsole: VirtualConsole } };
if (jsdom) {
  jsdom.virtualConsole.removeAllListeners('jsdomError');
  jsdom.virtualConsole.on('jsdomError', (error) => console.error(error));
}
