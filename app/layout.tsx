import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { resolveAuthStrategy } from '@/lib/auth';
import { AuthProvider } from '@/lib/auth/auth-context';
import { assertValidAuthConfig } from '@/lib/auth/validate-config';
import { TopNavbar } from './components/top-navbar';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import type { AuthUser } from '@/lib/auth';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// The root layout reads the session cookie through `strategy.getCurrentUser()`,
// so it can only ever be rendered per request. Without this, `next build` tries
// to prerender the routes that have no other dynamic marker — notably the
// built-in `/_not-found` page — and the layout throws on the auth env vars,
// which are absent at build time. Opting the whole tree into dynamic rendering
// keeps the build independent of runtime auth configuration.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'VintaSend Templates',
  description: 'Manage VintaSend notification templates and their versions',
};

async function RootLayoutContent({
  children,
  ProviderComponent,
  currentUser,
  signInUrl,
  signOutUrl,
}: {
  children: React.ReactNode;
  ProviderComponent: React.ComponentType<{ children: React.ReactNode }>;
  currentUser: AuthUser | null;
  signInUrl: string;
  signOutUrl: string;
}) {
  return (
    <ProviderComponent>
      <AuthProvider initialUser={currentUser} signInUrl={signInUrl} signOutUrl={signOutUrl}>
        {/* Query cache and templates client, inside the session so a signed-out
            user never has a client pointed at the proxy. */}
        <Providers>
          <TopNavbar />
          {children}
        </Providers>
      </AuthProvider>
    </ProviderComponent>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const strategy = resolveAuthStrategy();
  assertValidAuthConfig(strategy);
  const ProviderComponent = strategy.getProviderComponent();
  const currentUser = await strategy.getCurrentUser();
  const signInUrl = strategy.getSignInUrl();
  const signOutUrl = strategy.getSignOutUrl();

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <RootLayoutContent
          ProviderComponent={ProviderComponent}
          currentUser={currentUser}
          signInUrl={signInUrl}
          signOutUrl={signOutUrl}
        >
          {children}
        </RootLayoutContent>
        <Toaster />
      </body>
    </html>
  );
}
