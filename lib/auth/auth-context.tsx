"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";
import type { AuthUser } from "./types";

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  signInUrl: string;
  signOutUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  signInUrl: string;
  signOutUrl: string;
  initialUser: AuthUser | null;
}

/**
 * Client-side provider for resolved auth state and URLs.
 */
export function AuthProvider({
  children,
  signInUrl,
  signOutUrl,
  initialUser,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(initialUser);
  
  // Check which auth provider is being used
  const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || process.env.AUTH_PROVIDER;
  const isClerk = authProvider === "clerk" || !authProvider;
  
  // Always call the hook (rules of hooks), but only use it for Clerk
  const { user: clerkUser, isLoaded } = useUser();

  // Update user state when Clerk's auth state changes
  useEffect(() => {
    if (isClerk && isLoaded) {
      if (clerkUser) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser({
          id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress || "",
          name: clerkUser.fullName || clerkUser.firstName || "",
          imageUrl: clerkUser.imageUrl,
        });
      } else {
        setUser(null);
      }
    }
  }, [clerkUser, isLoaded, isClerk]);

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    signInUrl,
    signOutUrl,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

/**
 * Accesses the resolved auth context in client components.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
