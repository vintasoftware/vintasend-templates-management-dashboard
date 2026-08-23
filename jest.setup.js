import '@testing-library/jest-dom';
import { configure } from '@testing-library/react';

// Testing Library's own async timeout is 1s and is independent of Jest's
// testTimeout. Mounting a Radix Sheet or Dialog and resolving a mocked server
// action can exceed that on a loaded CI runner, which showed up as suites that
// passed alone and failed in a full parallel run.
configure({ asyncUtilTimeout: 5000 });

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
