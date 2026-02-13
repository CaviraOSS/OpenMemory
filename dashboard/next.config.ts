import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: process.env.NEXT_PUBLIC_CDN_HOSTNAME
      ? [
          {
            protocol: 'https',
            hostname: process.env.NEXT_PUBLIC_CDN_HOSTNAME,
            pathname: '/**',
          },
        ]
      : [],
  },
};

export default nextConfig;
