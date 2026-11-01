import path from 'node:path';

/** @type {import('next').NextConfig} */

// Express (apps/api) is the only API. Next.js forwards every /api/* request to it.
// In development it defaults to the local Express server; in production BACKEND_URL is required.
const backendUrl =
  process.env.BACKEND_URL ||
  (process.env.NODE_ENV === 'production' ? null : 'http://localhost:4000');

if (!backendUrl) {
  throw new Error('BACKEND_URL must be set in production (URL of the Express API).');
}

const nextConfig = {
  reactStrictMode: true,

  // Monorepo root (dependencies are hoisted there; also ignores a stray lockfile in a parent folder).
  turbopack: { root: path.join(import.meta.dirname, '..', '..') },

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl.replace(/\/$/, '')}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
