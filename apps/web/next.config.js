/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@metris/shared'],
  eslint: {
    // Linting runs from the repository root (eslint.config.js).
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
