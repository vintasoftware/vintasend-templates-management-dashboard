import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // vintasend-templates-management-dashboard-core is published as ESM only.
  // Listing it here makes Next transpile it for every target. (Vitest inlines it
  // separately; see `server.deps.inline` in vitest.config.mts.)
  transpilePackages: ['vintasend-templates-management-dashboard-core'],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'cdn.auth0.com' },
    ],
  },
};

export default nextConfig;
