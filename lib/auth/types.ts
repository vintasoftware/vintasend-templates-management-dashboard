import type { ComponentType, ReactNode } from "react";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Supported auth providers for the dashboard.
 */
export type AuthProvider = "clerk" | "auth0";

/**
 * Normalized user data shared across strategies.
 */
export type AuthUser = {
  id: string;
  email: string | null;
  name: string | null;
  imageUrl: string | null;
};

/**
 * Strategy contract for pluggable auth providers.
 */
export interface AuthStrategy {
  /**
   * Returns the provider component that wraps the app shell.
   */
  getProviderComponent(): ComponentType<{ children: ReactNode }>;
  /**
   * Fetches the current user in the active request context.
   */
  getCurrentUser(request?: NextRequest): Promise<AuthUser | null>;
  /**
   * Checks whether a session is present for the given request.
   */
  isAuthenticated(request?: NextRequest): Promise<boolean>;
  /**
   * Returns the URL used to initiate sign-in.
   */
  getSignInUrl(): string;
  /**
   * Returns the URL used to initiate sign-out.
   */
  getSignOutUrl(): string;
  /**
   * Handles middleware route protection and redirects when needed.
   */
  protectRoute(request: NextRequest): Promise<NextResponse | null>;
  /**
   * Validates required environment configuration and returns missing keys.
   */
  validateConfig(): string[];
}
