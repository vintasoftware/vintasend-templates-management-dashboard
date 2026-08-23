"use client";

import { useClerk } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignOutPage() {
  const { signOut } = useClerk();
  const authProvider = process.env.NEXT_PUBLIC_AUTH_PROVIDER;

  useEffect(() => {
    // For Clerk, use the signOut function
    if (authProvider === "clerk" || !authProvider) {
      void signOut({ redirectUrl: "/" });
    }
    // For Auth0, redirect to the logout endpoint
    else if (authProvider === "auth0") {
      // Construct Auth0 logout URL on the client
      const returnTo = window.location.origin;
      const logoutUrl = `/api/auth/logout?returnTo=${encodeURIComponent(returnTo)}`;
      window.location.href = logoutUrl;
    }
  }, [signOut, authProvider]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Signing out...</p>
    </div>
  );
}
