import type { NextConfig } from 'next'

// TODO: next-pwa is installed but has compatibility issues with Next.js 15/16.
// When stable support is confirmed, wrap nextConfig with:
//   import withPWA from 'next-pwa'
//   export default withPWA({ dest: 'public', ... })(nextConfig)

const nextConfig: NextConfig = {
  experimental: {},
  // Ensure server components can use bcryptjs (native addon)
  serverExternalPackages: ['bcryptjs'],
}

export default nextConfig
