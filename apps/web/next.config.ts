import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Do not set output: 'standalone' for Vercel — platform serves Next.js natively.
  images: {
    domains: [],
  },
  async redirects() {
    // Host docs.silenttransfer.com → /docs (configure DNS to this app)
    return [
      {
        source: '/',
        has: [{ type: 'host', value: 'docs.silenttransfer.com' }],
        destination: '/docs',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
