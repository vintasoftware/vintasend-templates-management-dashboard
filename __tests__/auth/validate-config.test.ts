/**
 * Tests for auth configuration validation.
 */

import { assertValidAuthConfig } from '@/lib/auth/validate-config';
import type { AuthStrategy } from '@/lib/auth/types';

const strategyReporting = (missing: string[]) =>
  ({ validateConfig: () => missing }) as unknown as AuthStrategy;

describe('assertValidAuthConfig', () => {
  it('passes when the strategy reports nothing missing', () => {
    expect(() => assertValidAuthConfig(strategyReporting([]))).not.toThrow();
  });

  it('names the single missing key', () => {
    expect(() => assertValidAuthConfig(strategyReporting(['CLERK_SECRET_KEY']))).toThrow(
      'Missing required auth configuration: CLERK_SECRET_KEY',
    );
  });

  it('names every missing key, comma separated', () => {
    expect(() =>
      assertValidAuthConfig(strategyReporting(['AUTH0_SECRET', 'AUTH0_DOMAIN'])),
    ).toThrow('Missing required auth configuration: AUTH0_SECRET, AUTH0_DOMAIN');
  });
});
