import { Auth0Provider } from "@auth0/nextjs-auth0/client";
import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as NextResponseClass } from "next/server";
import type { ComponentType, ReactNode } from "react";
import { auth0 } from "../../auth0";
import type { AuthStrategy, AuthUser } from "../types";

/**
 * AuthStrategy implementation backed by Auth0 v4.
 */
export class Auth0Strategy implements AuthStrategy {
  validateConfig(): string[] {
    const required = [
      "AUTH0_SECRET",
      "APP_BASE_URL",
      "AUTH0_DOMAIN",
      "AUTH0_CLIENT_ID",
      "AUTH0_CLIENT_SECRET",
    ];

    return required.filter((key) => !process.env[key]);
  }

  getProviderComponent(): ComponentType<{ children: ReactNode }> {
    return Auth0Provider;
  }

  async getCurrentUser(_request?: NextRequest): Promise<AuthUser | null> {
    try {
      const session = await auth0.getSession();
      if (!session?.user) {
        return null;
      }

      const user = session.user;
      return {
        id: user.sub || "",
        email: user.email || null,
        name: user.name || null,
        imageUrl: user.picture || null,
      };
    } catch {
      return null;
    }
  }

  async isAuthenticated(_request?: NextRequest): Promise<boolean> {
    try {
      const session = await auth0.getSession();
      return !!session?.user;
    } catch {
      return false;
    }
  }

  getSignInUrl(): string {
    return "/auth/login";
  }

  getSignOutUrl(): string {
    return "/auth/logout";
  }

  async protectRoute(request: NextRequest): Promise<NextResponse | null> {
    try {
      const session = await auth0.getSession(request);
      if (!session?.user) {
        // Redirect to login
        const signInUrl = new URL(this.getSignInUrl(), request.url);
        signInUrl.searchParams.set("returnTo", request.nextUrl.pathname);
        return NextResponseClass.redirect(signInUrl);
      }
      return null;
    } catch {
      // On error, redirect to login
      const signInUrl = new URL(this.getSignInUrl(), request.url);
      signInUrl.searchParams.set("returnTo", request.nextUrl.pathname);
      return NextResponseClass.redirect(signInUrl);
    }
  }
}
