import type { ComponentType, ReactNode } from "react";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ClerkProvider } from "@clerk/nextjs";
import {
  auth,
  clerkClient,
  currentUser,
  getAuth,
  type User,
} from "@clerk/nextjs/server";
import type { AuthStrategy, AuthUser } from "../types";

const mapClerkUserToAuthUser = (user: User): AuthUser => {
  const primaryEmail =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses?.[0]?.emailAddress ??
    null;
  const constructedName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(" ");
  const fullName = user.fullName ?? (constructedName ? constructedName : null);

  return {
    id: user.id,
    email: primaryEmail,
    name: fullName,
    imageUrl: user.imageUrl ?? null,
  };
};

/**
 * AuthStrategy implementation backed by Clerk.
 */
export class ClerkStrategy implements AuthStrategy {
  validateConfig(): string[] {
    const required = [
      "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
      "CLERK_SECRET_KEY",
    ];

    return required.filter((key) => !process.env[key]);
  }

  getProviderComponent(): ComponentType<{ children: ReactNode }> {
    return ClerkProvider;
  }

  async getCurrentUser(_request?: NextRequest): Promise<AuthUser | null> {
    if (_request) {
      const { userId } = getAuth(_request);

      if (!userId) {
        return null;
      }

      const user = await (await clerkClient()).users.getUser(userId);
      return mapClerkUserToAuthUser(user);
    }

    const user = await currentUser();
    return user ? mapClerkUserToAuthUser(user) : null;
  }

  async isAuthenticated(_request?: NextRequest): Promise<boolean> {
    if (_request) {
      const { userId } = getAuth(_request);
      return Boolean(userId);
    }

    const { userId } = await auth();
    return Boolean(userId);
  }

  getSignInUrl(): string {
    return "/sign-in";
  }

  getSignOutUrl(): string {
    return "/sign-out";
  }

  async protectRoute(_request: NextRequest): Promise<NextResponse | null> {
    const { userId } = getAuth(_request);

    if (userId) {
      return null;
    }

    const signInUrl = new URL(this.getSignInUrl(), _request.url);
    return NextResponse.redirect(signInUrl);
  }
}
