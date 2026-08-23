import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { resolveAuthStrategy } from "@/lib/auth";

export default function SignInPage() {
  const strategy = resolveAuthStrategy();
  const authProvider = process.env.AUTH_PROVIDER;

  // For Auth0, redirect to the login endpoint
  if (authProvider === "auth0") {
    redirect(strategy.getSignInUrl());
  }

  // For Clerk, render the SignIn component
  return (
    <main className="flex w-full justify-center pt-64">
      <SignIn />
    </main>
  );
}
