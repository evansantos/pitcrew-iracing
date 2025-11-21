import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@iracing-race-engineer/shared'],

  // Enable standalone output for production deployment
  output: process.env.NODE_ENV === 'production' ? 'export' : undefined,

  // Disable ESLint during production builds (already checked in dev)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Disable TypeScript errors during production builds (already checked in dev)
  typescript: {
    ignoreBuildErrors: true,
  },

  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  },
};

export default nextConfig;
