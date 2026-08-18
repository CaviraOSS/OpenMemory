/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.spectrumdevs.com",
        pathname: "/**",
      },
    ],
  },
};

module.exports = nextConfig;
