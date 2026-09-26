import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  transpilePackages: ['@bs-kara/shared'],
  // yt-search ships a pre-bundled file that loads its dependencies through a
  // hidden require the build can't see. Load them all from node_modules at
  // runtime; server/youtube.ts imports them so they're traced and copied.
  serverExternalPackages: [
    'yt-search',
    'cheerio',
    'dasu',
    'async.parallellimit',
    'human-time',
    'jsonpath-plus',
  ],
  // Self-contained server (.next/standalone/.../server.js) for the Docker image.
  // Vercel ignores this setting.
  output: 'standalone',
  // Trace files from the monorepo root so packages/shared is included.
  outputFileTracingRoot: path.join(__dirname, '../../'),
};

export default nextConfig;
