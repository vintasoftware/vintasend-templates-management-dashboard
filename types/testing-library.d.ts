/**
 * Makes `@testing-library/jest-dom`'s matcher augmentations visible to `tsc`.
 *
 * `jest.setup.js` imports the package at runtime, but that file is JavaScript
 * and outside the tsconfig program, so without this the matchers exist in the
 * test run and not in the typecheck — `toBeInTheDocument` then fails to compile
 * in every test file.
 */
import '@testing-library/jest-dom';
