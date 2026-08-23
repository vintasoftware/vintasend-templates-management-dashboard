import { Auth0Strategy } from "./strategies/auth0-strategy";
import { ClerkStrategy } from "./strategies/clerk-strategy";
import type { AuthStrategy, AuthProvider } from "./types";

const AUTH_PROVIDER_ERROR = "AUTH_PROVIDER env var is required";

/**
 * Resolves the auth strategy based on an explicit provider or env config.
 */
export const resolveAuthStrategy = (
  provider?: AuthProvider | string,
): AuthStrategy => {
  const resolvedProvider = provider ?? process.env.AUTH_PROVIDER;

  if (!resolvedProvider) {
    throw new Error(AUTH_PROVIDER_ERROR);
  }

  switch (resolvedProvider) {
    case "clerk":
      return new ClerkStrategy();
    case "auth0":
      return new Auth0Strategy();
    default:
      throw new Error(`Unsupported auth provider: ${resolvedProvider}`);
  }
};
