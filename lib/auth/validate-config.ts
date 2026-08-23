import type { AuthStrategy } from "./types";

export const assertValidAuthConfig = (strategy: AuthStrategy): void => {
  const missing = strategy.validateConfig();

  if (missing.length > 0) {
    throw new Error(
      `Missing required auth configuration: ${missing.join(", ")}`,
    );
  }
};
