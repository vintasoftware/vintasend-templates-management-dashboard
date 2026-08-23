/**
 * The retry policy.
 *
 * The interesting half of `Providers` is `shouldRetryQuery`: this contract has
 * no `UPSTREAM_ERROR`, so an enveloped failure is always a verdict and only a
 * request that never reached the API is worth a second attempt.
 */

import { shouldRetryQuery } from '@/app/providers';

const enveloped = (code: string) => ({ error: { code, message: 'nope' } });

it('does not retry a verdict the API has already given', () => {
  for (const code of [
    'UNAUTHORIZED',
    'NOT_FOUND',
    'BAD_REQUEST',
    'CONFLICT',
    'INVALID_STATUS_TRANSITION',
    'PREVIEW_UNAVAILABLE',
    'TEMPLATE_COMPOSITION_ERROR',
    // The proxy answers this for its own misconfiguration, which retrying
    // cannot fix either.
    'INTERNAL_ERROR',
  ]) {
    expect(shouldRetryQuery(0, enveloped(code))).toBe(false);
  }
});

it('retries a failure that arrived without an envelope, up to twice', () => {
  const transport = new TypeError('Failed to fetch');

  expect(shouldRetryQuery(0, transport)).toBe(true);
  expect(shouldRetryQuery(1, transport)).toBe(true);
  expect(shouldRetryQuery(2, transport)).toBe(false);
});

it('survives a null rejection reason', () => {
  expect(shouldRetryQuery(0, null)).toBe(true);
});
