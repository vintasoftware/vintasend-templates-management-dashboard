import { Auth0Client } from "@auth0/nextjs-auth0/server";

/**
 * Auth0 client instance for v4.
 * This client is used to handle authentication in the middleware and server components.
 */
export const auth0 = new Auth0Client({
  authorizationParameters: {
    scope: "openid profile email",
    redirect_uri: `${process.env.APP_BASE_URL}/auth/callback`,
  },
});
