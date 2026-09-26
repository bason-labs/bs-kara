import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@bs-kara/shared'],
  // Self-contained server (.next/standalone/.../server.js) for the Docker image.
  // Vercel ignores this setting.
  output: 'standalone',
  // Trace files from the monorepo root so packages/shared is included.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
